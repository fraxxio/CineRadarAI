import { describe, expect, it, test } from "vitest";
import {
  DEFAULT_VIEW,
  PAGE_SIZE,
  STATUS_TABS,
  countsFor,
  isFiltered,
  listHref,
  pageCount,
  parseListView,
  shelfStatuses,
  type ListCountRow,
  type ListCounts,
  type ListView,
} from "./view";

describe("parseListView", () => {
  test("no params -> the default view", () => {
    expect(parseListView({})).toEqual(DEFAULT_VIEW);
    expect(DEFAULT_VIEW).toEqual({
      status: "all",
      type: "both",
      sort: "rating-desc",
      page: 1,
    });
  });

  test("reads every valid param", () => {
    expect(
      parseListView({
        status: "other",
        type: "tv",
        sort: "recent",
        page: "3",
      }),
    ).toEqual({ status: "other", type: "tv", sort: "recent", page: 3 });
  });

  it.each(["all", "watching", "planning", "completed", "other"] as const)(
    "status=%s",
    (status) => {
      expect(parseListView({ status }).status).toBe(status);
    },
  );

  it.each(["rating-desc", "rating-asc", "recent"] as const)(
    "sort=%s",
    (sort) => {
      expect(parseListView({ sort }).sort).toBe(sort);
    },
  );

  test("invalid values fall back to the defaults", () => {
    expect(
      parseListView({
        status: "Completed",
        type: "both ",
        sort: "rating",
        page: "x",
      }),
    ).toEqual(DEFAULT_VIEW);
  });

  // the old ?rating= param is ignored
  test("rating=asc gives the default sort", () => {
    expect(parseListView({ rating: "asc" })).toEqual(DEFAULT_VIEW);
  });

  test("a repeated param is invalid", () => {
    expect(
      parseListView({ status: ["watching", "completed"], page: ["2", "3"] }),
    ).toEqual(DEFAULT_VIEW);
  });

  it.each(["0", "-1", "abc", "1.5", "2e1", "", " 2", "02"])(
    "page=%j -> 1",
    (page) => {
      expect(parseListView({ status: "watching", page }).page).toBe(1);
    },
  );

  test("a huge page stays a safe integer", () => {
    expect(
      parseListView({ status: "watching", page: "9".repeat(30) }).page,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  // the "All" tab shows shelves, not pages
  test("the All tab ignores the page", () => {
    expect(parseListView({ page: "3" }).page).toBe(1);
    expect(parseListView({ status: "all", page: "3" }).page).toBe(1);
    // an invalid status falls back to All, so its page goes too
    expect(parseListView({ status: "nope", page: "3" }).page).toBe(1);
  });
});

describe("listHref", () => {
  const view: ListView = {
    status: "watching",
    type: "tv",
    sort: "recent",
    page: 3,
  };

  test("the default view -> /my-list", () => {
    expect(listHref(DEFAULT_VIEW, {})).toBe("/my-list");
  });

  test("keeps the current view with no changes", () => {
    expect(listHref(view, {})).toBe(
      "/my-list?status=watching&type=tv&sort=recent&page=3",
    );
  });

  test("omits params at their default", () => {
    expect(listHref(DEFAULT_VIEW, { type: "movie" })).toBe(
      "/my-list?type=movie",
    );
    expect(listHref(view, { status: "all", type: "both" })).toBe(
      "/my-list?sort=recent",
    );
  });

  it.each([
    [{ status: "completed" }, "/my-list?status=completed&type=tv&sort=recent"],
    [{ type: "movie" }, "/my-list?status=watching&type=movie&sort=recent"],
    [
      { sort: "rating-asc" },
      "/my-list?status=watching&type=tv&sort=rating-asc",
    ],
  ] as const)("changing %o resets the page", (changes, href) => {
    expect(listHref(view, changes)).toBe(href);
  });

  test("changing the page keeps the filters", () => {
    expect(listHref(view, { page: 4 })).toBe(
      "/my-list?status=watching&type=tv&sort=recent&page=4",
    );
    expect(listHref(view, { page: 1 })).toBe(
      "/my-list?status=watching&type=tv&sort=recent",
    );
  });

  test("the All tab never has a page", () => {
    expect(listHref(view, { status: "all", page: 2 })).toBe(
      "/my-list?type=tv&sort=recent",
    );
    expect(listHref({ ...DEFAULT_VIEW, page: 3 }, {})).toBe("/my-list");
    expect(listHref(DEFAULT_VIEW, { page: 2 })).toBe("/my-list");
  });
});

describe("countsFor", () => {
  const rows: ListCountRow[] = [
    { status: "Watching", type: "movie", count: 2 },
    { status: "Watching", type: "tv", count: 3 },
    { status: "Planning to watch", type: "tv", count: 1 },
    { status: "Completed", type: "movie", count: 4 },
    // rows saved before the payload was validated
    { status: "Dropped", type: "movie", count: 1 },
    { status: "On hold", type: "tv", count: 2 },
  ];

  test("type both counts every row", () => {
    expect(countsFor(rows, "both")).toEqual({
      all: 13,
      watching: 5,
      planning: 1,
      completed: 4,
      other: 3,
    });
  });

  test("a type counts only that type", () => {
    expect(countsFor(rows, "movie")).toEqual({
      all: 7,
      watching: 2,
      planning: 0,
      completed: 4,
      other: 1,
    });
    expect(countsFor(rows, "tv")).toEqual({
      all: 6,
      watching: 3,
      planning: 1,
      completed: 0,
      other: 2,
    });
  });

  test("no rows -> all zero", () => {
    expect(countsFor([], "both")).toEqual({
      all: 0,
      watching: 0,
      planning: 0,
      completed: 0,
      other: 0,
    });
  });
});

describe("pageCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [PAGE_SIZE, 1],
    [PAGE_SIZE + 1, 2],
    [PAGE_SIZE * 3, 3],
  ])("%i rows -> %i pages", (total, pages) => {
    expect(pageCount(total)).toBe(pages);
  });
});

describe("STATUS_TABS", () => {
  test("All, then watching, planning, completed and other", () => {
    expect(STATUS_TABS.map((tab) => tab.slug)).toEqual([
      "all",
      "watching",
      "planning",
      "completed",
      "other",
    ]);
  });
});

describe("isFiltered", () => {
  test("the default view isn't filtered", () => {
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
  });

  test("the page alone isn't a filter", () => {
    expect(isFiltered({ ...DEFAULT_VIEW, page: 3 })).toBe(false);
  });

  it.each<Partial<ListView>>([
    { status: "watching" },
    { type: "tv" },
    { sort: "recent" },
  ])("%j is filtered", (changes) => {
    expect(isFiltered({ ...DEFAULT_VIEW, ...changes })).toBe(true);
  });
});

describe("shelfStatuses", () => {
  const counts = (changes: Partial<ListCounts>): ListCounts => ({
    all: 0,
    watching: 0,
    planning: 0,
    completed: 0,
    other: 0,
    ...changes,
  });

  test("every status but All, in tab order", () => {
    expect(
      shelfStatuses(
        counts({ all: 4, watching: 1, planning: 1, completed: 1, other: 1 }),
      ),
    ).toEqual(["watching", "planning", "completed", "other"]);
  });

  test("skips the empty statuses", () => {
    expect(shelfStatuses(counts({ all: 3, completed: 2, other: 1 }))).toEqual([
      "completed",
      "other",
    ]);
  });

  test("an empty view has no shelves", () => {
    expect(shelfStatuses(counts({}))).toEqual([]);
  });
});
