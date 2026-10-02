import { describe, expect, it, test } from "vitest";
import { ZodError } from "zod";
import { buildSearchURL, formatCurrency } from "@/lib/utils";

const qp = (url: string) => new URL(url, "http://x").searchParams;

describe("buildSearchURL", () => {
  test("starts with /search?", () => {
    expect(buildSearchURL({})).toBe("/search?");
    expect(buildSearchURL({ query: "Fury", btn: "movie" })).toMatch(
      /^\/search\?/,
    );
  });

  test("trims query", () => {
    expect(qp(buildSearchURL({ query: "  Fury  " })).get("query")).toBe("Fury");
  });

  test("omits empty and undefined fields", () => {
    expect(buildSearchURL({ query: "", language: "", year: "" })).toBe(
      "/search?",
    );
    expect(buildSearchURL({ query: undefined })).toBe("/search?");
  });

  it.each([
    [true, "true"],
    [false, null],
    [undefined, null],
  ])("adult: %s -> %s", (adult, expected) => {
    expect(qp(buildSearchURL({ adult })).get("adult")).toBe(expected);
  });

  test("throws on an invalid btn", () => {
    expect(() => buildSearchURL({ btn: "anime" })).toThrow(ZodError);
  });

  it.each([
    [0, "0"],
    [3, "3"],
    [undefined, null],
  ])("page: %s -> %s", (page, expected) => {
    expect(qp(buildSearchURL({}, page)).get("page")).toBe(expected);
  });

  it.each(["Tom & Jerry", "#1 hit", "what?", "Amélie", "東京物語"])(
    "encodes special characters in query: %s",
    (query) => {
      const url = buildSearchURL({ query });
      expect(qp(url).get("query")).toBe(query);
      expect(url).not.toMatch(/[ #]/);
      expect(url.split("?")).toHaveLength(2);
    },
  );

  test("ignores unknown keys", () => {
    expect([...qp(buildSearchURL({ query: "x", foo: "bar" })).keys()]).toEqual([
      "query",
    ]);
  });

  // pins current behaviour: z.coerce.boolean turns the string "false" into true
  test("pins current behaviour: string 'false' coerces to true", () => {
    expect(qp(buildSearchURL({ adult: "false" })).get("adult")).toBe("true");
  });
});

describe("formatCurrency", () => {
  it.each([
    [0, "$0"],
    [999, "$999"],
    [1000, "$1.0k"],
    [1_500_000, "$1.5M"],
    [2_300_000_000, "$2.3B"],
    [1e6, "$1.0M"],
    [1e9, "$1.0B"],
  ])("%d -> %s", (amount, expected) => {
    expect(formatCurrency(amount)).toBe(expected);
  });

  // pins current rounding: 999.999k rounds up inside the "k" branch.
  // If the rounding gets fixed, change this to "$1.0M".
  test("999_999 -> $1000.0k", () => {
    expect(formatCurrency(999_999)).toBe("$1000.0k");
  });
});
