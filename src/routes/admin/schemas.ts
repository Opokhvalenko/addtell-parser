// JSON Schemas for Swagger
export const AdminHeader = {
  type: "object",
  properties: {
    authorization: { type: "string", description: "Bearer <ADMIN_TOKEN> (optional)" },
    "x-admin-token": { type: "string", description: "ADMIN_TOKEN (optional)" },
  },
} as const;

export const ErrorResponse = {
  type: "object",
  properties: { error: { type: "string" } },
  required: ["error"],
} as const;

export const StatusResponse = {
  type: "object",
  properties: {
    schedule: { type: "string" },
    timezone: { type: "string" },
    sources: { type: "array", items: { type: "string", format: "uri" } },
    outPath: { type: "string" },
    take: { type: "integer" },
    historyLimit: { type: "integer" },
    cycles: { type: "integer" },

    processStartedAt: { type: "string", format: "date-time" },
    uptimeMs: { type: "integer" },
    uptimeHuman: { type: "string" },

    lastStartedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
    lastFinishedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },

    lastOk: { type: "integer" },
    lastFail: { type: "integer" },
    lastDurationMs: { type: "integer" },
    durations: { type: "array", items: { type: "integer" } },

    lastError: {
      anyOf: [
        {
          type: "object",
          properties: {
            at: { type: "string", format: "date-time" },
            url: { type: "string", nullable: true },
            name: { type: "string", nullable: true },
            message: { type: "string", nullable: true },
          },
          required: ["at"],
        },
        { type: "null" },
      ],
    },
  },
  required: [
    "schedule",
    "timezone",
    "sources",
    "outPath",
    "take",
    "historyLimit",
    "cycles",
    "processStartedAt",
    "uptimeMs",
    "uptimeHuman",
    "lastOk",
    "lastFail",
    "lastDurationMs",
    "durations",
    "lastError",
  ],
} as const;

export const RefreshQuery = {
  type: "object",
  properties: {
    url: { type: "string", format: "uri", description: "Якщо задано — оновити лише цей фід" },
  },
} as const;

export const RefreshResponse = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    only: { type: "string", nullable: true },
  },
  required: ["ok"],
} as const;
