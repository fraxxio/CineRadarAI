import { Skeleton } from "@/shared/ui/Skeleton";

export function TrailerSkeleton() {
  return (
    <section
      id="trailer"
      className="relative mt-20 scroll-mt-20 rounded-sm border border-border-clr bg-primary-bg py-4"
    >
      <h1 className="pb-8 text-center text-3xl font-medium">Trailer</h1>
      <div className="aspect-video w-full px-4">
        <Skeleton className="h-full w-full" />
      </div>
    </section>
  );
}
