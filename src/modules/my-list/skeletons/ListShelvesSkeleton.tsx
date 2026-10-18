import { Skeleton } from "@/shared/ui/Skeleton";
import { ListRowsSkeleton } from "./ListRowsSkeleton";

// mirrors ListShelves: two shelves, each a heading and a few rows
export function ListShelvesSkeleton() {
  return (
    <div className="border-t border-border-clr">
      {[0, 1].map((shelf) => (
        <div
          key={shelf}
          className="border-b border-border-clr last:border-none"
        >
          <div className="px-8 pb-3 pt-5 max-[480px]:px-4">
            <Skeleton className="h-7 w-40" />
          </div>
          <ListRowsSkeleton rows={3} />
        </div>
      ))}
    </div>
  );
}
