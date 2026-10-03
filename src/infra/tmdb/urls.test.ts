import { describe, expect, it, test } from "vitest";
import { tmdbImageUrl, tmdbWatchUrl } from "./urls";

describe("tmdbImageUrl", () => {
  it.each(["w500", "w780", "w1280"] as const)("%s", (size) => {
    expect(tmdbImageUrl("/p.jpg", size)).toBe(
      `https://image.tmdb.org/t/p/${size}/p.jpg`,
    );
  });

  it.each([null, undefined, ""])("%j path -> null", (path) => {
    expect(tmdbImageUrl(path, "w500")).toBeNull();
  });
});

test("tmdbWatchUrl", () => {
  expect(tmdbWatchUrl("movie", 550)).toBe(
    "https://www.themoviedb.org/movie/550/watch",
  );
  expect(tmdbWatchUrl("tv", "1399")).toBe(
    "https://www.themoviedb.org/tv/1399/watch",
  );
});
