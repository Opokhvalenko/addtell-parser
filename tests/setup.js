import buildApp from "../src/app.js";

export async function createTestApp() {
  const app = await buildApp({
    logger: { level: "silent" },
  });

  await app.ready();
  return app;
}

export async function closeTestApp(app) {
  if (app) {
    await app.close();
  }
}
