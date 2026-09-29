import { Skeleton } from "../ui/Skeleton";

export function ReviewsSkeleton() {
  return (
    <section
      id="reviews"
      className="my-10 scroll-mt-20 rounded-sm border border-border-clr bg-primary-bg px-16 py-4 max-[550px]:px-4"
    >
      <h1 className="pb-8 text-center text-3xl font-medium">Reviews</h1>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="border-b border-border-clr p-4 last:border-none"
        >
          <div className="flex items-end gap-2 max-md:flex-col max-md:items-start">
            <Skeleton className="h-[70px] w-[70px] rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-7 w-40" />
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      ))}
    </section>
  );
}
