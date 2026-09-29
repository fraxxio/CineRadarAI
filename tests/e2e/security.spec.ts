import type { APIRequestContext } from "@playwright/test";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { expect, test, type TestUser } from "./fixtures";
import { getMovies, seedList, type ListMovie } from "./helpers/db";

// B1/B2 over real HTTP: the list routes must ignore the userId they're sent
// and only act on the session user.

const victimEntry: ListMovie = {
  movieId: 1,
  name: "Victim's movie",
  image: "/v.jpg",
  rating: 9,
  status: "Completed",
  type: "movie",
};

async function seedVictim(
  seedUser: (o?: Partial<TestUser>) => Promise<TestUser>,
  db: LibSQLDatabase,
) {
  const victim = await seedUser();
  await seedList(db, victim.id, [victimEntry]);
  return victim;
}

const overwrite = (request: APIRequestContext, userId: string) =>
  request.put("/api/add-to-list", {
    data: {
      userId,
      movieId: "1",
      title: "x",
      image: "",
      status: "Completed",
      rating: "",
      type: "movie",
    },
  });

const remove = (request: APIRequestContext, userId: string) =>
  request.delete("/api/remove-from-list", {
    headers: { userId, movieId: "1", type: "movie" },
  });

test("[B1] an anonymous PUT can't change another user's list", async ({
  request,
  seedUser,
  db,
}) => {
  const victim = await seedVictim(seedUser, db);

  const res = await overwrite(request, victim.id);

  expect(res.status()).toBe(401);
  expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
});

test("[B1] a logged-in user can't PUT into another user's list", async ({
  page,
  loginAs,
  seedUser,
  db,
}) => {
  const victim = await seedVictim(seedUser, db);
  const attacker = await loginAs();

  // page.request shares the context's session cookie
  const res = await overwrite(page.request, victim.id);

  expect(res.ok()).toBe(true);
  expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
  // the entry went to the attacker's own list instead
  expect(await getMovies(db, attacker.id)).toEqual([
    expect.objectContaining({ movieId: 1, name: "x" }),
  ]);
});

test("[B2] an anonymous DELETE can't remove another user's entry", async ({
  request,
  seedUser,
  db,
}) => {
  const victim = await seedVictim(seedUser, db);

  const res = await remove(request, victim.id);

  expect(res.status()).toBe(401);
  expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
});

test("[B2] a logged-in user can't DELETE from another user's list", async ({
  page,
  loginAs,
  seedUser,
  db,
}) => {
  const victim = await seedVictim(seedUser, db);
  await loginAs();

  const res = await remove(page.request, victim.id);

  // the attacker has no list row, so there is nothing to remove
  expect(await res.json()).toEqual({ addToListResult: "fail" });
  expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
});
