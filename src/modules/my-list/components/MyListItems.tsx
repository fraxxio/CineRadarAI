import ListCard from "./ListCard";
import type { StoredEntry } from "../entry";
import { PAGE_SIZE } from "../view";

type ListProps = {
  // the page starts the read and streams the rows in a Suspense boundary;
  // an empty view shows ListEmpty instead
  entries: Promise<StoredEntry[]>;
  page: number;
};

export default async function MyListItems({ entries, page }: ListProps) {
  const movies = await entries;
  // numbering continues across pages
  const offset = (page - 1) * PAGE_SIZE;

  return (
    <div className="border-t border-border-clr">
      {movies.map((movie, index) => {
        // movie and TV ids can collide
        return (
          <ListCard
            key={`${movie.type}-${movie.movieId}`}
            movie={movie}
            index={offset + index}
          />
        );
      })}
    </div>
  );
}
