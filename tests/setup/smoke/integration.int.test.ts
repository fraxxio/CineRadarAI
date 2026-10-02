import { describe, expect, test } from "vitest";
import { db } from "@/infra/db";
import { lists } from "@/infra/db/schema/lists";
import { getListMovies } from "@/modules/my-list/server";
import { forceFailure, getMovies, seedList, seedUser } from "../../helpers/db";
import { makeMovie } from "../../helpers/factories";

// Phase 1 smoke test: proves the per-worker SQLite file, migrations and reset hooks work.
describe("integration infrastructure", () => {
  test("uses a temp file DB, not :memory: (F4)", () => {
    expect(process.env.DATABASE_URL).toMatch(
      /^file:.*cineradar-vitest-\d+\.db$/,
    );
  });

  test("seeds and reads through app code", async () => {
    const user = await seedUser();
    const movies = [makeMovie(), makeMovie({ movieId: 2, name: "Heat" })];
    await seedList(user.id, movies);

    expect(await getListMovies(user.id)).toEqual(movies);
    expect(await getMovies(user.id)).toEqual(movies);
  });

  test("resets the DB between tests", async () => {
    expect(await db.select().from(lists)).toEqual([]);
  });

  test("keeps the schema after a transaction (F4)", async () => {
    const user = await seedUser();
    await db.transaction(async (tx) => {
      await tx.insert(lists).values({ userId: user.id, movies: [] });
    });
    expect(await getMovies(user.id)).toEqual([]);
  });

  test("forceFailure makes writes fail inside SQLite", async () => {
    const user = await seedUser();
    await forceFailure("INSERT", "lists");
    await expect(seedList(user.id, [])).rejects.toThrow();
  });
});
