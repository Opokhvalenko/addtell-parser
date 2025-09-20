import * as addFormatsNs from "ajv-formats";

type AjvAny = unknown & { addFormat?: unknown };

function resolveAddFormats(): (ajv: AjvAny) => void {
  const ns = addFormatsNs as unknown as { default?: unknown };
  const maybe = (typeof ns.default === "function" ? ns.default : (addFormatsNs as unknown)) as
    | ((ajv: AjvAny) => void)
    | undefined;

  if (typeof maybe !== "function") {
    throw new Error("ajv-formats export is not a function");
  }
  return maybe;
}

export function ajvFormatsPlugin(ajv: AjvAny): void {
  const addFormats = resolveAddFormats();
  addFormats(ajv);
}
