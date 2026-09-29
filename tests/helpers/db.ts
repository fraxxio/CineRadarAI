import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema/users";
import { lists } from "@/db/schema/lists";
import { makeMovie } from "./factories";
import { MIGRATIONS_FOLDER } from "./migrations";

export type ListMovie = NonNullable<typeof lists.$inferSelect.movies>[number];

export const migrateTestDb = () =>
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

export async function resetDb() {
  const triggers = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'trigger' and name like 'force_fail_%'`,
  );
  for (const t of triggers) await db.run(sql.raw(`drop trigger "${t.name}"`));
  await db.delete(lists);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(users);
}

export async function seedUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const id = overrides.id ?? crypto.randomUUID();
  const user = {
    id,
    name: "Test User",
    email: `${id}@test.local`,
    image: "/CineRadarLogo.png",
    ...overrides,
  };
  await db.insert(users).values(user);
  return user as Required<typeof user>;
}

export const seedList = (userId: string, movies: ListMovie[] | null) =>
  db.insert(lists).values({ userId, movies });

export async function getMovies(userId: string) {
  const rows = await db
    .select({ movies: lists.movies })
    .from(lists)
    .where(eq(lists.userId, userId));
  return rows[0]?.movies; // undefined = no row
}

// makes the next INSERT/UPDATE/DELETE on `table` fail inside SQLite (removed by resetDb)
export const forceFailure = (
  op: "INSERT" | "UPDATE" | "DELETE",
  table: string,
) =>
  db.run(
    sql.raw(
      `create trigger "force_fail_${op}_${table}" before ${op} on "${table}" begin select raise(abort, 'forced failure'); end`,
    ),
  );

// user + account + session + list row, for DeleteUser
export async function seedFullUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const user = await seedUser(overrides);
  await db.insert(accounts).values({
    userId: user.id,
    type: "oauth",
    provider: "github",
    providerAccountId: user.id,
  });
  await db.insert(sessions).values({
    sessionToken: crypto.randomUUID(),
    userId: user.id,
    expires: new Date(Date.now() + 86_400_000),
  });
  await seedList(user.id, [makeMovie()]);
  return user;
}

// row counts per table for one user
export async function userRows(userId: string) {
  const [u, a, s, l] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select().from(lists).where(eq(lists.userId, userId)),
  ]);
  return {
    users: u.length,
    accounts: a.length,
    sessions: s.length,
    lists: l.length,
  };
}
