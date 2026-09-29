import { cache } from "react";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";

export type ListSortValues = {
  type: "movie" | "tv" | "both";
  status: "watching" | "completed" | "planning" | "all";
  rating: "asc" | "desc";
};

type ListMovie = {
  image: string;
  name: string;
  movieId: number;
  rating: number;
  status: string;
  type: string;
};

export const getListMovies = cache(async (userId: string) => {
  const result = await db
    .select({
      movies: lists.movies,
    })
    .from(lists)
    .where(eq(lists.userId, userId))
    .execute();

  return result[0]?.movies || [];
});

export const filteredMovies = (
  moviesArray: ListMovie[],
  { type, status, rating }: ListSortValues,
) => {
  if (type !== "both") {
    moviesArray = moviesArray.filter((movie) => movie.type === type);
  }
  if (status === "completed") {
    moviesArray = moviesArray.filter((movie) => movie.status === "Completed");
  } else if (status === "planning") {
    moviesArray = moviesArray.filter(
      (movie) => movie.status === "Planning to watch",
    );
  } else if (status === "watching") {
    moviesArray = moviesArray.filter((movie) => movie.status === "Watching");
  }

  const compare = (a: { rating: number }, b: { rating: number }) => {
    if (rating === "asc") {
      return a.rating - b.rating;
    } else {
      return b.rating - a.rating;
    }
  };
  // copy so the cached array isn't sorted in place
  return [...moviesArray].sort(compare);
};
