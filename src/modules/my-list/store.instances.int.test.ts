import { expect, test, vi } from "vitest";
import { getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

// Server instances don't share a DB client, so this loads the store twice to
// give each "instance" its own connection. The local file client runs each
// statement synchronously, so the two saves don't really interleave. What this
// guards: if a save became a multi-statement transaction again, the second
// connection would fail with SQLITE_BUSY. Real cross-connection concurrency is
// covered by the e2e tests against a libsql server.
// Its own file: vi.resetModules() leaves the registry pointing at the last instance.
const loadInstance = () => {
  vi.resetModules();
  return import("./store");
};

test("concurrent saves from two instances both land", async () => {
  const user = await seedUser();
  const existing = makeMovie({ movieId: 3 });
  await seedList(user.id, [existing]);
  const [one, two] = [await loadInstance(), await loadInstance()];
  const entries = [makeMovie({ movieId: 1 }), makeMovie({ movieId: 2 })];

  await Promise.all([
    one.saveEntry(user.id, entries[0]),
    two.saveEntry(user.id, entries[1]),
  ]);

  const stored = await getMovies(user.id);
  expect(stored).toHaveLength(3);
  expect(stored).toEqual(expect.arrayContaining([existing, ...entries]));
});
