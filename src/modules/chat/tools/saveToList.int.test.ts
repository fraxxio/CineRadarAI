import { beforeEach, describe, expect, test, vi } from "vitest";
import { getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";
import { mockTmdb } from "@test/helpers/tmdb";
import { rawDetails } from "../testing/tmdbData";
import { toolContext } from "../testing/toolContext";
import { saveToList } from "./saveToList";
import { DisplayOutput, ToolError, type ChatUser } from "./types";

let user: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
  user = await seedUser();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const FURY = rawDetails(228150, {
  title: "Fury",
  poster_path: "/fury-p.jpg",
  backdrop_path: "/fury-b.jpg",
});

// args as the registry passes them: parsed
const run = (args: object, chatUser: ChatUser) =>
  saveToList.run(saveToList.args.parse(args), toolContext(undefined, chatUser));

const signedIn = (): ChatUser => ({ status: "signed_in", id: user.id });
const fury = { type: "movie", id: 228150, title: "Fury" };

describe("save_to_list", () => {
  describe("signed in", () => {
    test("saves the title and shows it in the chat", async () => {
      mockTmdb({ "/3/movie/228150": FURY });

      const value = await run({ ...fury, status: "Watching" }, signedIn());

      expect(value).toEqual(
        new DisplayOutput(
          {
            saved: {
              id: 228150,
              type: "movie",
              title: "Fury",
              status: "Watching",
            },
            previousStatus: null,
          },
          [
            {
              type: "list_saved",
              entry: {
                type: "movie",
                id: 228150,
                title: "Fury",
                posterPath: "/fury-p.jpg",
                image: "/fury-b.jpg",
                status: "Watching",
              },
              previous: null,
            },
          ],
        ),
      );
      expect(await getMovies(user.id)).toEqual([
        {
          movieId: 228150,
          type: "movie",
          name: "Fury",
          image: "/fury-b.jpg",
          status: "Watching",
          rating: 0,
        },
      ]);
    });

    test("a title already in the list: status changed, rating kept", async () => {
      mockTmdb({ "/3/movie/228150": FURY });
      const stored = makeMovie({
        movieId: 228150,
        status: "Watching",
        rating: 8,
      });
      await seedList(user.id, [stored]);

      const value = (await run(
        { ...fury, status: "Completed" },
        signedIn(),
      )) as DisplayOutput;

      expect(value.output).toEqual({
        saved: {
          id: 228150,
          type: "movie",
          title: "Fury",
          status: "Completed",
        },
        previousStatus: "Watching",
      });
      expect(value.events).toEqual([
        expect.objectContaining({
          type: "list_saved",
          previous: {
            name: stored.name,
            image: stored.image,
            status: "Watching",
            rating: 8,
          },
        }),
      ]);
      expect(await getMovies(user.id)).toEqual([
        { ...stored, status: "Completed" },
      ]);
    });

    test.each([
      ["not on TMDB", {}, "not found on TMDB"],
      [
        "adult",
        { "/3/movie/228150": { ...FURY, adult: true } },
        "not available",
      ],
      [
        "another title's id",
        { "/3/movie/228150": { ...FURY, title: "Fury Road" } },
        'the id is "Fury Road", not "Fury"',
      ],
    ])("%s: a ToolError, nothing written", async (_, routes, message) => {
      mockTmdb(routes);

      await expect(run(fury, signedIn())).rejects.toEqual(
        new ToolError(message),
      );
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("a failed TMDB request isn't a ToolError", async () => {
      mockTmdb({ "/3/movie/228150": new Response("down", { status: 503 }) });

      await expect(run(fury, signedIn())).rejects.toMatchObject({
        name: "TmdbError",
        status: 503,
      });
      expect(await getMovies(user.id)).toEqual([]);
    });
  });

  describe("signed out", () => {
    test("asks to sign in for the TMDB title; not an error, nothing written", async () => {
      mockTmdb({ "/3/movie/228150": FURY });

      const value = await run(
        { ...fury, title: "fury", status: "Completed" },
        { status: "signed_out" },
      );

      expect(value).toEqual(
        new DisplayOutput(
          {
            saved: false,
            reason:
              "The user isn't signed in. The chat shows them a sign-in button for this title.",
          },
          [
            {
              type: "sign_in_required",
              save: {
                type: "movie",
                id: 228150,
                title: "Fury",
                posterPath: "/fury-p.jpg",
                status: "Completed",
              },
            },
          ],
        ),
      );
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("no status: null in the pending save", async () => {
      mockTmdb({ "/3/movie/228150": FURY });

      const value = (await run(fury, {
        status: "signed_out",
      })) as DisplayOutput;

      expect(value.events).toEqual([
        {
          type: "sign_in_required",
          save: expect.objectContaining({ status: null }),
        },
      ]);
    });

    test("checks the title like a save", async () => {
      mockTmdb({ "/3/movie/228150": { ...FURY, title: "Fury Road" } });

      await expect(run(fury, { status: "signed_out" })).rejects.toEqual(
        new ToolError('the id is "Fury Road", not "Fury"'),
      );
    });
  });

  test("session unavailable: a ToolError without a TMDB request", async () => {
    const spy = mockTmdb({ "/3/movie/228150": FURY });

    await expect(run(fury, { status: "unavailable" })).rejects.toEqual(
      new ToolError("Can't save right now, try again later"),
    );
    expect(spy).not.toHaveBeenCalled();
  });

  test("args: a list status or none, a positive id and a title", () => {
    const parse = (args: object) =>
      saveToList.args.safeParse({ ...fury, ...args }).success;

    expect(parse({})).toBe(true);
    expect(parse({ status: "Planning to watch" })).toBe(true);
    expect(parse({ status: "Completed" })).toBe(true);
    expect(parse({ status: "Watching" })).toBe(true);
    expect(parse({ status: "Dropped" })).toBe(false);
    expect(parse({ status: "completed" })).toBe(false);
    expect(parse({ id: 0 })).toBe(false);
    expect(parse({ id: 1.5 })).toBe(false);
    expect(parse({ title: "" })).toBe(false);
    expect(parse({ title: "x".repeat(301) })).toBe(false);
    expect(parse({ type: "anime" })).toBe(false);
  });
});
