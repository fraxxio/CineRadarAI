import { asc, count, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  entryColumns,
  listEntries,
} from "../../../src/modules/my-list/schema";
import { sessions, users } from "../../../src/infra/db/schema/users";

export type ListMovie = Omit<typeof listEntries.$inferSelect, "id" | "userId">;

// inserts the entries in array order, so their ids keep that order
export async function seedList(
  db: LibSQLDatabase,
  userId: string,
  entries: ListMovie[],
) {
  if (entries.length === 0) return; // drizzle rejects an empty values()
  await db.insert(listEntries).values(entries.map((e) => ({ userId, ...e })));
}

// the user's entries in list order; [] when they have none
export const getMovies = (db: LibSQLDatabase, userId: string) =>
  db
    .select(entryColumns)
    .from(listEntries)
    .where(eq(listEntries.userId, userId))
    .orderBy(asc(listEntries.id));

export async function userExists(db: LibSQLDatabase, id: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id));
  return rows.length > 0;
}

export async function sessionCount(db: LibSQLDatabase, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  return row.n;
}
