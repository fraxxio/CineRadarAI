import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { PageBtn } from "./PageBtn";
import Link from "next/link";
import { getNewURL } from "@/lib/utils";

type PagesProps = {
  totalResults: number;
  totalPages: number;
  page: string | undefined;
  filterValues: object;
};

export const Pages = ({
  page = "1",
  totalResults,
  totalPages,
  filterValues,
}: PagesProps) => {
  const maxPages = totalPages >= 500 ? 500 : totalPages;
  const canPrevious = Number(page) > 1 ? false : true;
  const canNext = maxPages > 1 && Number(page) < 500 ? false : true;
  const nextIterations =
    Number(page) === 500 || Number(page) === maxPages
      ? 0
      : Math.min(maxPages - 1, 4);
  const prevIterations = Number(page) === 1 ? 0 : Math.min(Number(page) - 1, 4);

  return (
    <div className="col-span-full flex items-end justify-center gap-8 pt-8 max-[700px]:flex-col max-[700px]:items-center">
      <Link
        href={getNewURL({
          newPage: Number(page) - 1,
          filterValues,
        })}
      >
        <button
          disabled={canPrevious}
          type="submit"
          name="page"
          value={Number(page) - 1}
          className="flex items-center rounded-sm border border-border-clr bg-primary-bg py-1 pr-2 duration-300 hover:border-primary-text disabled:bg-dark-bg disabled:text-slate-500 disabled:hover:border-border-clr"
        >
          <ChevronLeft /> Previous
        </button>
      </Link>
      <div className="flex gap-4">
        {prevIterations > 0 && (
          <div className="flex gap-2">
            {Array.from({ length: prevIterations }, (_, index) => (
              <PageBtn
                key={index}
                value={Number(page) - index - 1}
                filterValues={filterValues}
              />
            )).reverse()}
          </div>
        )}
        <PageBtn current value={Number(page)} filterValues={filterValues} />
        <div className="flex gap-2">
          {Array.from({ length: nextIterations }, (_, index) => (
            <PageBtn
              key={index}
              value={Number(page) + 1 + index}
              filterValues={filterValues}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <p className="font-semibold">...</p>
          <PageBtn value={maxPages} filterValues={filterValues} />
        </div>
      </div>
      <Link
        href={getNewURL({
          newPage: Number(page) + 1,
          filterValues,
        })}
      >
        <button
          disabled={canNext}
          className="flex items-center rounded-sm border border-border-clr bg-primary-bg py-1 pl-2 duration-300 hover:border-primary-text disabled:bg-dark-bg disabled:text-slate-500 disabled:hover:border-border-clr"
        >
          Next <ChevronRight />
        </button>
      </Link>
      <p className="text-sm">
        <b>Page: </b> {Number(page)} / {maxPages}
      </p>
    </div>
  );
};
