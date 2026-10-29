import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Server-side fetch of a URL that came from a user (SSRF guard).
 *
 * - only http/https, no credentials in the URL;
 * - every address is checked inside the socket `lookup`, i.e. at connect time — a DNS answer
 *   cannot change between the check and the connection (DNS rebinding);
 * - private, loopback, link-local, metadata and other non-public ranges are refused;
 * - redirects are followed manually (each hop is checked again), with a limit;
 * - a timeout and a maximum body size.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * The URL was allowed, but the remote site did not give a usable answer (timeout, too large,
 * too many redirects). The caller's request was fine: a gateway error, not a client error.
 */
export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export type SafeFetchResult = { status: number; contentType: string; body: string; url: string };

export type SafeFetchOptions = {
  accept?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Address policy; tests replace it to reach a local server. */
  isAllowedAddress?: (address: string) => boolean;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = "addtell-parser/1.0";
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["2001:db8::", 32], // documentation
  ["64:ff9b::", 96], // NAT64 (embeds an IPv4 address)
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

const IPV4_MAPPED_PREFIX = "::ffff:";

/** True only for globally routable unicast addresses. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && address.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)) {
    return isPublicAddress(address.slice(IPV4_MAPPED_PREFIX.length));
  }
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Parses and validates the URL itself (protocol, credentials, literal IPs). Node does not call
 * `lookup` for a literal IP host, so this check — on the first URL and on every redirect — is
 * the only one that sees such addresses.
 */
export function assertSafeUrl(
  raw: string,
  isAllowedAddress: (address: string) => boolean = isPublicAddress,
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol))
    throw new UnsafeUrlError("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new UnsafeUrlError("Credentials in URLs are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isAllowedAddress(host)) throw new UnsafeUrlError("Address is not allowed");
  return url;
}

function guardedLookup(isAllowedAddress: (address: string) => boolean) {
  return (
    hostname: string,
    options: object,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "");
      const list = addresses as LookupAddress[];
      const unsafe = list.find((entry) => !isAllowedAddress(entry.address));
      if (list.length === 0 || unsafe) {
        return callback(new UnsafeUrlError("Address is not allowed"), "");
      }
      const wantsAll = (options as { all?: boolean }).all === true;
      return wantsAll
        ? callback(null, list)
        : callback(null, list[0]?.address ?? "", list[0]?.family);
    });
  };
}

function requestOnce(
  url: URL,
  opts: Required<Omit<SafeFetchOptions, "accept">> & { accept: string },
): Promise<{ res: IncomingMessage; body: string }> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Accept: opts.accept },
        lookup: guardedLookup(opts.isAllowedAddress),
        // A fresh connection every time: no pooled socket skips the address check
        agent: false,
      },
      (res) => {
        if (Number(res.headers["content-length"] ?? 0) > opts.maxBytes) {
          req.destroy(new UpstreamError("Response is too large"));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            req.destroy(new UpstreamError("Response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          clearTimeout(deadline);
          resolve({ res, body: Buffer.concat(chunks).toString("utf8") });
        });
        res.on("error", reject);
      },
    );
    // A total deadline, not an idle timeout: an upstream that sends one byte at a time
    // would otherwise keep the connection (and the request) alive indefinitely
    const deadline = setTimeout(
      () => req.destroy(new UpstreamError("Upstream timed out")),
      opts.timeoutMs,
    );
    req.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    req.end();
  });
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const opts = {
    accept: options.accept ?? "*/*",
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
    maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    isAllowedAddress: options.isAllowedAddress ?? isPublicAddress,
  };

  let url = assertSafeUrl(rawUrl, opts.isAllowedAddress);
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    const { res, body } = await requestOnce(url, opts);
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (REDIRECT_STATUSES.has(status) && location) {
      url = assertSafeUrl(new URL(location, url).toString(), opts.isAllowedAddress);
      continue;
    }
    return {
      status,
      contentType: String(res.headers["content-type"] ?? ""),
      body,
      url: url.toString(),
    };
  }
  throw new UpstreamError("Too many redirects");
}
