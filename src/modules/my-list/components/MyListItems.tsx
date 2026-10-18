import ListRow from "./ListRow";
import type { StoredEntry } from "../entry";

type ListProps = {
  // the page starts the read and streams the rows in a Suspense boundary;
  // an empty view shows ListEmpty instead
  entries: Promise<StoredEntry[]>;
};

// rows whose images load eagerly, roughly the first screen
const PRIORITY_ROWS = 3;

export default async function MyListItems({ entries }: ListProps) {
  const movies = await entries;

  return (
    <ul aria-label="Titles" className="border-t border-border-clr">
      {movies.map((movie, index) => (
        // movie and TV ids can collide
        <ListRow
          key={`${movie.type}-${movie.movieId}`}
          movie={movie}
          priority={index < PRIORITY_ROWS}
        />
      ))}
    </ul>
  );
}
