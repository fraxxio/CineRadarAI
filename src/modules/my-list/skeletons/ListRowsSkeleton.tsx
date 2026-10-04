import { Skeleton } from "@/shared/ui/Skeleton";

export function ListRowsSkeleton() {
  return (
    <div className="border-t border-border-clr">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="flex gap-8 border-b border-border-clr last:border-none max-[480px]:flex-col max-[480px]:gap-0"
        >
          <Skeleton className="h-[225px] w-[400px] shrink-0 rounded-none border-r border-border-clr max-[840px]:w-[250px] max-[567px]:w-[180px] max-[480px]:w-full max-[480px]:border-b max-[480px]:border-r-0" />
          <div className="flex flex-grow justify-between py-4 pr-8 max-[610px]:flex-col max-[480px]:px-4">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-56 max-[840px]:w-40" />
              <Skeleton className="mt-2 h-6 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-6 h-6 w-40" />
            </div>
            <div className="flex flex-col items-end justify-between gap-4 max-[610px]:flex-row-reverse max-[610px]:pt-4">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
