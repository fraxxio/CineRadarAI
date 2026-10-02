import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/infra/db";
import { lists } from "./schema";
import { clearList, getEntries, removeEntry, saveEntry } from "./store";
import { forceFailure, getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

// `cache` is the identity shim (tests/setup/shared.ts), so nothing is cached across tests
describe("getEntries", () => {
  test("returns the stored entries", async () => {
    const user = await seedUser();
    const entries = [
      makeMovie({ movieId: 1 }),
      makeMovie({ movieId: 2, type: "tv" }),
    ];
    await seedList(user.id, entries);

    expect(await getEntries(user.id)).toEqual(entries);
  });

  test("returns [] for a user with no row", async () => {
    const user = await seedUser();
    expect(await getEntries(user.id)).toEqual([]);
  });

  test("returns [] for a row with movies = null", async () => {
    const user = await seedUser();
    await seedList(user.id, null);
    expect(await getEntries(user.id)).toEqual([]);
  });
});

describe("saveEntry", () => {
  const entry = makeMovie({ movieId: 550, name: "Fight Club", rating: 8 });

  test("inserts a row when the user has none", async () => {
    const user = await seedUser();

    await saveEntry(user.id, entry);

    expect(await getMovies(user.id)).toEqual([entry]);
  });

  test("appends to an existing list", async () => {
    const user = await seedUser();
    const existing = makeMovie({ movieId: 1 });
    await seedList(user.id, [existing]);

    await saveEntry(user.id, entry);

    expect(await getMovies(user.id)).toEqual([existing, entry]);
  });

  test("appends to a row with movies = null", async () => {
    const user = await seedUser();
    await seedList(user.id, null);

    await saveEntry(user.id, entry);

    expect(await getMovies(user.id)).toEqual([entry]);
  });

  test("replaces the entry with the same key in place", async () => {
    const user = await seedUser();
    const before = makeMovie({ movieId: 1 });
    const after = makeMovie({ movieId: 2 });
    await seedList(user.id, [
      before,
      { ...entry, status: "Planning to watch", rating: 0 },
      after,
    ]);

    await saveEntry(user.id, { ...entry, status: "Watching", rating: 3 });

    expect(await getMovies(user.id)).toEqual([
      before,
      { ...entry, status: "Watching", rating: 3 },
      after,
    ]);
  });

  test("[B4] a TV show with the same id doesn't overwrite a movie", async () => {
    const user = await seedUser();
    const movie = makeMovie({ movieId: 550, type: "movie" });
    await seedList(user.id, [movie]);
    const show = makeMovie({ movieId: 550, type: "tv", name: "Show" });

    await saveEntry(user.id, show);

    expect(await getMovies(user.id)).toEqual([movie, show]);
  });

  test("only touches the given user's list", async () => {
    const user = await seedUser();
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 550 })];
    await seedList(other.id, otherEntries);

    await saveEntry(user.id, { ...entry, status: "Watching" });

    expect(await getMovies(other.id)).toEqual(otherEntries);
  });

  test("two concurrent saves of different titles both survive", async () => {
    const user = await seedUser();
    await seedList(user.id, []);
    const a = makeMovie({ movieId: 1, name: "A" });
    const b = makeMovie({ movieId: 2, name: "B" });

    await Promise.all([saveEntry(user.id, a), saveEntry(user.id, b)]);

    const stored = await getMovies(user.id);
    expect(stored).toHaveLength(2);
    expect(stored).toEqual(expect.arrayContaining([a, b]));
  });

  test("two concurrent first saves both survive", async () => {
    const user = await seedUser();
    const a = makeMovie({ movieId: 1, name: "A" });
    const b = makeMovie({ movieId: 2, name: "B" });

    await Promise.all([saveEntry(user.id, a), saveEntry(user.id, b)]);

    const rows = await db.select().from(lists).where(eq(lists.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].movies).toEqual(expect.arrayContaining([a, b]));
  });

  describe("DB failures", () => {
    test("throws and keeps the list when the update fails", async () => {
      const user = await seedUser();
      const existing = [makeMovie({ movieId: 1 })];
      await seedList(user.id, existing);
      await forceFailure("UPDATE", "lists");

      await expect(saveEntry(user.id, entry)).rejects.toThrow("forced failure");
      expect(await getMovies(user.id)).toEqual(existing);
    });

    test("throws and inserts nothing when the insert fails", async () => {
      const user = await seedUser();
      await forceFailure("INSERT", "lists");

      await expect(saveEntry(user.id, entry)).rejects.toThrow("forced failure");
      expect(await getMovies(user.id)).toBeUndefined();
    });
  });
});

