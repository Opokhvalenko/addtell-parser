import fp from "fastify-plugin";

/**
 * loaded-marker
 * Додає метод fastify.pluginLoaded(name: string), який:
 *  - логгує one-shot повідомлення про успішне завантаження плагіна;
 *  - ігнорує повторні виклики для того самого name;
 *  - попереджає, якщо name некоректний.
 *
 * Використання:
 *   await fastify.register(somePlugin);
 *   fastify.pluginLoaded("somePlugin");
 */
export default fp(
  async (fastify) => {
    const loaded = new Set<string>();

    fastify.decorate("pluginLoaded", (name: string) => {
      if (!name || typeof name !== "string") {
        fastify.log.warn({ name }, "pluginLoaded called with invalid name");
        return;
      }

      if (loaded.has(name)) {
        fastify.log.debug({ plugin: name }, "plugin already marked as loaded");
        return;
      }

      loaded.add(name);
      fastify.log.info({ plugin: name }, "plugin loaded");
    });
  },
  { name: "loaded-marker" },
);
