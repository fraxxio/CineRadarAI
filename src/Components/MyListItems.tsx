import { cache } from "react";
import ListCard from "./ui/ListCard";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";

export type ListSortValues = {
  type: "movie" | "tv" | "both";
  status: "watching" | "completed" | "planning" | "all";
  rating: "asc" | "desc";
};

type filteredMoviesProps = ListSortValues & {
  moviesArray: {
    image: string;
    name: string;
    movieId: number;
    rating: number;
    status: string;
    type: string;
  }[];
};

const filteredMovies = ({
  type,
  status,
  rating,
  moviesArray,
}: filteredMoviesProps) => {
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
  return moviesArray.sort(compare);
};

const getListMovies = cache(
  async (
    userId: string,
    type: ListSortValues["type"],
    status: ListSortValues["status"],
    rating: ListSortValues["rating"],
  ) => {
    const result = await db
      .select({
        movies: lists.movies,
      })
      .from(lists)
      .where(eq(lists.userId, userId))
      .execute();

    const moviesArray = result[0]?.movies || [];
    return filteredMovies({ moviesArray, status, type, rating });
  },
);

export async function ListLength({ type, status, rating }: ListSortValues) {
  const session = (await getSession())!;
  const movies = await getListMovies(session.user.id, type, status, rating);

  return <p className="text-lg">Length: {movies.length}</p>;
}

export default async function MyListItems({
  type,
  status,
  rating,
}: ListSortValues) {
  const session = (await getSession())!;
  const movies = await getListMovies(session.user.id, type, status, rating);

  return (
    <div className="border-t border-border-clr">
      {movies.length === 0 ? (
        <div className="border-b border-border-clr py-4 text-center font-medium last:border-none">
          Your list is empty.
        </div>
      ) : (
        movies.map((movie, index) => {
          return (
            <ListCard
              key={movie.movieId}
              movie={movie}
              index={index}
              user={session.user}
            />
          );
        })
      )}
    </div>
  );
}
