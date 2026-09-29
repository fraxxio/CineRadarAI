import { readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateTestMigrations } from "../helpers/migrations";

export default function setup() {
  generateTestMigrations();
  for (const f of readdirSync(os.tmpdir()).filter((f) =>
    f.startsWith("cineradar-vitest-"),
  )) {
    rmSync(path.join(os.tmpdir(), f), { force: true });
  }
}
