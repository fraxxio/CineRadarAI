import { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: ["./src/infra/db/schema/*", "./src/modules/*/schema.ts"],
  driver: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  },
  out: "./drizzle",
} satisfies Config;
