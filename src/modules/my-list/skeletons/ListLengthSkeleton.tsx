import { Skeleton } from "@/shared/ui/Skeleton";

export function ListLengthSkeleton() {
  return (
    <div className="flex items-center gap-2 text-lg">
      Length: <Skeleton className="h-5 w-8" />
    </div>
  );
}
