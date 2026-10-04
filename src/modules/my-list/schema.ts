import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "@/infra/db/schema/users";
import type { StoredEntry } from "./entry";

export const lists = sqliteTable("lists", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  movies: blob("movies", { mode: "json" }).$type<StoredEntry[]>(),
});
