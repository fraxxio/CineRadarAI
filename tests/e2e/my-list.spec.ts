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

const statusTabs = (page: Page) =>
  page.getByRole("navigation", { name: "Status" });
const typeGroup = (page: Page) => page.getByRole("group", { name: "Type" });
const sortGroup = (page: Page) => page.getByRole("group", { name: "Sort by" });
// the header's link; an empty view can show a second one
const resetFilters = (page: Page) =>
  page.getByRole("link", { name: "Reset filters" }).first();

// `length` is the view's total, across pages, shown on the open status tab
async function expectItems(page: Page, names: string[], length = names.length) {
  await expect(itemLinks(page)).toHaveText(names);
  await expect(statusTabs(page).locator('[aria-current="page"]')).toHaveText(
    new RegExp(` ${length}$`),
  );
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
    page.getByRole("heading", { name: `${user.name}'s list` }),
  ).toBeVisible();
  await expect(page.getByText("1 title", { exact: true })).toBeVisible();
  const item = row(page, "Fight Club");
  await expect(item.getByRole("link", { name: "Fight Club" })).toHaveAttribute(
    "href",
    "/search/movie/550",
  );
  await expect(item.getByText("8", { exact: true })).toBeVisible();
  await expect(item.getByText("Type: Movie")).toBeVisible();
  await expect(item.getByText("Completed", { exact: true })).toBeVisible();
  await expect(
    statusTabs(page).getByRole("link", { name: "Completed 1" }),
  ).toBeVisible();
  await expect(resetFilters(page)).toHaveCount(0);
});

