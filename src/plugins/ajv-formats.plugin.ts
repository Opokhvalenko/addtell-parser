import type { Ajv, Options as AjvOptions } from "ajv";
import * as addFormatsNs from "ajv-formats";
import fp from "fastify-plugin";

const FORMATS_FLAG = Symbol.for("ajvFormats:installed");

export type AjvLike = Ajv & {
  [FORMATS_FLAG]?: boolean;
  opts: AjvOptions & {
    removeAdditional?: boolean | "all";
  };
};

function resolveAddFormats(): (ajv: Ajv, formats?: unknown, opts?: { keywords?: boolean }) => void {
  const ns = addFormatsNs as unknown as { default?: unknown };
  const fn = (typeof ns.default === "function" ? ns.default : (addFormatsNs as unknown)) as
    | ((ajv: Ajv, formats?: unknown, opts?: { keywords?: boolean }) => void)
    | undefined;
  if (typeof fn !== "function") throw new Error("ajv-formats export is not a function");
  return fn;
}

export function ajvFormatsPlugin(ajv: AjvLike): void {
  if (ajv[FORMATS_FLAG]) return;
  const addFormats = resolveAddFormats();
  try {
    addFormats(ajv, undefined, { keywords: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already defined/i.test(msg)) throw e;
  }
  ajv[FORMATS_FLAG] = true;
}

export default fp(
  async (app) => {
    app.log.debug("AJV formats plugin registered");
  },
  { name: "ajv-formats" },
);
