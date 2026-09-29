import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { DELETE } from "@/app/api/remove-from-list/route";
import { asUser } from "../../helpers/auth";
import { forceFailure, getMovies, seedList, seedUser } from "../../helpers/db";
import { makeMovie } from "../../helpers/factories";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

// userId is ignored by the route (B2); it's sent to prove that
const del = (
  userId: string,
  movieId: number,
  extra: Record<string, string> = {},
) =>
  DELETE(
    new Request("http://localhost/api/remove-from-list", {
      method: "DELETE",
      headers: { userId, movieId: String(movieId), type: "movie", ...extra },
    }),
  );

let user: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
  user = await seedUser();
  asUser(user);
});

describe("DELETE /api/remove-from-list", () => {
  test("removes the matching entry and keeps the others", async () => {
    const keep = [makeMovie({ movieId: 1 }), makeMovie({ movieId: 2 })];
    await seedList(user.id, [makeMovie({ movieId: 550 }), ...keep]);

    const res = await del(user.id, 550);

    expect(await res.json()).toEqual({ addToListResult: "success" });
    expect(await getMovies(user.id)).toEqual(keep);
  });

  test("returns fail when the user has no list row", async () => {
    const res = await del(user.id, 550);
    expect(await res.json()).toEqual({ addToListResult: "fail" });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  test("returns success (no-op) when the movie isn't in the list", async () => {
    const movies = [makeMovie({ movieId: 1 })];
    await seedList(user.id, movies);

    const res = await del(user.id, 999);

    expect(await res.json()).toEqual({ addToListResult: "success" });
    expect(await getMovies(user.id)).toEqual(movies);
  });

  test("returns fail when the update throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const movies = [makeMovie({ movieId: 550 })];
    await seedList(user.id, movies);
    await forceFailure("UPDATE", "lists");

    const res = await del(user.id, 550);

    expect(await res.json()).toEqual({ addToListResult: "fail" });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    expect(await getMovies(user.id)).toEqual(movies);
  });

  test("revalidates /my-list on success", async () => {
    await seedList(user.id, [makeMovie({ movieId: 550 })]);
    await del(user.id, 550);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/my-list", "page");
  });

  test("[B4] removing a movie keeps a TV show with the same id", async () => {
    const show = makeMovie({ movieId: 550, type: "tv" });
    await seedList(user.id, [makeMovie({ movieId: 550, type: "movie" }), show]);

    await del(user.id, 550, { type: "movie" });

    expect(await getMovies(user.id)).toEqual([show]);
  });

  test("[B4] removing a TV show keeps a movie with the same id", async () => {
    const movie = makeMovie({ movieId: 550, type: "movie" });
    await seedList(user.id, [movie, makeMovie({ movieId: 550, type: "tv" })]);

    await del(user.id, 550, { type: "tv" });

    expect(await getMovies(user.id)).toEqual([movie]);
  });

  it.each([
    ["no type", { type: "" }],
    ['type "anime"', { type: "anime" }],
    ["movieId 0", { movieId: "0" }],
    ["movieId abc", { movieId: "abc" }],
  ])("400 for %s, list unchanged", async (_, extra) => {
    const movies = [makeMovie({ movieId: 550 })];
    await seedList(user.id, movies);

    const res = await del(user.id, 550, extra);

    expect(res.status).toBe(400);
    expect(await getMovies(user.id)).toEqual(movies);
  });

  describe("authorization", () => {
    test("[B2] rejects a request without a session", async () => {
      const movies = [makeMovie({ movieId: 550 })];
      await seedList(user.id, movies);
      asUser(null);

      const res = await del(user.id, 550);

      expect(res.status).toBe(401);
      expect(await getMovies(user.id)).toEqual(movies);
    });

    test("[B2] ignores a foreign userId header", async () => {
      const victim = await seedUser();
      const victimMovies = [makeMovie({ movieId: 550 })];
      await seedList(victim.id, victimMovies);
      asUser(user); // `user` is the attacker

      await del(victim.id, 550);

      expect(await getMovies(victim.id)).toEqual(victimMovies);
    });
  });
});
