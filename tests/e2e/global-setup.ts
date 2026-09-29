import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  MIGRATIONS_FOLDER,
  generateTestMigrations,
} from "../helpers/migrations";
import { BASE_URL, DB_URL } from "./env";

const WARM_UP_PAGES = [
  "/",
  "/search",
  "/about",
  "/signin",
  "/search/movie/550",
  "/search/tv/1399",
];

async function waitForDb(client: ReturnType<typeof createClient>) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      await client.execute("select 1");
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// Migrations are regenerated (new file name + hash) on every run, so a reused DB
// would replay them on top of existing tables. Start from an empty schema instead.
async function dropAllTables(client: ReturnType<typeof createClient>) {
  const { rows } = await client.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like 'libsql_%' and name not like '_litestream%'",
  );
  let pending = rows.map((r) => String(r.name));
  // parents can't be dropped while children still reference them; retry until done
  while (pending.length > 0) {
    const failed: string[] = [];
    for (const table of pending) {
      await client
        .execute(`drop table "${table}"`)
        .catch(() => failed.push(table));
    }
    if (failed.length === pending.length) {
      throw new Error(`Could not drop tables: ${failed.join(", ")}`);
    }
    pending = failed;
  }
}

export default async function globalSetup() {
  generateTestMigrations();

  const client = createClient({ url: DB_URL });
  try {
    await waitForDb(client);
    await dropAllTables(client);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    client.close();
  }

  // `next dev` compiles routes on first hit; do it here, before the timed tests start
  if (!process.env.CI) {
    for (const page of WARM_UP_PAGES) {
      await fetch(`${BASE_URL}${page}`).catch(() => undefined);
    }
  }
}
