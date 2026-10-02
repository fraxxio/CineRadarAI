import { Skeleton } from "@/shared/ui/Skeleton";

export default function Loading() {
  return (
    <main className="container py-10">
      <div className="flex flex-col gap-4 rounded-sm border border-border-clr bg-primary-bg p-8">
        <Skeleton className="mx-auto h-8 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </main>
  );
}
