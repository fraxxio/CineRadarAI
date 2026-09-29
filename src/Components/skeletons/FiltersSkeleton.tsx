import { Skeleton } from "../ui/Skeleton";

export function FiltersSkeleton() {
  return (
    <aside className="sticky top-20 mt-[4rem] h-fit w-[30%] rounded-sm border border-border-clr bg-primary-bg px-4 py-8 max-lg:static max-lg:w-full">
      <h1 className="pb-12 text-center text-xl font-semibold">
        Apply filters to search
      </h1>
      <div className="flex w-full flex-col gap-4 max-lg:items-center">
        <Skeleton className="h-[50px] w-full" />
        <Skeleton className="h-[42px] w-full max-lg:w-[12rem] max-[480px]:w-full" />
        <Skeleton className="h-[42px] w-full max-lg:w-[12rem] max-[480px]:w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-11 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col items-center gap-2 pt-4 max-[480px]:w-full">
          <Skeleton className="h-10 w-full" />
          <p className="text-lg font-medium">or</p>
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </aside>
  );
}
