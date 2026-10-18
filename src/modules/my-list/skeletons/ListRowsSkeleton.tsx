import { Skeleton } from "@/shared/ui/Skeleton";

// mirrors ListRow
export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-t border-border-clr">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border-clr px-8 py-2.5 last:border-none max-[480px]:items-start max-[480px]:gap-3 max-[480px]:px-4"
        >
          <Skeleton className="aspect-video w-40 shrink-0 max-[480px]:w-28" />
          <div className="flex min-w-0 flex-grow items-center justify-between gap-4 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-56 max-w-full max-[480px]:w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-10 w-10 rounded-md" />
              <Skeleton className="h-10 w-10 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
