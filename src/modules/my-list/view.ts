import type { MediaType } from "@/infra/tmdb";
import { LIST_STATUSES, type ListStatusSlug } from "./entry";

// pure and client-safe: the store filters, sorts and pages in SQL

// "other": any stored status that isn't in LIST_STATUSES (see StoredEntry)
export type ListStatusFilter = ListStatusSlug | "all" | "other";
export type ListTypeFilter = MediaType | "both";
export type ListSort = "rating-desc" | "rating-asc" | "recent";

// the /my-list search params
export type ListView = {
  status: ListStatusFilter;
  type: ListTypeFilter;
  sort: ListSort;
  page: number; // 1-based
};

export const DEFAULT_VIEW: ListView = {
  status: "all",
  type: "both",
  sort: "rating-desc",
  page: 1,
};

export const PAGE_SIZE = 24;

const STATUS_FILTERS: readonly ListStatusFilter[] = [
  "all",
  ...LIST_STATUSES.map((s) => s.slug),
  "other",
];
const TYPE_FILTERS: readonly ListTypeFilter[] = ["both", "movie", "tv"];
const SORTS: readonly ListSort[] = ["rating-desc", "rating-asc", "recent"];

type SearchParams = Record<string, string | string[] | undefined>;
type Param = SearchParams[string];

// a repeated param (an array) is invalid too
const oneOf = <T extends string>(values: readonly T[], param: Param) =>
  values.find((value) => value === param);

const parsePage = (param: Param) =>
  typeof param === "string" && /^[1-9]\d*$/.test(param)
    ? Math.min(Number(param), Number.MAX_SAFE_INTEGER)
    : undefined;

// unknown or invalid values fall back to the default, never an error
export const parseListView = (searchParams: SearchParams): ListView => ({
  status: oneOf(STATUS_FILTERS, searchParams.status) ?? DEFAULT_VIEW.status,
  type: oneOf(TYPE_FILTERS, searchParams.type) ?? DEFAULT_VIEW.type,
  sort: oneOf(SORTS, searchParams.sort) ?? DEFAULT_VIEW.sort,
  page: parsePage(searchParams.page) ?? DEFAULT_VIEW.page,
});

// changing a filter or the sort starts again from page 1
export function listHref(view: ListView, changes: Partial<ListView>) {
  const resetsPage = Object.keys(changes).some((key) => key !== "page");
  const next: ListView = {
    ...view,
    ...changes,
    page: changes.page ?? (resetsPage ? 1 : view.page),
  };
  const params = new URLSearchParams();
  for (const key of ["status", "type", "sort", "page"] as const) {
    if (next[key] !== DEFAULT_VIEW[key]) params.set(key, String(next[key]));
  }
  const query = params.toString();
  return query ? `/my-list?${query}` : "/my-list";
}

// a row of the grouped counts query
export type ListCountRow = { status: string; type: MediaType; count: number };

export type ListCounts = Record<ListStatusFilter, number>;

// the count of every status filter under the given type
export function countsFor(rows: ListCountRow[], type: ListTypeFilter) {
  const counts: ListCounts = {
    all: 0,
    watching: 0,
    planning: 0,
    completed: 0,
    other: 0,
  };
  for (const row of rows) {
    if (type !== "both" && row.type !== type) continue;
    const slug =
      LIST_STATUSES.find((s) => s.value === row.status)?.slug ?? "other";
    counts[slug] += row.count;
    counts.all += row.count;
  }
  return counts;
}

// an empty view still has one (empty) page
export const pageCount = (total: number) =>
  Math.max(1, Math.ceil(total / PAGE_SIZE));
