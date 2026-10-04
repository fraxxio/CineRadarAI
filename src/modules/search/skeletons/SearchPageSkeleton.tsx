import { FiltersSkeleton } from "./FiltersSkeleton";
import { SearchResultsSkeleton } from "./SearchResultsSkeleton";

export function SearchPageSkeleton() {
  return (
    <main className="container flex gap-12 py-20 max-lg:flex-col">
      <FiltersSkeleton />
      <SearchResultsSkeleton />
    </main>
  );
}
