import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { PUT } from "@/app/api/save-title/route";
import { asUser } from "@test/helpers/auth";
import { forceFailure, getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";
import { jsonRequest } from "@test/helpers/requests";
import { mockTmdb } from "@test/helpers/tmdb";

vi.mock("@/infra/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const put = (body: unknown) =>
  PUT(jsonRequest("PUT", "/api/save-title", body));

// TMDB's /movie/228150, with only the fields the save reads
const FURY = {
  id: 228150,
  title: "Fury",
  release_date: "2014-10-15",
  poster_path: "/fury-p.jpg",
  backdrop_path: "/fury-b.jpg",
  genres: [],
};

let user: Awaited<ReturnType<typeof seedUser>>;
// a pending save as the chat client sends it
let base: Record<string, unknown>;

beforeEach(async () => {
  vi.stubEnv("AI_CHAT_ENABLED", "true");
  user = await seedUser();
  asUser(user);
  mockTmdb({ "/3/movie/228150": FURY });
  base = { type: "movie", id: 228150, title: "Fury", status: null };
});

// what a save writes is covered by saveTitle.int.test.ts
describe("PUT /api/save-title", () => {
  it.each(["", "false", "TRUE"])(
    "returns 503 when AI_CHAT_ENABLED is %j, without TMDB",
    async (value) => {
      vi.stubEnv("AI_CHAT_ENABLED", value);
      const tmdb = mockTmdb({ "/3/movie/228150": FURY });

      const res = await put(base);

      expect(res.status).toBe(503);
      expect(tmdb).not.toHaveBeenCalled();
      expect(await getMovies(user.id)).toEqual([]);
    },
  );

  test("saves a new title and answers like the chat's list_saved event", async () => {
    const res = await put(base);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      entry: {
        type: "movie",
        id: 228150,
        title: "Fury",
        posterPath: "/fury-p.jpg",
        image: "/fury-b.jpg",
        status: "Planning to watch",
      },
      previous: null,
    });
    expect(await getMovies(user.id)).toEqual([
      {
        movieId: 228150,
        type: "movie",
        name: "Fury",
        image: "/fury-b.jpg",
        status: "Planning to watch",
        rating: 0,
      },
    ]);
  });

  test("changes the status of a title in the list; the rating stays", async () => {
    const stored = makeMovie({
      movieId: 228150,
      name: "Fury",
      status: "Watching",
      rating: 9,
    });
    await seedList(user.id, [stored]);

    const res = await put({ ...base, status: "Completed" });

    expect(await res.json()).toMatchObject({
      entry: { status: "Completed" },
      previous: { status: "Watching", rating: 9 },
    });
    expect(await getMovies(user.id)).toEqual([
      { ...stored, status: "Completed" },
    ]);
  });

  describe("authorization", () => {
    test("rejects a request without a session", async () => {
      asUser(null);

      const res = await put(base);

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "signed_out" });
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("ignores a foreign userId in the body", async () => {
      const victim = await seedUser();
      const victimMovies = [makeMovie({ movieId: 228150, rating: 7 })];
      await seedList(victim.id, victimMovies);

      const res = await put({ ...base, userId: victim.id });

      expect(res.status).toBe(200);
      expect(await getMovies(victim.id)).toEqual(victimMovies);
      expect(await getMovies(user.id)).toHaveLength(1);
    });
  });

  describe("payload validation", () => {
    it.each([
      ['type "anime"', { type: "anime" }],
      ["a string id", { id: "228150" }],
      ["id 0", { id: 0 }],
      ["an empty title", { title: "" }],
      ["a title over 300 characters", { title: "x".repeat(301) }],
      ['status "Dropped"', { status: "Dropped" }],
      ["a missing status", { status: undefined }],
    ])("rejects %s with 400", async (_, override) => {
      const res = await put({ ...base, ...override });

      expect(res.status).toBe(400);
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("rejects a malformed JSON body with 400", async () => {
      expect((await put("{not json")).status).toBe(400);
    });
  });

  describe("titles that can't be saved: 422, nothing written", () => {
    it.each([
      ["not on TMDB", { id: 1 }, "not_found"],
      ["another title's id", { title: "Dune" }, "title_mismatch"],
    ])("%s", async (_, override, error) => {
      const res = await put({ ...base, ...override });

      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error });
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("adult", async () => {
      mockTmdb({ "/3/movie/228150": { ...FURY, adult: true } });

      const res = await put(base);

      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "not_available" });
    });
  });

  describe("failures", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    test("TMDB down: 502", async () => {
      mockTmdb({ "/3/movie/228150": new Response("down", { status: 503 }) });

      const res = await put(base);

      expect(res.status).toBe(502);
      expect(await getMovies(user.id)).toEqual([]);
    });

    test("the write fails: 500", async () => {
      await forceFailure("INSERT", "list_entries");

      const res = await put(base);

      expect(res.status).toBe(500);
      expect(await getMovies(user.id)).toEqual([]);
    });
  });
});
