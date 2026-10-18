import { Skeleton } from "@/shared/ui/Skeleton";

// mirrors ListRow: the status and rating selects and the remove button sit on
// the right, and wrap below the text under 480px
export function ListRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-t border-border-clr">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-clr px-8 py-2.5 last:border-none max-[480px]:items-start max-[480px]:gap-x-3 max-[480px]:px-4"
        >
          <Skeleton className="aspect-video w-40 shrink-0 max-[480px]:w-28" />
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-2 max-[480px]:basis-0">
            <Skeleton className="h-6 w-56 max-w-full max-[480px]:w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="ml-auto flex shrink-0 gap-2 max-[480px]:basis-full max-[480px]:flex-wrap">
            <Skeleton className="h-10 w-40 rounded-md max-[480px]:w-full" />
            <Skeleton className="h-10 w-28 rounded-md max-[480px]:min-w-0 max-[480px]:flex-1" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
