import { describe, expect, test } from "vitest";
import { getListMovies } from "@/lib/myList";
import { seedList, seedUser } from "../../helpers/db";
import { makeMovie } from "../../helpers/factories";

// `cache` is the identity shim (tests/setup/shared.ts), so nothing is cached across tests
describe("getListMovies", () => {
  test("returns the stored movies", async () => {
    const user = await seedUser();
    const movies = [
      makeMovie({ movieId: 1 }),
      makeMovie({ movieId: 2, type: "tv" }),
    ];
    await seedList(user.id, movies);

    expect(await getListMovies(user.id)).toEqual(movies);
  });

  test("returns [] for a user with no row", async () => {
    const user = await seedUser();
    expect(await getListMovies(user.id)).toEqual([]);
  });

  test("returns [] for a row with movies = null", async () => {
    const user = await seedUser();
    await seedList(user.id, null);
    expect(await getListMovies(user.id)).toEqual([]);
  });
});
