import { render, screen } from "@testing-library/react";
import { describe, expect, it, test, vi } from "vitest";
import SearchResults from "./SearchResults";
import { getTitle } from "../searchTitle";
import type { movieFilterValues } from "../validation";
import { lastTmdbUrl, mockTmdb } from "@test/helpers/tmdb";

// async children can't render on the client under React 18: stub the card
vi.mock("./MovieCard", () => ({
  default: ({ movie }: { movie: { id: number } }) => (
    <div data-testid="card">{movie.id}</div>
  ),
}));

const page = (ids: number[], total_pages = 3) => ({
  page: 1,
  results: ids.map((id) => ({ id, title: `Movie ${id}` })),
  total_pages,
  total_results: total_pages * 20,
});

const base: movieFilterValues = {
  query: undefined,
  language: "en",
  adult: false,
  btn: "movie",
  page: "1",
};

const run = (filterValues: Partial<movieFilterValues>, title = getTitle) =>
  SearchResults({
    filterValues: { ...base, ...filterValues },
    getTitle: title,
  });

// all four search endpoints answer the same page
const mockAll = (body: unknown) =>
  mockTmdb({
    "/3/discover/movie": body,
    "/3/discover/tv": body,
    "/3/search/movie": body,
    "/3/search/tv": body,
  });

describe("SearchResults", () => {
  test("no query -> discover endpoint", async () => {
    const spy = mockAll(page([1]));
    await run({});
    expect(lastTmdbUrl(spy).pathname).toBe("/3/discover/movie");
    expect(lastTmdbUrl(spy).searchParams.has("query")).toBe(false);
  });

  test("with a query -> search endpoint of the chosen type", async () => {
    const spy = mockAll(page([1]));
    await run({ query: "Fury", btn: "tv" });
    expect(lastTmdbUrl(spy).pathname).toBe("/3/search/tv");
  });

  test("words are joined with |", async () => {
    const spy = mockAll(page([1]));
    await run({ query: "the  dark knight" });
    expect(lastTmdbUrl(spy).searchParams.get("query")).toBe("the|dark|knight");
  });

  test("adult, language, page and year are passed on", async () => {
    const spy = mockAll(page([1]));
    await run({
      query: "Fury",
      adult: true,
      language: "fr",
      page: "2",
      year: "2014",
    });

    const params = lastTmdbUrl(spy).searchParams;
    expect(params.get("include_adult")).toBe("true");
    expect(params.get("language")).toBe("fr");
    expect(params.get("page")).toBe("2");
    expect(params.get("year")).toBe("2014");
  });

  test("no year -> no year param", async () => {
    const spy = mockAll(page([1]));
    await run({ query: "Fury" });
    expect(lastTmdbUrl(spy).searchParams.has("year")).toBe(false);
  });

  test("sends the TMDB bearer token", async () => {
    const spy = mockAll(page([1]));
    await run({});
    const init = spy.mock.lastCall![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-tmdb-token",
    );
  });

  test("[B6] the query is URL-encoded", async () => {
    const spy = mockAll(page([1]));
    await run({ query: "Tom & Jerry" });

    const params = lastTmdbUrl(spy).searchParams;
    expect(params.get("query")).toBe("Tom|&|Jerry");
    expect(params.has("|Jerry")).toBe(false);
  });

  it.each(["C#", "a+b"])("[B6] %j reaches TMDB unchanged", async (query) => {
    const spy = mockAll(page([1]));
    await run({ query, year: "2014" });

    const params = lastTmdbUrl(spy).searchParams;
    expect(params.get("query")).toBe(query);
    expect(params.get("year")).toBe("2014");
  });

  test("renders the title, one card per result and pagination", async () => {
    mockAll(page([11, 12, 13]));
    const title = vi.fn(() => "My title");
    render(await run({ query: "Fury", year: "2014" }, title));

    expect(
      screen.getByRole("heading", { name: "My title" }),
    ).toBeInTheDocument();
    expect(title).toHaveBeenCalledWith({
      query: "Fury",
      language: "en",
      year: "2014",
      adult: false,
      btn: "movie",
    });
    expect(screen.getAllByTestId("card").map((c) => c.textContent)).toEqual([
      "11",
      "12",
      "13",
    ]);
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  test("no results -> message, no cards, no pagination", async () => {
    mockAll({ page: 1, results: [], total_pages: 0, total_results: 0 });
    render(await run({ query: "nothing" }));

    expect(
      screen.getByText(
        "No results with these filters were found. Try something else.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("card")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockAll(new Response("boom", { status: 500 }));
    await expect(run({ query: "Fury" })).rejects.toThrow(
      "Failed to fetch search results (Status: 500)",
    );
  });

  test("[B7] browsing TV without a query is titled Trending TV shows", async () => {
    mockAll(page([1]));
    render(await run({ btn: "tv" }));
    expect(
      screen.getByRole("heading", { name: "Trending TV shows" }),
    ).toBeInTheDocument();
  });
});
