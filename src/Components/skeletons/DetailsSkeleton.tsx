import { Skeleton } from "../ui/Skeleton";

export function DetailsSkeleton() {
  return (
    <section className="mt-20 flex gap-32 rounded-sm border border-border-clr bg-primary-bg max-[950px]:flex-col max-[950px]:gap-4">
      <Skeleton className="aspect-[2/3] w-[30%] shrink-0 self-start rounded-none border-b border-border-clr max-[950px]:aspect-auto max-[950px]:h-[30rem] max-[950px]:w-full" />
      <div className="my-auto w-full p-8">
        <div className="flex items-end justify-between gap-4 max-[930px]:flex-col max-[930px]:items-start">
          <Skeleton className="h-9 w-2/3 max-[930px]:h-7" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full sm:hidden" />
          <Skeleton className="h-5 w-full sm:hidden" />
          <Skeleton className="h-5 w-full sm:hidden" />
          <Skeleton className="h-5 w-full sm:hidden" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className="flex flex-wrap gap-2 pt-4">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
        <div className="flex flex-wrap justify-between gap-4 py-8">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-6 w-36" />
        <div className="flex flex-wrap items-center gap-5 pt-8">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="mt-8 h-10 w-full" />
      </div>
    </section>
  );
}
