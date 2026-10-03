import { expect, test, vi } from "vitest";
import { getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

// store.int.test.ts runs its concurrent saves in one process, where the write
// queue in @/infra/db already serialises them. Across server instances only the
// DB's write lock does, so this gives each "instance" its own client and queue.
// Its own file: vi.resetModules() leaves the registry pointing at the last
// instance, and a losing local client stays unusable.
const loadInstance = () => {
  vi.resetModules();
  return import("./store");
};

test("a save from another instance can't overwrite a concurrent save", async () => {
  const user = await seedUser();
  await seedList(user.id, []);
  const [one, two] = [await loadInstance(), await loadInstance()];
  const entries = [makeMovie({ movieId: 1 }), makeMovie({ movieId: 2 })];

  const results = await Promise.allSettled([
    one.saveEntry(user.id, entries[0]),
    two.saveEntry(user.id, entries[1]),
  ]);

  // the local file DB rejects the second writer (SQLITE_BUSY), a libsql server
  // makes it wait: either way, no save that resolved is lost
  const saved = entries.filter((_, i) => results[i].status === "fulfilled");
  expect(saved.length).toBeGreaterThan(0);
  expect(await getMovies(user.id)).toEqual(saved);
});
