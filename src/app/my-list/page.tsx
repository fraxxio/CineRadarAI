import ListCard from "@/Components/ui/ListCard";
import ListSortBtn from "@/Components/ui/ListSortBtn";
import { auth } from "@/auth";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";
import { SortList } from "../actions";

type filteredMoviesProps = {
  type: "movie" | "tv" | "both";
  status: "watching" | "completed" | "planning" | "all";
  rating: "asc" | "desc";
  moviesArray: {
    image: string;
    name: string;
    movieId: number;
    rating: number;
    status: string;
    type: string;
  }[];
};

type UrlParams = {
  searchParams: {
    type: "movie" | "tv" | "both";
    status: "watching" | "completed" | "planning" | "all";
    rating: "asc" | "desc";
  };
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

export default async function page({
  searchParams: { type = "both", status = "all", rating = "desc" },
}: UrlParams) {
  const session = await auth();
  if (session?.user === undefined) {
    redirect("/signin");
  }
  const safeSession = session!;

  const result = await db
    .select({
      movies: lists.movies,
    })
    .from(lists)
    .where(eq(lists.userId, safeSession.user.id))
    .execute();

  const moviesArray = result[0]?.movies || [];
  const movies = filteredMovies({ moviesArray, status, type, rating });

  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="relative flex items-center justify-between p-8 pb-12 ">
          <form
            action={async () => {
              "use server";
              redirect("/my-list");
            }}
          >
            <ListSortBtn type="submit" withIcon>
              <RotateCcw size={18} />
              Refresh list
            </ListSortBtn>
          </form>
          <h1 className="text-center text-3xl">
            <b>{safeSession.user.name}</b> movie and TV show list.
          </h1>
          <p className="text-lg">Length: {movies.length}</p>
        </div>
        <form
          action={SortList}
          className="flex items-center justify-center gap-8 pb-8"
        >
          <input type="hidden" name="currRating" value={rating} />
          <input type="hidden" name="currType" value={type} />
          <input type="hidden" name="currStatus" value={status} />
          <div>
            <p className="pb-2 text-center text-lg font-medium">
              Sort by rating:
            </p>
            <ListSortBtn value="asc" name="rating" isChecked={rating === "asc"}>
              Ascending
            </ListSortBtn>
            <ListSortBtn
              value="desc"
              name="rating"
              isChecked={rating === "desc"}
            >
              Descending
            </ListSortBtn>
          </div>
          <div>
            <p className="pb-2 text-center text-lg font-medium">Type:</p>
            <ListSortBtn value="tv" name="type" isChecked={type === "tv"}>
              TV shows
            </ListSortBtn>
            <ListSortBtn value="movie" name="type" isChecked={type === "movie"}>
              Movies
            </ListSortBtn>
            <ListSortBtn value="both" name="type" isChecked={type === "both"}>
              Both
            </ListSortBtn>
          </div>
          <div>
            <p className="pb-2 text-center text-lg font-medium">Show only:</p>
            <ListSortBtn
              value="completed"
              name="status"
              isChecked={status === "completed"}
            >
              Completed
            </ListSortBtn>
            <ListSortBtn
              value="planning"
              name="status"
              isChecked={status === "planning"}
            >
              Planning to watch
            </ListSortBtn>
            <ListSortBtn
              value="watching"
              name="status"
              isChecked={status === "watching"}
            >
              Watching
            </ListSortBtn>
            <ListSortBtn value="all" name="status" isChecked={status === "all"}>
              All
            </ListSortBtn>
          </div>
        </form>
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
                  user={safeSession.user}
                />
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
