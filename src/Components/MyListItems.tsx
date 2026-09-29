import ListCard from "./ui/ListCard";
import { getSession } from "@/lib/session";
import { ListSortValues, filteredMovies, getListMovies } from "@/lib/myList";

export async function ListLength(sortValues: ListSortValues) {
  const session = (await getSession())!;
  const movies = filteredMovies(
    await getListMovies(session.user.id),
    sortValues,
  );

  return <p className="text-lg">Length: {movies.length}</p>;
}

export default async function MyListItems(sortValues: ListSortValues) {
  const session = (await getSession())!;
  const movies = filteredMovies(
    await getListMovies(session.user.id),
    sortValues,
  );

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
