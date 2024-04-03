import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { PageBtn } from "./PageBtn";
import { changePage } from "@/app/actions";

type PagesProps = {
  totalResults: number;
  totalPages: number;
  page: string | undefined;
  query: string | undefined;
  language: string | undefined;
  year: string | undefined;
  adult: boolean | undefined;
  btn: string | undefined;
};

export const Pages = ({
  page = "1",
  totalResults,
  totalPages,
  query,
  language,
  year,
  adult = false,
  btn,
}: PagesProps) => {
  const canPrevious = Number(page) > 1 ? false : true;
  const canNext = totalPages > 1 ? false : true;
  const nextIterations = Math.min(totalResults, 4);
  const prevIterations = Number(page) === 1 ? 0 : Math.min(Number(page) - 1, 4);

  return (
    <form
      action={changePage}
      className="col-span-3 flex items-end justify-center gap-8 pt-8"
    >
      <input type="hidden" name="query" value={query} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="adult" value={adult.toString()} />
      <input type="hidden" name="btn" value={btn} />
      <button
        disabled={canPrevious}
        type="submit"
        name="page"
        value={Number(page) - 1}
        className="flex items-center rounded-sm border border-border-clr bg-primary-bg py-1 pr-2 duration-300 hover:border-primary-text disabled:bg-dark-bg disabled:text-slate-500 disabled:hover:border-border-clr"
      >
        <ChevronLeft /> Previous
      </button>
      <div className="flex gap-4">
        {prevIterations > 0 && (
          <div className="flex gap-2">
            {Array.from({ length: prevIterations }, (_, index) => (
              <PageBtn key={index} value={Number(page) - index - 1} />
            )).reverse()}
          </div>
        )}
        <PageBtn current value={Number(page)} />
        <div className="flex gap-2">
          {Array.from({ length: nextIterations }, (_, index) => (
            <PageBtn key={index} value={Number(page) + 1 + index} />
          ))}
        </div>

        <div className="flex gap-2">
          <p className="font-semibold">...</p>
          <PageBtn value={totalPages} />
        </div>
      </div>
      <button
        name="page"
        value={Number(page) + 1}
        disabled={canNext}
        type="submit"
        className="flex items-center rounded-sm border border-border-clr bg-primary-bg py-1 pl-2 duration-300 hover:border-primary-text disabled:bg-dark-bg disabled:text-slate-500 disabled:hover:border-border-clr"
      >
        Next <ChevronRight />
      </button>
      <p className="text-sm">
        <b>Showing: </b> {Number(page) * 20} / {totalResults}
      </p>
    </form>
  );
};
