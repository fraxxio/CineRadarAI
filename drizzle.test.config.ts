import type { Config } from "drizzle-kit";

// `generate` never connects, so the credentials are dummies that only satisfy the type
export default {
  schema: ["./src/infra/db/schema/*", "./src/modules/*/schema.ts"],
  out: "./tests/.generated/migrations",
  driver: "turso",
  dbCredentials: { url: "file:unused.db" },
} satisfies Config;
