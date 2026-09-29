import { Skeleton } from "../ui/Skeleton";
import { MovieCardSkeleton } from "./MovieCardSkeleton";

export function SearchResultsSkeleton() {
  return (
    <section
      data-testid="search-results-skeleton"
      className="w-full max-w-[70%] max-lg:max-w-full"
    >
      <div className="pb-8">
        <Skeleton className="mx-auto h-8 w-1/2 max-[450px]:w-3/4" />
      </div>
      <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-2 max-[450px]:grid-cols-1">
        {Array.from({ length: 9 }, (_, index) => (
          <MovieCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
