import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const lists = sqliteTable("lists", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .notNull()
    .references(() => users.id),
  movies: blob("movies", { mode: "json" }).$type<string[]>(),
});
