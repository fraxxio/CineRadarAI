import ListCard from "./ListCard";
import { getSession } from "@/infra/auth/session";
import { getEntries } from "../store";
import { viewEntries, type ListView } from "../view";

export async function ListLength(view: ListView) {
  const session = (await getSession())!;
  const movies = viewEntries(await getEntries(session.user.id), view);

  return <p className="text-lg">Length: {movies.length}</p>;
}

export default async function MyListItems(view: ListView) {
  const session = (await getSession())!;
  const movies = viewEntries(await getEntries(session.user.id), view);

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
