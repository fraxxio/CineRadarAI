import { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/db/schema/*",
  driver: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN!,
  },
  out: "./drizzle",
} satisfies Config;
