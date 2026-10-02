import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, vi } from "vitest";

// one DB file per worker (F4: never :memory:); set before any test file imports @/infra/db (F3)
const worker = process.env.VITEST_POOL_ID ?? "0";
process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `cineradar-vitest-${worker}.db`)}`;
process.env.DATABASE_AUTH_TOKEN = "";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// dynamic import so @/infra/db is created after DATABASE_URL is set
beforeAll(async () => (await import("../helpers/db")).migrateTestDb());
beforeEach(async () => (await import("../helpers/db")).resetDb());
