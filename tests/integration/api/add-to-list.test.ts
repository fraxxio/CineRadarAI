import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { PUT } from "@/app/api/add-to-list/route";
import { asUser } from "../../helpers/auth";
import { forceFailure, getMovies, seedList, seedUser } from "../../helpers/db";
import { makeMovie } from "../../helpers/factories";
import { jsonRequest } from "../../helpers/requests";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

const put = (body: unknown) =>
  PUT(jsonRequest("PUT", "/api/add-to-list", body));

let user: Awaited<ReturnType<typeof seedUser>>;
let base: Record<string, string>;

beforeEach(async () => {
  user = await seedUser();
  // the route ignores the session today (B1); logging in keeps these tests valid after the fix
  asUser(user);
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

describe("PUT /api/add-to-list", () => {
  test("inserts a new row when the user has none", async () => {
    await put(base);
    expect(await getMovies(user.id)).toEqual([stored]);
  });

  test("appends to an existing list", async () => {
    const existing = makeMovie({ movieId: 1 });
    await seedList(user.id, [existing]);

    await put(base);

    const movies = await getMovies(user.id);
    expect(movies).toHaveLength(2);
    expect(movies![0]).toEqual(existing);
    expect(movies![1]).toEqual(stored);
  });

  test("replaces an existing entry instead of duplicating it", async () => {
    await seedList(user.id, [
      makeMovie({ movieId: 550, status: "Planning to watch" }),
    ]);

    await put({ ...base, status: "Watching", rating: "3" });

    const movies = await getMovies(user.id);
    expect(movies).toHaveLength(1);
    expect(movies![0]).toMatchObject({ status: "Watching", rating: 3 });
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

  describe("DB failures", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    test("returns fail when the update throws", async () => {
      const existing = [makeMovie({ movieId: 1 })];
      await seedList(user.id, existing);
      await forceFailure("UPDATE", "lists");

      const res = await put(base);

      expect(await res.json()).toEqual({ addToListResult: "fail" });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
      expect(await getMovies(user.id)).toEqual(existing);
    });

    test("returns fail when the insert throws", async () => {
      await forceFailure("INSERT", "lists");

      const res = await put(base);

      expect(await res.json()).toEqual({ addToListResult: "fail" });
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
      expect(await getMovies(user.id)).toBeUndefined();
    });

    test.fails("[B8] returns fail when the initial select throws", async () => {
      vi.spyOn(db, "select").mockImplementationOnce(() => {
        throw new Error("db down");
      });

      const res = put(base);

      await expect(res).resolves.toBeInstanceOf(Response);
      expect(await (await res).json()).toEqual({ addToListResult: "fail" });
    });
  });

  test.fails(
    "[B4] adding a TV show does not overwrite a movie with the same id",
    async () => {
      const movie = makeMovie({ movieId: 550, type: "movie" });
      await seedList(user.id, [movie]);

      await put({ ...base, type: "tv", title: "Show" });

      const movies = await getMovies(user.id);
      expect(movies).toHaveLength(2);
      expect(movies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ movieId: 550, type: "movie" }),
          expect.objectContaining({ movieId: 550, type: "tv" }),
        ]),
      );
    },
  );

  describe("authorization", () => {
    test.fails("[B1] rejects a request without a session", async () => {
      asUser(null);

      const res = await put(base);

      expect(res.status).toBe(401);
      expect(await getMovies(user.id)).toBeUndefined();
    });

    test.fails("[B1] ignores a foreign userId in the body", async () => {
      const victim = await seedUser();
      const victimMovies = [makeMovie({ movieId: 1 })];
      await seedList(victim.id, victimMovies);
      asUser(user); // `user` is the attacker

      await put({ ...base, userId: victim.id });

      expect(await getMovies(victim.id)).toEqual(victimMovies);
      expect(await getMovies(user.id)).toEqual([stored]);
    });
  });

  describe("payload validation", () => {
    test.todo("rejects a missing status");
    test.todo('rejects type: "anime"');
    test.todo('rejects rating: "11"');
  });
});