describe("removeEntry", () => {
  test("removes only the matching entry", async () => {
    const user = await seedUser();
    const keep = [makeMovie({ movieId: 1 }), makeMovie({ movieId: 2 })];
    await seedList(user.id, [keep[0], makeMovie({ movieId: 550 }), keep[1]]);

    await expect(
      removeEntry(user.id, { movieId: 550, type: "movie" }),
    ).resolves.toBe(true);

    expect(await getMovies(user.id)).toEqual(keep);
  });

  test("[B4] removing a movie keeps a TV show with the same id", async () => {
    const user = await seedUser();
    const show = makeMovie({ movieId: 550, type: "tv" });
    await seedList(user.id, [makeMovie({ movieId: 550, type: "movie" }), show]);

    await removeEntry(user.id, { movieId: 550, type: "movie" });

    expect(await getMovies(user.id)).toEqual([show]);
  });

  test("[B4] removing a TV show keeps a movie with the same id", async () => {
    const user = await seedUser();
    const movie = makeMovie({ movieId: 550, type: "movie" });
    await seedList(user.id, [movie, makeMovie({ movieId: 550, type: "tv" })]);

    await removeEntry(user.id, { movieId: 550, type: "tv" });

    expect(await getMovies(user.id)).toEqual([movie]);
  });

  test("an entry that isn't in the list is a no-op", async () => {
    const user = await seedUser();
    const entries = [makeMovie({ movieId: 1 })];
    await seedList(user.id, entries);

    await expect(
      removeEntry(user.id, { movieId: 999, type: "movie" }),
    ).resolves.toBe(true);

    expect(await getMovies(user.id)).toEqual(entries);
  });

  test("resolves false and creates no row when the user has no list", async () => {
    const user = await seedUser();

    await expect(
      removeEntry(user.id, { movieId: 550, type: "movie" }),
    ).resolves.toBe(false);

    expect(await getMovies(user.id)).toBeUndefined();
  });

  test("only touches the given user's list", async () => {
    const user = await seedUser();
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 550 })];
    await seedList(user.id, [makeMovie({ movieId: 550 })]);
    await seedList(other.id, otherEntries);

    await removeEntry(user.id, { movieId: 550, type: "movie" });

    expect(await getMovies(other.id)).toEqual(otherEntries);
  });

  test("a concurrent save and remove both apply", async () => {
    const user = await seedUser();
    const added = makeMovie({ movieId: 2 });
    await seedList(user.id, [makeMovie({ movieId: 1 })]);

    await Promise.all([
      saveEntry(user.id, added),
      removeEntry(user.id, { movieId: 1, type: "movie" }),
    ]);

    expect(await getMovies(user.id)).toEqual([added]);
  });

  test("throws and keeps the list when the update fails", async () => {
    const user = await seedUser();
    const entries = [makeMovie({ movieId: 550 })];
    await seedList(user.id, entries);
    await forceFailure("UPDATE", "lists");

    await expect(
      removeEntry(user.id, { movieId: 550, type: "movie" }),
    ).rejects.toThrow("forced failure");
    expect(await getMovies(user.id)).toEqual(entries);
  });
});

describe("clearList", () => {
  test("deletes the user's list and keeps the others", async () => {
    const user = await seedUser();
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 1 })];
    await seedList(user.id, [makeMovie({ movieId: 1 })]);
    await seedList(other.id, otherEntries);

    await clearList(user.id);

    expect(await getMovies(user.id)).toBeUndefined();
    expect(await getMovies(other.id)).toEqual(otherEntries);
  });

  test("is a no-op when the user has no list", async () => {
    const user = await seedUser();
    await expect(clearList(user.id)).resolves.toBeUndefined();
  });

  test("runs inside the given transaction", async () => {
    const user = await seedUser();
    const entries = [makeMovie({ movieId: 1 })];
    await seedList(user.id, entries);

    await expect(
      db.transaction(async (tx) => {
        await clearList(user.id, tx);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await getMovies(user.id)).toEqual(entries);
  });

  test("throws when the delete fails", async () => {
    const user = await seedUser();
    await seedList(user.id, [makeMovie({ movieId: 1 })]);
    await forceFailure("DELETE", "lists");

    await expect(clearList(user.id)).rejects.toThrow("forced failure");
  });
});
