import { cache } from "react";
import { db } from "@/infra/db";
import { lists } from "@/infra/db/schema/lists";
import { eq } from "drizzle-orm";
import type { ListEntry } from "./entry";

export const getListMovies = cache(async (userId: string) => {
  const result = await db
    .select({
      movies: lists.movies,
    })
    .from(lists)
    .where(eq(lists.userId, userId))
    .execute();

  return (result[0]?.movies || []) as ListEntry[];
});
