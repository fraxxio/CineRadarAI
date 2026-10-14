import { beforeEach, describe, expect, test, vi } from "vitest";
import { TmdbError } from "@/infra/tmdb/server";
import { SaveTitleError, saveTitle } from "./saveTitle";
import { getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";
import { mockTmdb } from "@test/helpers/tmdb";

let user: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
  user = await seedUser();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// TMDB's /movie/{id} and /tv/{id}, with only the fields the save reads
const rawDetails = (id: number, extra: object = {}) => ({
  id,
  title: `Movie ${id}`,
  name: `Show ${id}`,
  release_date: "2024-02-27",
  first_air_date: "2024-11-17",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  genres: [],
  ...extra,
});

const DUNE = rawDetails(693134, {
  title: "Dune: Part Two",
  poster_path: "/dune-p.jpg",
  backdrop_path: "/dune-b.jpg",
});
const dune = (status?: "Planning to watch" | "Completed" | "Watching") => ({
  type: "movie" as const,
  id: 693134,
  title: "Dune: Part Two",
  status,
});

describe("saveTitle", () => {
  test("adds a new title as Planning to watch, with TMDB's name and backdrop", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });

    const result = await saveTitle(user.id, dune());

    expect(result).toEqual({
      entry: {
        type: "movie",
        id: 693134,
        title: "Dune: Part Two",
        posterPath: "/dune-p.jpg",
        image: "/dune-b.jpg",
        status: "Planning to watch",
      },
      previous: null,
    });
    expect(await getMovies(user.id)).toEqual([
      {
        movieId: 693134,
        type: "movie",
        name: "Dune: Part Two",
        image: "/dune-b.jpg",
        status: "Planning to watch",
        rating: 0,
      },
    ]);
  });

  test("adds a new title with the given status", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });

    const { entry } = await saveTitle(user.id, dune("Completed"));

    expect(entry.status).toBe("Completed");
    expect((await getMovies(user.id))[0].status).toBe("Completed");
  });

  test.each([
    ["the poster without a backdrop", { backdrop_path: null }, "/dune-p.jpg"],
    ["no image", { backdrop_path: null, poster_path: null }, ""],
  ])("saves %s", async (_, extra, image) => {
    mockTmdb({ "/3/movie/693134": { ...DUNE, ...extra } });

    const { entry } = await saveTitle(user.id, dune());

    expect(entry.image).toBe(image);
    expect((await getMovies(user.id))[0].image).toBe(image);
  });

  test("changes the status of a title in the list; rating, name and image stay", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });
    const stored = makeMovie({
      movieId: 693134,
      name: "Dune 2",
      image: "/old.jpg",
      status: "Watching",
      rating: 9,
    });
    await seedList(user.id, [stored]);

    const result = await saveTitle(user.id, dune("Completed"));

    expect(result).toEqual({
      entry: expect.objectContaining({
        title: "Dune: Part Two",
        image: "/old.jpg",
        status: "Completed",
      }),
      previous: {
        name: "Dune 2",
        image: "/old.jpg",
        status: "Watching",
        rating: 9,
      },
    });
    expect(await getMovies(user.id)).toEqual([
      { ...stored, status: "Completed" },
    ]);
  });

  test("a title in the list without a status: nothing is written", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });
    const stored = makeMovie({
      movieId: 693134,
      status: "Watching",
      rating: 9,
    });
    await seedList(user.id, [stored]);

    const result = await saveTitle(user.id, dune());

    expect(result.entry.status).toBe("Watching");
    expect(result.previous).toMatchObject({ status: "Watching", rating: 9 });
    // a write would have set Planning to watch
    expect(await getMovies(user.id)).toEqual([stored]);
  });

  test("a status the list doesn't know is replaced, the rating stays", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });
    const stored = makeMovie({ movieId: 693134, rating: 4 });
    await seedList(user.id, [{ ...stored, status: "Dropped" as never }]);

    const result = await saveTitle(user.id, dune());

    expect(result.entry.status).toBe("Planning to watch");
    expect(result.previous?.status).toBe("Dropped");
    expect(await getMovies(user.id)).toEqual([
      { ...stored, status: "Planning to watch" },
    ]);
  });

  test("a TV show with the same id is a different title", async () => {
    mockTmdb({
      "/3/tv/693134": rawDetails(693134, { name: "Dune: Prophecy" }),
    });
    const movie = makeMovie({ movieId: 693134, status: "Watching", rating: 9 });
    await seedList(user.id, [movie]);

    const { previous } = await saveTitle(user.id, {
      type: "tv",
      id: 693134,
      title: "Dune: Prophecy",
      status: "Completed",
    });

    expect(previous).toBeNull();
    expect(await getMovies(user.id)).toEqual([
      movie,
      expect.objectContaining({ type: "tv", status: "Completed", rating: 0 }),
    ]);
  });

  test("only touches the given user's list", async () => {
    mockTmdb({ "/3/movie/693134": DUNE });
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 693134, rating: 7 })];
    await seedList(other.id, otherEntries);

    const { previous } = await saveTitle(user.id, dune("Watching"));

    expect(previous).toBeNull();
    expect(await getMovies(other.id)).toEqual(otherEntries);
  });

  test("the title matches TMDB's original title too", async () => {
    mockTmdb({
      "/3/movie/129": rawDetails(129, {
        title: "Spirited Away",
        original_title: "千と千尋の神隠し",
      }),
    });

    const { entry } = await saveTitle(user.id, {
      type: "movie",
      id: 129,
      title: "千と千尋の神隠し",
    });

    expect(entry.title).toBe("Spirited Away");
  });

  describe("rejected titles: nothing is written", () => {
    const rejection = async (run: Promise<unknown>) => {
      const error = await run.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SaveTitleError);
      expect(await getMovies(user.id)).toEqual([]);
      return (error as SaveTitleError).rejection;
    };

    test("not on TMDB", async () => {
      mockTmdb({});
      expect(await rejection(saveTitle(user.id, dune()))).toEqual({
        reason: "not_found",
      });
    });

    test("adult", async () => {
      mockTmdb({ "/3/movie/693134": { ...DUNE, adult: true } });
      expect(await rejection(saveTitle(user.id, dune()))).toEqual({
        reason: "not_available",
      });
    });

    // e.g. Dune (2021) for Dune: Part Two
    test("the id is another title", async () => {
      mockTmdb({ "/3/movie/693134": { ...DUNE, title: "Dune" } });
      expect(await rejection(saveTitle(user.id, dune()))).toEqual({
        reason: "title_mismatch",
        tmdbTitle: "Dune",
      });
    });
  });

  test("a failed TMDB request is thrown as is, nothing is written", async () => {
    mockTmdb({ "/3/movie/693134": new Response("down", { status: 503 }) });

    await expect(saveTitle(user.id, dune())).rejects.toBeInstanceOf(TmdbError);
    expect(await getMovies(user.id)).toEqual([]);
  });

  test("passes the signal to TMDB", async () => {
    const spy = mockTmdb({ "/3/movie/693134": DUNE });
    const { signal } = new AbortController();

    await saveTitle(user.id, dune(), { signal });

    expect(spy.mock.lastCall?.[1]?.signal).toBe(signal);
  });

  test("aborted after the lookup: nothing is written", async () => {
    const controller = new AbortController();
    mockTmdb({
      "/3/movie/693134": () => {
        controller.abort();
        return DUNE;
      },
    });

    await expect(
      saveTitle(user.id, dune(), { signal: controller.signal }),
    ).rejects.toBe(controller.signal.reason);
    expect(await getMovies(user.id)).toEqual([]);
  });
});
