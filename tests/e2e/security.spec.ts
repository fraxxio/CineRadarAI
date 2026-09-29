import type { APIRequestContext } from "@playwright/test";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { expect, test, type TestUser } from "./fixtures";
import { getMovies, seedList, type ListMovie } from "./helpers/db";

// B1/B2 over real HTTP: the list routes trust the userId they're sent.

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
    headers: { userId, movieId: "1" },
  });

test.fail(
  "[B1] an anonymous PUT can't change another user's list",
  async ({ request, seedUser, db }) => {
    const victim = await seedVictim(seedUser, db);

    await overwrite(request, victim.id);

    expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
  },
);

test.fail(
  "[B1] a logged-in user can't PUT into another user's list",
  async ({ page, loginAs, seedUser, db }) => {
    const victim = await seedVictim(seedUser, db);
    await loginAs();

    // page.request shares the context's session cookie
    await overwrite(page.request, victim.id);

    expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
  },
);

test.fail(
  "[B2] an anonymous DELETE can't remove another user's entry",
  async ({ request, seedUser, db }) => {
    const victim = await seedVictim(seedUser, db);

    await remove(request, victim.id);

    expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
  },
);

test.fail(
  "[B2] a logged-in user can't DELETE from another user's list",
  async ({ page, loginAs, seedUser, db }) => {
    const victim = await seedVictim(seedUser, db);
    await loginAs();

    await remove(page.request, victim.id);

    expect(await getMovies(db, victim.id)).toEqual([victimEntry]);
  },
);
