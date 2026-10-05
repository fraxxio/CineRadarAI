import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/infra/db";
import { users } from "@/infra/db/schema/users";
import { getEntries, removeEntry, saveEntry } from "./store";
import { forceFailure, getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

// `cache` is the identity shim (tests/setup/shared.ts), so nothing is cached across tests
describe("getEntries", () => {
  test("returns the stored entries in insertion order", async () => {
    const user = await seedUser();
    const entries = [
      makeMovie({ movieId: 2, type: "tv" }),
      makeMovie({ movieId: 1 }),
    ];
    await seedList(user.id, entries);

    expect(await getEntries(user.id)).toEqual(entries);
  });

  test("returns [] for a user with no entries", async () => {
    const user = await seedUser();
    expect(await getEntries(user.id)).toEqual([]);
  });
});

describe("saveEntry", () => {
  const entry = makeMovie({ movieId: 550, name: "Fight Club", rating: 8 });

  test("adds the first entry", async () => {
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

  // The local file client runs each statement synchronously, so these
  // "concurrent" single-statement writes actually run one after another: they
  // check the outcome, not real interleaving. The e2e tests in my-list.spec.ts
  // run concurrent saves against a libsql server, as in production.
  test("two concurrent saves of different titles both land", async () => {
    const user = await seedUser();
    await seedList(user.id, [makeMovie({ movieId: 3 })]);
    const a = makeMovie({ movieId: 1, name: "A" });
    const b = makeMovie({ movieId: 2, name: "B" });

    await Promise.all([saveEntry(user.id, a), saveEntry(user.id, b)]);

    const stored = await getMovies(user.id);
    expect(stored).toHaveLength(3);
    expect(stored).toEqual(expect.arrayContaining([a, b]));
  });

  test("two concurrent first saves both land", async () => {
    const user = await seedUser();
    const a = makeMovie({ movieId: 1, name: "A" });
    const b = makeMovie({ movieId: 2, name: "B" });

    await Promise.all([saveEntry(user.id, a), saveEntry(user.id, b)]);

    const stored = await getMovies(user.id);
    expect(stored).toHaveLength(2);
    expect(stored).toEqual(expect.arrayContaining([a, b]));
  });

  test("two concurrent saves of the same key leave one row", async () => {
    const user = await seedUser();
    const a = { ...entry, status: "Watching" as const, rating: 3 };
    const b = { ...entry, status: "Completed" as const, rating: 9 };

    await Promise.all([saveEntry(user.id, a), saveEntry(user.id, b)]);

    const stored = await getMovies(user.id);
    expect(stored).toHaveLength(1);
    expect([a, b]).toContainEqual(stored[0]);
  });

  test("rejects for a user that doesn't exist", async () => {
    await expect(saveEntry("no-such-user", entry)).rejects.toThrow(
      /FOREIGN KEY/,
    );
    expect(await getMovies("no-such-user")).toEqual([]);
  });

  describe("DB failures", () => {
    // a BEFORE INSERT trigger fires for every upsert, including the update path
    test("throws and keeps the list when the insert fails", async () => {
      const user = await seedUser();
      const existing = [makeMovie({ movieId: 1 })];
      await seedList(user.id, existing);
      await forceFailure("INSERT", "list_entries");

      await expect(saveEntry(user.id, entry)).rejects.toThrow("forced failure");
      expect(await getMovies(user.id)).toEqual(existing);
    });

    test("throws and keeps the old values when the replace fails", async () => {
      const user = await seedUser();
      const existing = [{ ...entry, status: "Planning to watch", rating: 0 }];
      await seedList(user.id, existing);
      await forceFailure("UPDATE", "list_entries");

      await expect(
        saveEntry(user.id, { ...entry, status: "Watching", rating: 3 }),
      ).rejects.toThrow("forced failure");
      expect(await getMovies(user.id)).toEqual(existing);
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
    ).resolves.toBeUndefined();

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

    await removeEntry(user.id, { movieId: 999, type: "movie" });

    expect(await getMovies(user.id)).toEqual(entries);
  });

  test("a user with no entries is a no-op", async () => {
    const user = await seedUser();

    await expect(
      removeEntry(user.id, { movieId: 550, type: "movie" }),
    ).resolves.toBeUndefined();

    expect(await getMovies(user.id)).toEqual([]);
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

  // runs sequentially on the local file client, see the note in saveEntry
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

  test("throws and keeps the list when the delete fails", async () => {
    const user = await seedUser();
    const entries = [makeMovie({ movieId: 550 })];
    await seedList(user.id, entries);
    await forceFailure("DELETE", "list_entries");

    await expect(
      removeEntry(user.id, { movieId: 550, type: "movie" }),
    ).rejects.toThrow("forced failure");
    expect(await getMovies(user.id)).toEqual(entries);
  });
});

describe("deleting a user", () => {
  test("deletes their entries and keeps other users' entries", async () => {
    const user = await seedUser();
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 1 })];
    await seedList(user.id, [makeMovie({ movieId: 1 })]);
    await seedList(other.id, otherEntries);

    await db.delete(users).where(eq(users.id, user.id));

    expect(await getMovies(user.id)).toEqual([]);
    expect(await getMovies(other.id)).toEqual(otherEntries);
  });
});
