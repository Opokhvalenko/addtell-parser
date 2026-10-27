import { createHash, randomBytes } from "node:crypto";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyInstance, FastifyReply } from "fastify";

export const ACCESS_TOKEN_TYPE = "access";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE = "refresh";
/** The refresh cookie is sent only to the auth routes, never to the rest of the API. */
export const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_TOKEN_BYTES = 32;
/**
 * Two tabs of one browser may refresh at the same moment with the same cookie: the loser
 * presents a token revoked a few seconds ago. That is not theft, so it only fails (the browser
 * already holds the winner's new cookies) instead of revoking every session.
 */
const REUSE_GRACE_SECONDS = 30;
const MS_PER_SECOND = 1000;

export type SessionUser = { id: string; email: string };
export type AccessPayload = SessionUser & { tokenType: typeof ACCESS_TOKEN_TYPE };

type CookieConfig = { JWT_COOKIE?: string; NODE_ENV?: string; COOKIE_SECURE?: string };

export function accessCookieName(app: FastifyInstance): string {
  return (app.config as CookieConfig).JWT_COOKIE ?? "token";
}

/**
 * Same-origin cookies: the frontend reaches the API through its own domain (Vercel rewrite),
 * so `SameSite=Lax` works and cross-site requests never carry the session.
 */
function baseCookieOptions(app: FastifyInstance): CookieSerializeOptions {
  const cfg = app.config as CookieConfig;
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.NODE_ENV === "production" || cfg.COOKIE_SECURE === "true",
    signed: true,
  };
}

/** SHA-256, not bcrypt/argon2: the token is 256 random bits, so a fast hash is enough. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a new access token and a new refresh token for the user and sets both cookies. */
export async function startSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: SessionUser,
): Promise<void> {
  const payload: AccessPayload = { id: user.id, email: user.email, tokenType: ACCESS_TOKEN_TYPE };
  const accessToken = await reply.jwtSign(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });

  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  const now = Date.now();
  await app.prisma.refreshToken.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date(now) } },
  });
  await app.prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * MS_PER_SECOND),
      // Explicit null: on MongoDB an unset optional field is missing, and `revokedAt: null`
      // filters (used for atomic rotation and revocation) would never match it
      revokedAt: null,
    },
  });

  const base = baseCookieOptions(app);
  reply.setCookie(accessCookieName(app), accessToken, {
    ...base,
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

async function revokeAllSessions(app: FastifyInstance, userId: string): Promise<void> {
  await app.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Exchanges a refresh token for a new session. The old token is revoked with a conditional
 * update, so of two parallel requests with the same token only one succeeds. Presenting a
 * token revoked earlier than the grace period means it was stolen or replayed: every session
 * of the user is revoked.
 */
export async function rotateSession(
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string,
): Promise<SessionUser | null> {
  const stored = await app.prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!stored) return null;

  if (stored.revokedAt) {
    const revokedFor = Date.now() - stored.revokedAt.getTime();
    if (revokedFor > REUSE_GRACE_SECONDS * MS_PER_SECOND) {
      await revokeAllSessions(app, stored.userId);
    }
    return null;
  }
  if (stored.expiresAt.getTime() <= Date.now()) return null;

  const { count } = await app.prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count !== 1) return null;

  await startSession(app, reply, stored.user);
  return stored.user;
}

/** Revokes the refresh token (if any) and clears both cookies. */
export async function endSession(
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string | undefined,
): Promise<void> {
  if (refreshToken) {
    await app.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookies(app, reply);
}

export function clearSessionCookies(app: FastifyInstance, reply: FastifyReply): void {
  const base = baseCookieOptions(app);
  reply.clearCookie(accessCookieName(app), { ...base, path: "/" });
  reply.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_COOKIE_PATH });
}
