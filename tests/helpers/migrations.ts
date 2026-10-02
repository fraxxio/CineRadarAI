import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export const MIGRATIONS_FOLDER = "tests/.generated/migrations";

// F5: generated from src/infra/db/schema/* on every run, so they can't drift from the schema
export function generateTestMigrations() {
  rmSync(MIGRATIONS_FOLDER, { recursive: true, force: true });
  execSync("npx drizzle-kit generate:sqlite --config=drizzle.test.config.ts", {
    stdio: "inherit",
  });
}
