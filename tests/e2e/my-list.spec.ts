import type { Page } from "@playwright/test";
import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";
import { getMovies, seedList, type ListMovie } from "./helpers/db";

const fightClub: ListMovie = {
  movieId: 550,
  name: "Fight Club",
  image: "/fight-club.jpg",
  rating: 8,
  status: "Completed",
  type: "movie",
};

// ratings 0/3/7/10 across both types and all three statuses
const mixed: ListMovie[] = [
  {
    movieId: 1,
    name: "Alpha Movie",
    image: "/a.jpg",
    rating: 0,
    status: "Completed",
    type: "movie",
  },
  {
    movieId: 2,
    name: "Bravo Show",
    image: "/b.jpg",
    rating: 3,
    status: "Watching",
    type: "tv",
  },
  {
    movieId: 3,
    name: "Charlie Movie",
    image: "/c.jpg",
    rating: 7,
    status: "Planning to watch",
    type: "movie",
  },
  {
    movieId: 4,
    name: "Delta Show",
    image: "/d.jpg",
    rating: 10,
    status: "Completed",
    type: "tv",
  },
];

// a ListCard: the only bordered row that contains an item link
const row = (page: Page, name: string) =>
  page
    .locator("main div.border-b")
    .filter({ has: page.getByRole("link", { name, exact: true }) });

const itemLinks = (page: Page) => page.locator('main a[href^="/search/"]');

async function expectItems(page: Page, names: string[]) {
  await expect(itemLinks(page)).toHaveText(names);
  await expect(page.getByText(`Length: ${names.length}`)).toBeVisible();
}

test("add from the details page", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await page.goto("/search/movie/550");

  await page.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Completed");
  await dialog.getByLabel("Rating (optional):").selectOption("8");
  await dialog.getByRole("button", { name: "Add to list" }).click();

  await expect(
    page.getByText("Fight Club was added to the list."),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({
      movieId: 550,
      name: "Fight Club",
      rating: 8,
      status: "Completed",
      type: "movie",
    }),
  ]);
});

test("the list shows a saved item", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list");

  await expect(
    page.getByRole("heading", { name: `${user.name} movie and TV show list.` }),
  ).toBeVisible();
  const item = row(page, "Fight Club");
  await expect(item.getByRole("link", { name: "Fight Club" })).toHaveAttribute(
    "href",
    "/search/movie/550",
  );
  await expect(item.getByText("8", { exact: true })).toBeVisible();
  await expect(item.getByText("Type: Movie")).toBeVisible();
  await expect(item.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Length: 1")).toBeVisible();
});

test("edit an entry", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list");

  await page.getByRole("button", { name: "Edit list entry" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Watching");
  await dialog.getByLabel("Rating (optional):").selectOption("5");
  await dialog.getByRole("button", { name: "Edit" }).click();

  await expect(page.getByText("Fight Club was updated.")).toBeVisible();
  // router.refresh(), no manual reload
  const item = row(page, "Fight Club");
  await expect(item.getByText("Watching", { exact: true })).toBeVisible();
  await expect(item.getByText("5", { exact: true })).toBeVisible();
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({ movieId: 550, status: "Watching", rating: 5 }),
  ]);
});

test("remove an entry", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list");

  await page.getByRole("button", { name: "Remove from list" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove" })
    .click();

  await expect(page.getByText("Fight Club was removed.")).toBeVisible();
  await expect(page.getByText("Your list is empty.")).toBeVisible();
  await expect(page.getByText("Length: 0")).toBeVisible();
  expect(await getMovies(db, user.id)).toEqual([]);
});

test("sort and filter, with a matching length", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list");
  await expectItems(page, [
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);

  await page.getByRole("link", { name: "Ascending" }).click();
  await expect(page).toHaveURL(/rating=asc/);
  await expectItems(page, [
    "Alpha Movie",
    "Bravo Show",
    "Charlie Movie",
    "Delta Show",
  ]);
  await expect(page.getByRole("button", { name: "Ascending" })).toBeDisabled();

  await page.getByRole("link", { name: "TV shows" }).click();
  await expect(page).toHaveURL(/type=tv/);
  await expectItems(page, ["Bravo Show", "Delta Show"]);

  await page.getByRole("link", { name: "Watching" }).click();
  await expect(page).toHaveURL(/status=watching/);
  await expect(page).toHaveURL(/type=tv/);
  await expectItems(page, ["Bravo Show"]);

  await page.getByRole("link", { name: "Movies" }).click();
  await expect(page).toHaveURL(/type=movie/);
  await expect(page.getByText("Your list is empty.")).toBeVisible();
  await expectItems(page, []);
});

// page.request shares the context's session cookie
const put = (page: Page, movieId: number, rating = "") =>
  page.request.put("/api/add-to-list", {
    data: {
      movieId,
      title: `Movie ${movieId}`,
      image: "",
      status: "Completed",
      rating,
      type: "movie",
    },
  });

// the e2e DB is a libsql server, as in production; each save is a single
// statement, so concurrent saves can't overwrite each other
test("concurrent saves all land", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  const ids = [1, 2, 3, 4, 5];

  const responses = await Promise.all(ids.map((movieId) => put(page, movieId)));

  for (const res of responses) {
    expect(await res.json()).toEqual({ addToListResult: "success" });
  }
  const stored = await getMovies(db, user.id);
  expect(stored.map((entry) => entry.movieId).sort()).toEqual(ids);
});

// the unique (userId, movieId, type) key keeps concurrent saves of one title
// from creating duplicate rows
test("concurrent saves of the same title leave one entry", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  const ratings = ["1", "2", "3", "4", "5"];

  const responses = await Promise.all(
    ratings.map((rating) => put(page, 550, rating)),
  );

  for (const res of responses) {
    expect(await res.json()).toEqual({ addToListResult: "success" });
  }
  const stored = await getMovies(db, user.id);
  expect(stored).toHaveLength(1);
  expect(stored[0].movieId).toBe(550);
  expect(ratings.map(Number)).toContain(stored[0].rating);
});

test("a new user has an empty list", async ({ page, loginAs }) => {
  await loginAs();
  await page.goto("/my-list");

  await expect(page.getByText("Your list is empty.")).toBeVisible();
  await expect(page.getByText("Length: 0")).toBeVisible();
});

test("refresh clears the filters", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list?rating=asc&status=watching&type=tv");
  await expectItems(page, ["Bravo Show"]);

  await page.getByRole("button", { name: "Refresh list" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expectItems(page, [
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);
});

test("adding while logged out asks to log in", async ({ page }) => {
  await page.goto("/search/movie/550");

  await page.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Completed");
  await dialog.getByRole("button", { name: "Add to list" }).click();

  await expect(page.getByText("You need to be logged in!")).toBeVisible();
});
