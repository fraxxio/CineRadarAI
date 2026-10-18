import Link from "next/link";
import { cn } from "@/shared/lib/cn";

type FilterLinkProps = {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
};

type FilterGroupProps = {
  id: string; // labels the group
  label: string;
  children: React.ReactNode;
};

// the active one stays a focusable link, marked with aria-current
export default function FilterLink({
  href,
  isActive,
  children,
}: FilterLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        // narrow screens wrap the labels, so three segments fit at 320px
        "border-r border-border-clr px-3 py-1.5 text-center text-sm duration-200 last:border-r-0 max-[480px]:px-2",
        isActive
          ? "bg-primary-text text-dark-bg"
          : "bg-dark-bg hover:bg-primary-text hover:text-dark-bg",
      )}
    >
      {children}
    </Link>
  );
}

// a segmented row of FilterLinks with a visible label
export function FilterGroup({ id, label, children }: FilterGroupProps) {
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="flex flex-wrap items-center gap-2"
    >
      <span id={id} className="text-sm text-secondary-text">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-md border border-border-clr">
        {children}
      </div>
    </div>
  );
}
