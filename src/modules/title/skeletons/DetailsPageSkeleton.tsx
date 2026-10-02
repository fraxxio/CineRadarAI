import { DetailsSkeleton } from "./DetailsSkeleton";
import { GallerySkeleton } from "./GallerySkeleton";
import { ReviewsSkeleton } from "./ReviewsSkeleton";
import { TrailerSkeleton } from "./TrailerSkeleton";

export function DetailsPageSkeleton() {
  return (
    <main className="container">
      <DetailsSkeleton />
      <TrailerSkeleton />
      <GallerySkeleton />
      <ReviewsSkeleton />
    </main>
  );
}
