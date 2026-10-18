import { describe, expect, it, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/infra/db";
import { users } from "@/infra/db/schema/users";
import {
  getEntry,
  getListCounts,
  getListPage,
  getShelf,
  readEntries,
  removeEntry,
  saveEntry,
  saveEntryStatus,
} from "./store";
import type { ListStatus } from "./entry";
import { DEFAULT_VIEW, PAGE_SIZE, SHELF_SIZE, type ListView } from "./view";
import {
  forceFailure,
  getMovies,
  seedList,
  seedUser,
  type ListMovie,
} from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

// `cache` is the identity shim (tests/setup/shared.ts), so nothing is cached across tests
describe("readEntries", () => {
  test("returns the stored entries in insertion order", async () => {
    const user = await seedUser();
    const entries = [
      makeMovie({ movieId: 2, type: "tv" }),
      makeMovie({ movieId: 1 }),
    ];
    await seedList(user.id, entries);

    expect(await readEntries(user.id)).toEqual(entries);
  });

  test("returns [] for a user with no entries", async () => {
    const user = await seedUser();
    expect(await readEntries(user.id)).toEqual([]);
  });
});

describe("getListPage", () => {
  // ratings across both types, all three statuses and a legacy one
  const fixture: ListMovie[] = [
    makeMovie({ movieId: 1, name: "Fury", status: "Completed", rating: 7 }),
    makeMovie({ movieId: 2, name: "Heat", status: "Planning to watch" }),
    makeMovie({ movieId: 3, name: "Alien", status: "Watching", rating: 10 }),
    makeMovie({
      movieId: 4,
      name: "Dark",
      type: "tv",
      status: "Watching",
      rating: 3,
    }),
    makeMovie({ movieId: 5, name: "Lost", type: "tv", status: "Completed" }),
    makeMovie({
      movieId: 6,
      name: "Fargo",
      type: "tv",
      status: "Watching",
      rating: 7,
    }),
    {
      ...makeMovie({ movieId: 7, name: "Ozark", type: "tv" }),
      status: "Dropped",
    },
  ];

  const names = async (userId: string, changes: Partial<ListView> = {}) =>
    (await getListPage(userId, { ...DEFAULT_VIEW, ...changes })).map(
      (entry) => entry.name,
    );

  const seeded = async (entries = fixture) => {
    const user = await seedUser();
    await seedList(user.id, entries);
    return user.id;
  };

  test("the default view: every row, highest rated first, unrated last", async () => {
    const userId = await seeded();
    expect(await names(userId)).toEqual([
      "Alien",
      "Fury",
      "Fargo",
      "Dark",
      "Heat",
      "Lost",
      "Ozark",
    ]);
  });

  test("returns the stored entry shape", async () => {
    const userId = await seeded();
    const [first] = await getListPage(userId, DEFAULT_VIEW);
    expect(first).toEqual(fixture[2]);
  });

  test("rating-asc: lowest rated first, unrated still last", async () => {
    const userId = await seeded();
    expect(await names(userId, { sort: "rating-asc" })).toEqual([
      "Dark",
      "Fury",
      "Fargo",
      "Alien",
      "Heat",
      "Lost",
      "Ozark",
    ]);
  });

  test("recent: the newest first", async () => {
    const userId = await seeded();
    expect(await names(userId, { sort: "recent" })).toEqual([
      "Ozark",
      "Fargo",
      "Lost",
      "Dark",
      "Alien",
      "Heat",
      "Fury",
    ]);
  });

  it.each(["rating-desc", "rating-asc"] as const)(
    "%s: equal ratings keep insertion order",
    async (sort) => {
      const userId = await seeded([
        makeMovie({ movieId: 3, name: "C", rating: 5 }),
        makeMovie({ movieId: 1, name: "A", rating: 5 }),
        makeMovie({ movieId: 2, name: "B", rating: 5 }),
      ]);
      expect(await names(userId, { sort })).toEqual(["C", "A", "B"]);
    },
  );

  it.each([
    ["watching", ["Alien", "Fargo", "Dark"]],
    ["planning", ["Heat"]],
    ["completed", ["Fury", "Lost"]],
    ["other", ["Ozark"]],
  ] as const)("status %s", async (status, expected) => {
    const userId = await seeded();
    expect(await names(userId, { status })).toEqual(expected);
  });

  it.each([
    ["movie", ["Alien", "Fury", "Heat"]],
    ["tv", ["Fargo", "Dark", "Lost", "Ozark"]],
  ] as const)("type %s", async (type, expected) => {
    const userId = await seeded();
    expect(await names(userId, { type })).toEqual(expected);
  });

  test("combines the status and type filters", async () => {
    const userId = await seeded();
    expect(await names(userId, { status: "watching", type: "tv" })).toEqual([
      "Fargo",
      "Dark",
    ]);
    expect(await names(userId, { status: "other", type: "movie" })).toEqual([]);
  });

  describe("pages", () => {
    // 30 rows, all rated 5, so the order is insertion order
    const many = Array.from({ length: 30 }, (_, i) =>
      makeMovie({ movieId: i + 1, name: `Title ${i + 1}`, rating: 5 }),
    );
    const titles = (from: number, to: number) =>
      many.slice(from, to).map((entry) => entry.name);

    test("page 1 holds PAGE_SIZE rows", async () => {
      const userId = await seeded(many);
      expect(PAGE_SIZE).toBe(24);
      expect(await names(userId, { page: 1 })).toEqual(titles(0, 24));
    });

    test("page 2 holds the rest", async () => {
      const userId = await seeded(many);
      expect(await names(userId, { page: 2 })).toEqual(titles(24, 30));
    });

    test("a page past the end is empty", async () => {
      const userId = await seeded(many);
      expect(await names(userId, { page: 3 })).toEqual([]);
    });

    test("pages follow the sort", async () => {
      const userId = await seeded(many);
      expect(await names(userId, { sort: "recent", page: 2 })).toEqual(
        titles(0, 6).reverse(),
      );
    });
  });

  test("only reads the given user's rows", async () => {
    const userId = await seeded();
    const other = await seeded([
      makeMovie({ movieId: 99, name: "Theirs", rating: 10 }),
    ]);
    expect(await names(other)).toEqual(["Theirs"]);
    expect(await names(userId)).not.toContain("Theirs");
  });

  test("returns [] for a user with no entries", async () => {
    const user = await seedUser();
    expect(await getListPage(user.id, DEFAULT_VIEW)).toEqual([]);
  });
});

describe("getShelf", () => {
  const seeded = async (entries: ListMovie[]) => {
    const user = await seedUser();
    await seedList(user.id, entries);
    return user.id;
  };

  const names = async (userId: string, shelf: Parameters<typeof getShelf>[1]) =>
    (await getShelf(userId, shelf)).map((entry) => entry.name);

  // 8 watching titles, rated 1-8 in insertion order, half of them TV
  const watching = Array.from({ length: 8 }, (_, i) =>
    makeMovie({
      movieId: i + 1,
      name: `W${i + 1}`,
      type: i % 2 ? "tv" : "movie",
      status: "Watching",
      rating: i + 1,
    }),
  );

  test("holds at most SHELF_SIZE rows, in the sort", async () => {
    const userId = await seeded(watching);
    expect(SHELF_SIZE).toBe(6);
    expect(
      await names(userId, {
        status: "watching",
        type: "both",
        sort: "rating-desc",
      }),
    ).toEqual(["W8", "W7", "W6", "W5", "W4", "W3"]);
    expect(
      await names(userId, {
        status: "watching",
        type: "both",
        sort: "rating-asc",
      }),
    ).toEqual(["W1", "W2", "W3", "W4", "W5", "W6"]);
  });

  test("recent: the newest first", async () => {
    const userId = await seeded([
      ...watching,
      makeMovie({ movieId: 9, name: "W9", status: "Watching" }),
    ]);
    expect(
      await names(userId, { status: "watching", type: "both", sort: "recent" }),
    ).toEqual(["W9", "W8", "W7", "W6", "W5", "W4"]);
  });

  test("respects the type", async () => {
    const userId = await seeded(watching);
    expect(
      await names(userId, {
        status: "watching",
        type: "tv",
        sort: "rating-desc",
      }),
    ).toEqual(["W8", "W6", "W4", "W2"]);
  });

  test("only holds its status", async () => {
    const userId = await seeded([
      ...watching,
      makeMovie({ movieId: 20, name: "Done", status: "Completed", rating: 9 }),
    ]);
    expect(
      await names(userId, {
        status: "completed",
        type: "both",
        sort: "rating-desc",
      }),
    ).toEqual(["Done"]);
  });

  test("the other shelf holds the legacy statuses", async () => {
    const userId = await seeded([
      ...watching,
      { ...makeMovie({ movieId: 20, name: "Gone" }), status: "Dropped" },
      {
        ...makeMovie({ movieId: 21, name: "Held", type: "tv", rating: 4 }),
        status: "On hold",
      },
    ]);
    expect(
      await names(userId, {
        status: "other",
        type: "both",
        sort: "rating-desc",
      }),
    ).toEqual(["Held", "Gone"]);
  });

  test("only reads the given user's rows", async () => {
    const userId = await seeded(watching);
    const other = await seeded([
      makeMovie({ movieId: 99, name: "Theirs", status: "Watching" }),
    ]);
    expect(
      await names(other, {
        status: "watching",
        type: "both",
        sort: "rating-desc",
      }),
    ).toEqual(["Theirs"]);
    expect(
      await names(userId, {
        status: "watching",
        type: "both",
        sort: "rating-desc",
      }),
    ).not.toContain("Theirs");
  });
});

describe("getListCounts", () => {
  const sorted = (rows: Awaited<ReturnType<typeof getListCounts>>) =>
    [...rows].sort((a, b) =>
      `${a.status}-${a.type}`.localeCompare(`${b.status}-${b.type}`),
    );

  test("one row per stored status and type", async () => {
    const user = await seedUser();
    await seedList(user.id, [
      makeMovie({ movieId: 1, status: "Watching" }),
      makeMovie({ movieId: 2, status: "Watching" }),
      makeMovie({ movieId: 3, type: "tv", status: "Watching" }),
      makeMovie({ movieId: 4, status: "Completed" }),
      { ...makeMovie({ movieId: 5 }), status: "Dropped" as ListStatus },
    ]);

    expect(sorted(await getListCounts(user.id))).toEqual([
      { status: "Completed", type: "movie", count: 1 },
      { status: "Dropped", type: "movie", count: 1 },
      { status: "Watching", type: "movie", count: 2 },
      { status: "Watching", type: "tv", count: 1 },
    ]);
  });

  test("only counts the given user's rows", async () => {
    const user = await seedUser();
    const other = await seedUser();
    await seedList(user.id, [makeMovie({ movieId: 1 })]);
    await seedList(other.id, [
      makeMovie({ movieId: 1 }),
      makeMovie({ movieId: 2 }),
    ]);

    expect(await getListCounts(user.id)).toEqual([
      { status: "Completed", type: "movie", count: 1 },
    ]);
  });

  test("[] for a user with no entries", async () => {
    const user = await seedUser();
    expect(await getListCounts(user.id)).toEqual([]);
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

describe("getEntry", () => {
  test("finds the entry by key", async () => {
    const user = await seedUser();
    const entry = makeMovie({ movieId: 550, rating: 8 });
    await seedList(user.id, [makeMovie({ movieId: 1 }), entry]);

    expect(await getEntry(user.id, { movieId: 550, type: "movie" })).toEqual(
      entry,
    );
  });

  test("[B4] keeps a movie and a TV show with the same id apart", async () => {
    const user = await seedUser();
    const movie = makeMovie({ movieId: 550, type: "movie", name: "Movie" });
    const show = makeMovie({ movieId: 550, type: "tv", name: "Show" });
    await seedList(user.id, [movie, show]);

    expect(await getEntry(user.id, { movieId: 550, type: "tv" })).toEqual(show);
    expect(await getEntry(user.id, { movieId: 550, type: "movie" })).toEqual(
      movie,
    );
  });

  test("returns undefined when the title isn't in the list", async () => {
    const user = await seedUser();
    await seedList(user.id, [makeMovie({ movieId: 550, type: "tv" })]);

    expect(
      await getEntry(user.id, { movieId: 550, type: "movie" }),
    ).toBeUndefined();
  });

  test("doesn't find another user's entry", async () => {
    const user = await seedUser();
    const other = await seedUser();
    await seedList(other.id, [makeMovie({ movieId: 550 })]);

    expect(
      await getEntry(user.id, { movieId: 550, type: "movie" }),
    ).toBeUndefined();
  });
});

describe("saveEntryStatus", () => {
  const entry = {
    movieId: 550,
    type: "movie" as const,
    name: "Fight Club",
    image: "/new.jpg",
    status: "Watching" as const,
  };

  test("adds a new entry unrated, at the end", async () => {
    const user = await seedUser();
    const existing = makeMovie({ movieId: 1 });
    await seedList(user.id, [existing]);

    await saveEntryStatus(user.id, entry);

    expect(await getMovies(user.id)).toEqual([
      existing,
      { ...entry, rating: 0 },
    ]);
  });

  test("changes only the status of an existing entry, in place", async () => {
    const user = await seedUser();
    const before = makeMovie({ movieId: 1 });
    const after = makeMovie({ movieId: 2 });
    const stored = makeMovie({
      movieId: 550,
      name: "Fight Club (1999)",
      image: "/old.jpg",
      status: "Planning to watch",
      rating: 8,
    });
    await seedList(user.id, [before, stored, after]);

    await saveEntryStatus(user.id, { ...entry, status: "Completed" });

    expect(await getMovies(user.id)).toEqual([
      before,
      { ...stored, status: "Completed" },
      after,
    ]);
  });

  test("[B4] a TV show with the same id doesn't change a movie", async () => {
    const user = await seedUser();
    const movie = makeMovie({ movieId: 550, status: "Completed", rating: 7 });
    await seedList(user.id, [movie]);

    await saveEntryStatus(user.id, { ...entry, type: "tv" });

    expect(await getMovies(user.id)).toEqual([
      movie,
      { ...entry, type: "tv", rating: 0 },
    ]);
  });

  test("only touches the given user's list", async () => {
    const user = await seedUser();
    const other = await seedUser();
    const otherEntries = [makeMovie({ movieId: 550, rating: 9 })];
    await seedList(other.id, otherEntries);

    await saveEntryStatus(user.id, entry);

    expect(await getMovies(other.id)).toEqual(otherEntries);
    expect(await getMovies(user.id)).toEqual([{ ...entry, rating: 0 }]);
  });

  test("throws and keeps the old values when the update fails", async () => {
    const user = await seedUser();
    const existing = [makeMovie({ movieId: 550, rating: 8 })];
    await seedList(user.id, existing);
    await forceFailure("UPDATE", "list_entries");

    await expect(saveEntryStatus(user.id, entry)).rejects.toThrow(
      "forced failure",
    );
    expect(await getMovies(user.id)).toEqual(existing);
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
