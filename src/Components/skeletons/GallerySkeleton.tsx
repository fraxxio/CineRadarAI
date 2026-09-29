import { Skeleton } from "../ui/Skeleton";

export function GallerySkeleton() {
  return (
    <section className="mt-20 rounded-sm border border-border-clr bg-primary-bg py-4">
      <h1 className="pb-8 text-center text-3xl font-medium">Gallery</h1>
      <div className="grid grid-cols-3 place-items-center gap-4 px-8 pb-4 max-[980px]:grid-cols-2 max-md:grid-cols-1 max-sm:px-2">
        {Array.from({ length: 9 }, (_, index) => (
          <Skeleton key={index} className="aspect-video w-full" />
        ))}
      </div>
    </section>
  );
}
