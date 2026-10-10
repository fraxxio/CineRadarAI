import { describe, expect, test } from "vitest";
import { lastTmdbUrl, mockTmdb } from "@test/helpers/tmdb";
import { page, rawMovie, rawPerson, rawShow } from "../testing/tmdbData";
import { searchPerson } from "./searchPerson";

const ctx = () => ({ signal: new AbortController().signal });

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };
const search = async (query: string) =>
  (await searchPerson.run({ query }, ctx())) as Items;

const mockPeople = (people: object[]) =>
  mockTmdb({ "/3/search/person": page(people) });

describe("search_person", () => {
  test("returns the top 5 hits with only the listed fields", async () => {
    mockPeople([1, 2, 3, 4, 5, 6, 7].map((id) => rawPerson(id)));

    const { results } = await search("Brad Pitt");

    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(results[0]).toEqual({
      id: 1,
      name: "Person 1",
      department: "Acting",
      knownFor: [
        { type: "movie", title: "Movie 550", year: 2014 },
        { type: "tv", title: "Show 1399", year: 2017 },
      ],
    });
  });

  test("knownFor: at most 3 titles, non-title items skipped, a missing date gives a null year", async () => {
    mockPeople([
      rawPerson(287, {
        known_for: [
          { id: 9, name: "Not a title", media_type: "person" },
          { ...rawMovie(1, { release_date: "" }), media_type: "movie" },
          { ...rawShow(2), media_type: "tv" },
          { ...rawMovie(3), media_type: "movie" },
          { ...rawMovie(4), media_type: "movie" },
        ],
      }),
    ]);

    const { results } = await search("Brad Pitt");

    expect(results[0].knownFor).toEqual([
      { type: "movie", title: "Movie 1", year: null },
      { type: "tv", title: "Show 2", year: 2017 },
      { type: "movie", title: "Movie 3", year: 2014 },
    ]);
  });

  test("a person without department or known_for", async () => {
    mockPeople([{ id: 5, name: "Unknown" }]);

    const { results } = await search("Unknown");

    expect(results).toEqual([
      { id: 5, name: "Unknown", department: "", knownFor: [] },
    ]);
  });

  test("sends the query without adult results", async () => {
    const spy = mockPeople([]);

    expect(await search("Brad Pitt")).toEqual({ results: [] });

    const url = lastTmdbUrl(spy);
    expect(url.pathname).toBe("/3/search/person");
    expect(url.searchParams.get("query")).toBe("Brad Pitt");
    expect(url.searchParams.get("include_adult")).toBe("false");
  });

  test("passes the signal to the TMDB request", async () => {
    const spy = mockPeople([rawPerson(1)]);
    const { signal } = new AbortController();

    await searchPerson.run({ query: "Brad Pitt" }, { signal });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][1]?.signal).toBe(signal);
  });

  test("args: query 1-100 chars", () => {
    const parse = (args: object) => searchPerson.args.safeParse(args).success;

    expect(parse({ query: "Brad Pitt" })).toBe(true);
    expect(parse({ query: "a".repeat(100) })).toBe(true);
    expect(parse({ query: "" })).toBe(false);
    expect(parse({ query: "a".repeat(101) })).toBe(false);
    expect(parse({})).toBe(false);
  });
});
