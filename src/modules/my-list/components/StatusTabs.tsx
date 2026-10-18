import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { STATUS_TABS, listHref, type ListCounts, type ListView } from "../view";

type StatusTabsProps = {
  view: ListView;
  counts: ListCounts; // under the current type
};

export default function StatusTabs({ view, counts }: StatusTabsProps) {
  // "Other" only exists for legacy rows, but an open tab stays reachable
  const tabs = STATUS_TABS.filter(
    ({ slug }) => slug !== "other" || counts.other > 0 || view.status === slug,
  );

  return (
    <nav aria-label="Status" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-8 max-[480px]:px-4">
        {tabs.map(({ slug, label }) => {
          const isActive = view.status === slug;
          return (
            <li key={slug}>
              <Link
                href={listHref(view, { status: slug })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 duration-200",
                  isActive
                    ? "border-primary-text text-primary-text"
                    : "border-transparent hover:border-border-clr hover:text-primary-text",
                )}
              >
                {label}{" "}
                <span className="rounded-full bg-dark-bg px-2 py-0.5 text-xs">
                  {counts[slug]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