test("edit an entry", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list");

  await page.getByRole("button", { name: "Edit list entry" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Status:")).toHaveValue("Completed");
  await expect(dialog.getByLabel("Rating (optional):")).toHaveValue("8");
  // only the status changes; the rating must survive
  await dialog.getByLabel("Status:").selectOption("Watching");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Fight Club was updated.")).toBeVisible();
  // router.refresh(), no manual reload
  const item = row(page, "Fight Club");
  await expect(item.getByText("Watching", { exact: true })).toBeVisible();
  await expect(item.getByText("8", { exact: true })).toBeVisible();
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({ movieId: 550, status: "Watching", rating: 8 }),
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
  await expect(page.getByText("0 titles", { exact: true })).toBeVisible();
  expect(await getMovies(db, user.id)).toEqual([]);
});

test("sort and filter, with matching tab counts", async ({
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
  await expect(statusTabs(page).getByRole("link")).toHaveText([
    "All 4",
    "Watching 1",
    "Planning to watch 1",
    "Completed 2",
  ]);

  // unrated titles come last under both rating sorts
  await sortGroup(page).getByRole("link", { name: "Lowest rated" }).click();
  await expect(page).toHaveURL(/sort=rating-asc/);
  await expectItems(page, [
    "Bravo Show",
    "Charlie Movie",
    "Delta Show",
    "Alpha Movie",
  ]);
  await expect(
    sortGroup(page).getByRole("link", { name: "Lowest rated" }),
  ).toHaveAttribute("aria-current", "page");

  await sortGroup(page).getByRole("link", { name: "Recently added" }).click();
  await expect(page).toHaveURL(/sort=recent/);
  await expectItems(page, [
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);

  await typeGroup(page).getByRole("link", { name: "TV" }).click();
  await expect(page).toHaveURL(/type=tv/);
  // the sort carries over to the filter
  await expectItems(page, ["Delta Show", "Bravo Show"]);
  // the tab counts follow the type, the header doesn't
  await expect(statusTabs(page).getByRole("link")).toHaveText([
    "All 2",
    "Watching 1",
    "Planning to watch 0",
    "Completed 1",
  ]);
  await expect(page.getByText("4 titles", { exact: true })).toBeVisible();

  await statusTabs(page)
    .getByRole("link", { name: /^Watching/ })
    .click();
  await expect(page).toHaveURL(/status=watching/);
  await expect(page).toHaveURL(/type=tv/);
  await expect(page).toHaveURL(/sort=recent/);
  await expectItems(page, ["Bravo Show"]);

  await typeGroup(page).getByRole("link", { name: "Movies" }).click();
  await expect(page).toHaveURL(/type=movie/);
  await expect(page.getByText("No titles match these filters.")).toBeVisible();
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
  await expect(page.getByText("0 titles", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Search for a movie or TV show" }),
  ).toHaveAttribute("href", "/search");
  // the e2e server runs with the chat on
  await expect(page.getByRole("link", { name: "ask the chat" })).toBeVisible();
});

test("reset filters clears the filters", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list?sort=rating-asc&status=watching&type=tv");
  await expectItems(page, ["Bravo Show"]);

  await resetFilters(page).click();

  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expectItems(page, [
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);
  await expect(resetFilters(page)).toHaveCount(0);
});

test("a filtered view with no matches shows the filtered empty state", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list?status=watching");

  await expect(page.getByText("No titles match these filters.")).toBeVisible();
  await expect(page.getByText("Your list is empty.")).toHaveCount(0);
  await expectItems(page, []);

  // the empty state's own reset link
  await page.getByRole("link", { name: "Reset filters" }).last().click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expectItems(page, ["Fight Club"]);
});

// 30 rows, all rated 5, so the default sort keeps insertion order
const thirty: ListMovie[] = Array.from({ length: 30 }, (_, i) => ({
  movieId: i + 1,
  name: `Title ${i + 1}`,
  image: "",
  rating: 5,
  status: "Completed",
  type: "movie",
}));
const titles = (from: number, to: number) =>
  thirty.slice(from, to).map((entry) => entry.name);

test("a long list is paginated", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);
  await page.goto("/my-list");

  await expectItems(page, titles(0, 24), 30);
  const pager = page.getByRole("navigation", { name: "Pagination" });
  await expect(pager.getByRole("link", { name: "Page 1" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await pager.getByRole("link", { name: "Page 2" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list?page=2`);
  await expectItems(page, titles(24, 30), 30);
  await expect(page.getByText("#25")).toBeVisible();

  await pager.getByRole("link", { name: "Previous" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expectItems(page, titles(0, 24), 30);
});

test("a page past the end redirects to the last page", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);

  await page.goto("/my-list?sort=recent&page=9");

  await expect(page).toHaveURL(`${BASE_URL}/my-list?sort=recent&page=2`);
  await expectItems(page, titles(0, 6).reverse(), 30);
});

test("a page past the end of an empty view drops the page", async ({
  page,
  loginAs,
}) => {
  await loginAs();

  await page.goto("/my-list?type=tv&page=3");

  await expect(page).toHaveURL(`${BASE_URL}/my-list?type=tv`);
  await expect(page.getByText("Your list is empty.")).toBeVisible();
});

test("adding while logged out asks to log in", async ({ page }) => {
  await page.goto("/search/movie/550");

  await page.getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Completed");
  await dialog.getByRole("button", { name: "Add to list" }).click();

  await expect(page.getByText("You need to be logged in!")).toBeVisible();
});

test.describe("at 320 px", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  // the status tabs scroll on their own, everything else has to wrap
  test("the header and filters fit the screen", async ({
    page,
    loginAs,
    db,
  }) => {
    const user = await loginAs();
    await seedList(db, user.id, mixed);
    await page.goto("/my-list?sort=recent");

    await expect(resetFilters(page)).toBeVisible();
    const sticksOut = await page
      .getByRole("main")
      .locator("section")
      .first()
      .evaluate((section) => {
        const { left, right } = section.getBoundingClientRect();
        return [...section.querySelectorAll("[role=group] *")]
          .filter((e) => {
            const box = e.getBoundingClientRect();
            return box.left < left || box.right > right;
          })
          .map((e) => e.textContent);
      });
    expect(sticksOut).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });
});
