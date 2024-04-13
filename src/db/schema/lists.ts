import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const lists = sqliteTable("lists", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  movies: blob("movies", { mode: "json" }).$type<
    Array<{ image: string; name: string; movieId: number }>
  >(),
});
