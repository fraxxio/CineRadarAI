import { ListRowsSkeleton } from "@/modules/my-list";
import { Skeleton } from "@/shared/ui/Skeleton";

const tabWidths = ["w-14", "w-28", "w-40", "w-32"];
const filterGroups = [
  { label: "Type", widths: ["w-10", "w-16", "w-10"] },
  { label: "Sort by", widths: ["w-28", "w-28", "w-32"] },
];

export default function Loading() {
  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="px-8 pb-4 pt-8 max-[480px]:px-4">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="mt-2 h-5 w-16" />
        </div>
        <div className="flex gap-1 overflow-hidden px-8 max-[480px]:px-4">
          {tabWidths.map((width, index) => (
            <div key={index} className="px-3 py-3">
              <Skeleton className={`h-6 ${width}`} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-clr px-8 py-4 max-[480px]:px-4">
          {filterGroups.map(({ label, widths }) => (
            <div key={label} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-secondary-text">{label}</span>
              <div className="flex gap-px">
                {widths.map((width, index) => (
                  <Skeleton
                    key={index}
                    className={`h-[34px] rounded-none ${width}`}
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
