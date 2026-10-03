import { count, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { lists } from "../../../src/modules/my-list/schema";
import { sessions, users } from "../../../src/infra/db/schema/users";

export type ListMovie = NonNullable<typeof lists.$inferSelect.movies>[number];

export const seedList = (
  db: LibSQLDatabase,
  userId: string,
  movies: ListMovie[] | null,
) => db.insert(lists).values({ userId, movies });

export async function getMovies(db: LibSQLDatabase, userId: string) {
  const rows = await db
    .select({ movies: lists.movies })
    .from(lists)
    .where(eq(lists.userId, userId));
  return rows[0]?.movies; // undefined = no row
}

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
