import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { db } from "@/infra/db";
import { PUT } from "@/app/api/add-to-list/route";
import { asUser } from "@test/helpers/auth";
import { forceFailure, getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";
import { jsonRequest } from "@test/helpers/requests";

vi.mock("@/infra/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const put = (body: unknown) =>
  PUT(jsonRequest("PUT", "/api/add-to-list", body));

let user: Awaited<ReturnType<typeof seedUser>>;
let base: Record<string, string>;

beforeEach(async () => {
  user = await seedUser();
  asUser(user);
  // userId is ignored by the route (B1); it stays in the body to prove that
  base = {
    userId: user.id,
    movieId: "550",
    title: "Fight Club",
    image: "/i.jpg",
    status: "Completed",
    rating: "8",
    type: "movie",
  };
});

const stored = {
  name: "Fight Club",
  image: "/i.jpg",
  status: "Completed",
  rating: 8,
  movieId: 550,
  type: "movie",
};

// data behaviour (append, replace, B4, concurrency) is covered by store.int.test.ts
describe("PUT /api/add-to-list", () => {
  test("saves the parsed entry to the session user's list", async () => {
    await put(base);
    expect(await getMovies(user.id)).toEqual([stored]);
  });

  it.each([
    ["", 0],
    ["7", 7],
  ])("stores rating %j as the number %d", async (rating, expected) => {
    await put({ ...base, rating });
    const [movie] = (await getMovies(user.id))!;
    expect(typeof movie.rating).toBe("number");
    expect(movie.rating).toBe(expected);
  });

  test("stores movieId as a number", async () => {
    await put(base);
    expect((await getMovies(user.id))![0].movieId).toBe(550);
  });

  test("returns success and revalidates /my-list", async () => {
    const res = await put(base);
    expect(await res.json()).toEqual({ addToListResult: "success" });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/my-list", "page");
  });

  describe("store failures", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    test("returns fail and doesn't revalidate when the write throws", async () => {
      const existing = [makeMovie({ movieId: 1 })];
      await seedList(user.id, existing);
      await forceFailure("UPDATE", "lists");

      const res = await put(base);

      expect(await res.json()).toEqual({ addToListResult: "fail" });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
      expect(await getMovies(user.id)).toEqual(existing);
    });

    test("[B8] returns fail when the transaction can't start", async () => {
      vi.spyOn(db, "transaction").mockImplementationOnce(() => {
        throw new Error("db down");
      });

      const res = put(base);

      await expect(res).resolves.toBeInstanceOf(Response);
      expect(await (await res).json()).toEqual({ addToListResult: "fail" });
    });
  });

  describe("authorization", () => {
    test("[B1] rejects a request without a session", async () => {
      asUser(null);

      const res = await put(base);

      expect(res.status).toBe(401);
      expect(await getMovies(user.id)).toBeUndefined();
    });

    test("[B1] ignores a foreign userId in the body", async () => {
      const victim = await seedUser();
      const victimMovies = [makeMovie({ movieId: 1 })];
      await seedList(victim.id, victimMovies);
      asUser(user); // `user` is the attacker

      await put({ ...base, userId: victim.id });

      expect(await getMovies(victim.id)).toEqual(victimMovies);
      expect(await getMovies(user.id)).toEqual([stored]);
    });
  });

  test("stores a missing image as an empty string", async () => {
    await put({ ...base, image: null });
    expect((await getMovies(user.id))![0].image).toBe("");
  });

  describe("payload validation", () => {
    it.each([
      ["a missing status", { status: undefined }],
      ['status "Dropped"', { status: "Dropped" }],
      ['type "anime"', { type: "anime" }],
      ['rating "11"', { rating: "11" }],
      ['rating "0"', { rating: "0" }],
      ['rating "abc"', { rating: "abc" }],
      ['movieId ""', { movieId: "" }],
      ['movieId "abc"', { movieId: "abc" }],
      ["an empty title", { title: "" }],
    ])("rejects %s with 400", async (_, override) => {
      const res = await put({ ...base, ...override });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ addToListResult: "fail" });
      expect(await getMovies(user.id)).toBeUndefined();
    });

    test("rejects a malformed JSON body with 400", async () => {
      const res = await put("{not json");
      expect(res.status).toBe(400);
    });
  });
});
