import { ListLengthSkeleton } from "@/Components/skeletons/ListLengthSkeleton";
import { ListRowsSkeleton } from "@/Components/skeletons/ListRowsSkeleton";
import { Skeleton } from "@/Components/ui/Skeleton";

const sortGroups = [
  { label: "Sort by rating:", widths: ["w-24", "w-28"] },
  { label: "Type:", widths: ["w-20", "w-16", "w-12"] },
  { label: "Show only:", widths: ["w-24", "w-36", "w-20", "w-10"] },
];

export default function Loading() {
  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="relative flex items-center justify-between p-8 pb-12 max-[1070px]:flex-col max-[1070px]:gap-4">
          <Skeleton className="h-[34px] w-32 rounded-md" />
          <Skeleton className="h-9 w-[28rem] max-w-full" />
          <ListLengthSkeleton />
        </div>
        <div className="flex items-center justify-center gap-8 pb-8 max-[1070px]:flex-col">
          {sortGroups.map(({ label, widths }) => (
            <div key={label}>
              <p className="pb-2 text-center text-lg font-medium">{label}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {widths.map((width, index) => (
                  <Skeleton
                    key={index}
                    className={`h-[34px] rounded-md ${width}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <ListRowsSkeleton />
      </section>
    </main>
  );
}
