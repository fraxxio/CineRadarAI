import ListCard from "./ListCard";
import type { StoredEntry } from "../entry";
import { viewEntries, type ListView } from "../view";

type ListProps = {
  // the page starts the read once; each component awaits it in its own Suspense boundary
  entries: Promise<StoredEntry[]>;
  view: ListView;
};

export async function ListLength({ entries, view }: ListProps) {
  const movies = viewEntries(await entries, view);

  return <p className="text-lg">Length: {movies.length}</p>;
}

export default async function MyListItems({ entries, view }: ListProps) {
  const movies = viewEntries(await entries, view);

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
