import fp from "fastify-plugin";
import MarkdownIt from "markdown-it";

declare module "fastify" {
  interface FastifyInstance {
    md: MarkdownIt;
  }
}

export default fp(
  async (app) => {
    app.decorate("md", new MarkdownIt({ breaks: true, linkify: true }));
  },
  { name: "markdown" },
);
