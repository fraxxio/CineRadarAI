import { cache } from "react";
import { describe, expect, test } from "vitest";
import { getTitle } from "@/modules/search";

// Phase 1 smoke test: proves the unit project, the @ alias and the shared setup work.
describe("unit infrastructure", () => {
  test("resolves @/ imports", () => {
    expect(getTitle({ query: "", btn: "movie", adult: false })).toBe(
      "Trending movies",
    );
  });

  test("shims react.cache (F2)", () => {
    const fn = () => 1;
    expect(cache(fn)).toBe(fn);
  });

  test("uses test env instead of .env", () => {
    expect(process.env.TMDB_BASE_URL).toBe("https://tmdb.test/3");
    expect(process.env.DATABASE_URL).toBeUndefined();
  });
});
