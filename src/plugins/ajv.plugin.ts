import AjvMod, { type AnySchema, type ValidateFunction } from "ajv";
import addFormatsMod from "ajv-formats";
import fp from "fastify-plugin";

export default fp(async (app) => {
  const Ajv = AjvMod.default;
  const addFormats = addFormatsMod.default;

  const ajv = new Ajv({
    allErrors: true,
    coerceTypes: true,
    useDefaults: true,
    removeAdditional: false,
    strict: false,
  });

  addFormats(ajv);

  app.setValidatorCompiler(({ schema }) => ajv.compile(schema as AnySchema) as ValidateFunction);
});
