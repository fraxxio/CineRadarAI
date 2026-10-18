import ListCard from "./ListCard";
import type { StoredEntry } from "../entry";
import { PAGE_SIZE } from "../view";

type ListProps = {
  // the page starts the read and streams the rows in a Suspense boundary
  entries: Promise<StoredEntry[]>;
  page: number;
};

// the rows in the view, from the counts query
export function ListLength({ length }: { length: number }) {
  return <p className="text-lg">Length: {length}</p>;
}

export default async function MyListItems({ entries, page }: ListProps) {
  const movies = await entries;
  // numbering continues across pages
  const offset = (page - 1) * PAGE_SIZE;

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
              index={offset + index}
            />
          );
        })
      )}
    </div>
  );
}
