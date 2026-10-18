import Link from "next/link";
import { listHref, pageCount, type ListView } from "../view";

type ListPagerProps = {
  view: ListView;
  total: number; // the rows in the view, across all pages
};

const itemClassName =
  "flex h-9 min-w-9 items-center justify-center rounded-md border border-border-clr px-3";
const linkClassName = `${itemClassName} bg-dark-bg duration-200 hover:bg-primary-text hover:text-dark-bg`;

// the first, the last and the current page ±1, with "gap" where pages are skipped
export function pagerItems(current: number, pages: number) {
  const shown = [1, current - 1, current, current + 1, pages]
    .filter(
      (page, index, all) =>
        page >= 1 && page <= pages && all.indexOf(page) === index,
    )
    .sort((a, b) => a - b);
  return shown.flatMap((page, index) =>
    index > 0 && page - shown[index - 1] > 1
      ? (["gap", page] as const)
      : [page],
  );
}

export default function ListPager({ view, total }: ListPagerProps) {
  const pages = pageCount(total);
  if (pages <= 1) return null;
  const current = view.page;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-2 border-t border-border-clr p-4"
    >
      {current > 1 ? (
        <Link
          href={listHref(view, { page: current - 1 })}
          className={linkClassName}
        >
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${itemClassName} opacity-50`}>
          Previous
        </span>
      )}
      {pagerItems(current, pages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={listHref(view, { page: item })}
            aria-label={`Page ${item}`}
            aria-current={item === current ? "page" : undefined}
            className={
              item === current
                ? `${itemClassName} bg-primary-text text-dark-bg`
                : linkClassName
            }
          >
            {item}
          </Link>
        ),
      )}
      {current < pages ? (
        <Link
          href={listHref(view, { page: current + 1 })}
          className={linkClassName}
        >
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={`${itemClassName} opacity-50`}>
          Next
        </span>
      )}
    </nav>
  );
}
