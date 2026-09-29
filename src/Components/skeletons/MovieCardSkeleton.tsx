import { Skeleton } from "../ui/Skeleton";

export function MovieCardSkeleton() {
  return (
    <div className="w-full border border-border-clr bg-primary-bg">
      <Skeleton className="h-[30rem] w-full rounded-none border-b border-border-clr" />
      <div className="flex h-[6.5rem] flex-col justify-between p-2">
        <div className="flex justify-between">
          <Skeleton className="h-7 w-[55%]" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}
