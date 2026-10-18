import Link from "next/link";
import ListRow, { PRIORITY_ROWS } from "./ListRow";
import type { StoredEntry } from "../entry";
import {
  SHELF_SIZE,
  STATUS_TABS,
  listHref,
  shelfStatuses,
  type ListCounts,
  type ListView,
  type ShelfStatus,
} from "../view";

// the first rows of each non-empty status, read in parallel
export type ShelfEntries = Partial<Record<ShelfStatus, StoredEntry[]>>;

type ListShelvesProps = {
  view: ListView;
  counts: ListCounts; // under the current type
  // the page starts the reads and streams the shelves in a Suspense boundary
  shelves: Promise<ShelfEntries>;
};

const labelOf = (status: ShelfStatus) =>
  STATUS_TABS.find(({ slug }) => slug === status)!.label;

export default async function ListShelves({
  view,
  counts,
  shelves,
}: ListShelvesProps) {
  const entries = await shelves;
  // a shelf can be read empty if its titles moved since the counts were read
  const shown = shelfStatuses(counts).filter(
    (status) => entries[status]?.length,
  );
  // the rows before each shelf, so only the first rows overall load eagerly
  const offsets = shown.map((_, index) =>
    shown
      .slice(0, index)
      .reduce((sum, status) => sum + entries[status]!.length, 0),
  );

  return (
    <div className="border-t border-border-clr">
      {shown.map((status, shelfIndex) => {
        const headingId = `shelf-${status}`;
        const count = counts[status];
        return (
          <section
            key={status}
            aria-labelledby={headingId}
            className="border-b border-border-clr last:border-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-8 pb-3 pt-5 max-[480px]:px-4">
              <h2
                id={headingId}
                className="flex items-center gap-2 text-xl font-medium"
              >
                {labelOf(status)}{" "}
                <span className="rounded-full bg-dark-bg px-2 py-0.5 text-xs font-normal">
                  {count}
                </span>
              </h2>
              {count > SHELF_SIZE && (
                <Link
                  href={listHref(view, { status })}
                  className="text-sm text-secondary-text underline hover:text-primary-text hover:no-underline"
                >
                  See all ({count})
                </Link>
              )}
            </div>
            <ul
              aria-labelledby={headingId}
              className="border-t border-border-clr"
            >
              {entries[status]!.map((movie, index) => (
                // movie and TV ids can collide
                <ListRow
                  key={`${movie.type}-${movie.movieId}`}
                  movie={movie}
                  tab="all"
                  priority={offsets[shelfIndex] + index < PRIORITY_ROWS}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
