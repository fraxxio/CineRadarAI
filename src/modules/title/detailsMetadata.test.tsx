import { describe, expect, test, vi } from "vitest";
import { generateMetadata as movieMetadata } from "@/app/search/movie/[id]/page";
import { generateMetadata as tvMetadata } from "@/app/search/tv/[id]/page";
import { lastTmdbUrl, mockTmdb, tmdbFixture } from "@test/helpers/tmdb";

describe("details page generateMetadata", () => {
  test("movie title", async () => {
    const spy = mockTmdb({ "/3/movie/550": tmdbFixture("movie-550") });
    const { title } = await movieMetadata({ params: { id: 550 } });
    expect(title).toBe("Fight Club | CineRadar");
    expect(lastTmdbUrl(spy).pathname).toBe("/3/movie/550");
  });

  test("TV name", async () => {
    const spy = mockTmdb({ "/3/tv/1399": tmdbFixture("tv-1399") });
    const { title } = await tvMetadata({ params: { id: 1399 } });
    expect(title).toBe("Game of Thrones | CineRadar");
    expect(lastTmdbUrl(spy).pathname).toBe("/3/tv/1399");
  });

  test.each([
    ["movie", movieMetadata, "/3/movie/1", "Failed to fetch movie details"],
    ["tv", tvMetadata, "/3/tv/1", "Failed to fetch tv details"],
  ] as const)(
    "%s: a TMDB error rejects",
    async (_, metadata, path, message) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockTmdb({ [path]: new Response("x", { status: 500 }) });
      await expect(metadata({ params: { id: 1 } })).rejects.toThrow(message);
    },
  );
});
