import { describe, expect, it, test } from "vitest";
import type { MediaType } from "@/infra/tmdb";
import { FULL_MOVIE_GENRES, FULL_TV_GENRES } from "../testing/tmdbData";
import { type GenreName, genreArg, resolveGenreIds } from "./genres";
import { ToolError } from "./types";

const LISTS = { movie: FULL_MOVIE_GENRES.genres, tv: FULL_TV_GENRES.genres };

// the TMDB id per type, null when TMDB has no such genre for it
const EXPECTED: Record<GenreName, Record<MediaType, number | null>> = {
  Action: { movie: 28, tv: 10759 },
  Adventure: { movie: 12, tv: 10759 },
  Animation: { movie: 16, tv: 16 },
  Comedy: { movie: 35, tv: 35 },
  Crime: { movie: 80, tv: 80 },
  Documentary: { movie: 99, tv: 99 },
  Drama: { movie: 18, tv: 18 },
  Family: { movie: 10751, tv: 10751 },
  Fantasy: { movie: 14, tv: 10765 },
  History: { movie: 36, tv: null },
  Horror: { movie: 27, tv: null },
  Kids: { movie: null, tv: 10762 },
  Music: { movie: 10402, tv: null },
  Mystery: { movie: 9648, tv: 9648 },
  Reality: { movie: null, tv: 10764 },
  Romance: { movie: 10749, tv: null },
  "Science Fiction": { movie: 878, tv: 10765 },
  Thriller: { movie: 53, tv: null },
  War: { movie: 10752, tv: 10768 },
  Western: { movie: 37, tv: 37 },
};

const VALID = {
  movie:
    "Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, Thriller, War, Western",
  tv: "Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, Kids, Mystery, Reality, Science Fiction, War, Western",
};

const LABEL = { movie: "movie", tv: "TV" };

const thrown = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected a throw");
};

const cases = (Object.keys(EXPECTED) as GenreName[]).flatMap((name) =>
  (["movie", "tv"] as const).map(
    (type) => [name, type, EXPECTED[name][type]] as const,
  ),
);

describe("genreArg", () => {
  test("is exactly the mapped names", () => {
    expect(genreArg.options).toEqual(Object.keys(EXPECTED));
  });
});

describe("resolveGenreIds", () => {
  it.each(cases)("%s on %s", (name, type, id) => {
    if (id !== null) {
      expect(resolveGenreIds(type, [name], LISTS[type])).toEqual([id]);
      return;
    }
    const error = thrown(() => resolveGenreIds(type, [name], LISTS[type]));
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toBe(
      `"${name}" isn't a TMDB ${LABEL[type]} genre. Valid ${LABEL[type]} genres: ${VALID[type]}`,
    );
  });

  test("keeps the order of the names", () => {
    expect(
      resolveGenreIds("movie", ["War", "Drama", "Action"], LISTS.movie),
    ).toEqual([10752, 18, 28]);
  });

  test("merged TV genres give one id", () => {
    expect(
      resolveGenreIds(
        "tv",
        ["Action", "Adventure", "Science Fiction", "Fantasy"],
        LISTS.tv,
      ),
    ).toEqual([10759, 10765]);
  });

  test("a repeated name gives one id", () => {
    expect(resolveGenreIds("movie", ["War", "War"], LISTS.movie)).toEqual([
      10752,
    ]);
  });

  test("no names: no ids", () => {
    expect(resolveGenreIds("movie", [], LISTS.movie)).toEqual([]);
  });

  test("a genre the type lacks wins over a renamed one", () => {
    // the model can retry with a valid name; a renamed genre it can't fix
    expect(() => resolveGenreIds("tv", ["Drama", "Horror"], [])).toThrow(
      ToolError,
    );
  });

  test("a mapped genre missing from TMDB's list is a plain error", () => {
    // TMDB renamed "Sci-Fi & Fantasy": never silently drop the filter
    const renamed = LISTS.tv.map((genre) =>
      genre.id === 10765 ? { ...genre, name: "Sci-Fi and Fantasy" } : genre,
    );

    const error = thrown(() =>
      resolveGenreIds("tv", ["Science Fiction"], renamed),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ToolError);
    expect(error.message).toBe(
      'TMDB tv genre list has no "Sci-Fi & Fantasy"',
    );
  });
});
