import multipart from "@fastify/multipart";
import fp from "fastify-plugin";

const MAX_CREATIVE_FILE_BYTES = 2 * 1024 * 1024;
/** The ad form has ~10 text fields; creative HTML is ≤ 20 000 characters (≤ 80 KB in UTF-8). */
const MAX_FIELDS = 20;
const MAX_FIELD_BYTES = 128 * 1024;

export default fp(
  async (app) => {
    await app.register(multipart, {
      limits: {
        files: 1,
        fileSize: MAX_CREATIVE_FILE_BYTES,
        fields: MAX_FIELDS,
        fieldSize: MAX_FIELD_BYTES,
      },
      // Over the limit is an error (413), not a silently truncated image
      throwFileSizeLimit: true,
    });
  },
  { name: "multipart" },
);
