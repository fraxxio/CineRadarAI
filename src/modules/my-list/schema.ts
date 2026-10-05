import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
// type-only: the e2e helpers import this file and mustn't pull in @/infra/tmdb
import type { MediaType } from "@/infra/tmdb";
import { users } from "@/infra/db/schema/users";

// one row per entry; a user's list is their rows in id order
export const listEntries = sqliteTable(
  "list_entries",
  {
    // autoincrement: ids are never reused, so a re-added entry goes to the end
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movieId", { mode: "number" }).notNull(),
    type: text("type").$type<MediaType>().notNull(),
    name: text("name").notNull(),
    image: text("image").notNull(), // "" when TMDB has no poster or backdrop
    status: text("status").notNull(), // not ListStatus: see StoredEntry
    rating: integer("rating", { mode: "number" }).notNull(), // 0 = not rated
  },
  // movie and TV ids can collide, so the key includes the type
  (t) => ({ entryKey: unique().on(t.userId, t.movieId, t.type) }),
);

// a row without its id and owner: the StoredEntry shape
export const entryColumns = {
  movieId: listEntries.movieId,
  type: listEntries.type,
  name: listEntries.name,
  image: listEntries.image,
  status: listEntries.status,
  rating: listEntries.rating,
};
