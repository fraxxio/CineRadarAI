import ListCard from "./ListCard";
import { getSession } from "@/infra/auth/session";
import { getEntries } from "../store";
import { viewEntries, type ListView } from "../view";

// both components stream in their own Suspense boundary; getSession and
// getEntries are cached per request, so the list is read once
async function viewedEntries(view: ListView) {
  const session = (await getSession())!;
  return viewEntries(await getEntries(session.user.id), view);
}

export async function ListLength(view: ListView) {
  const movies = await viewedEntries(view);

  return <p className="text-lg">Length: {movies.length}</p>;
}

export default async function MyListItems(view: ListView) {
  const movies = await viewedEntries(view);

  return (
    <div className="border-t border-border-clr">
      {movies.length === 0 ? (
        <div className="border-b border-border-clr py-4 text-center font-medium last:border-none">
          Your list is empty.
        </div>
      ) : (
        movies.map((movie, index) => {
          // movie and TV ids can collide
          return (
            <ListCard
              key={`${movie.type}-${movie.movieId}`}
              movie={movie}
              index={index}
            />
          );
        })
      )}
    </div>
  );
}
