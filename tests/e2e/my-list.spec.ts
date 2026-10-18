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

// a ListRow, in a status tab's list or an "All" tab shelf: the list item
// that contains the title link
const row = (page: Page, name: string) =>
  page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) });

// an "All" tab shelf, named by its heading ("Completed 2")
const shelf = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

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
  await expect(item.getByText(/^Movie ·/)).toHaveText("Movie · 8");
  // the badge; the status select's option has the same text
  await expect(
    item.locator("span").filter({ hasText: /^Completed$/ }),
  ).toBeVisible();
  await expect(item.getByLabel("Status for Fight Club")).toHaveValue(
    "Completed",
  );
  await expect(item.getByAltText("Fight Club")).toHaveAttribute(
    "src",
    "https://image.tmdb.org/t/p/w300/fight-club.jpg",
  );
  await expect(
    statusTabs(page).getByRole("link", { name: "Completed 1" }),
  ).toBeVisible();
  await expect(resetFilters(page)).toHaveCount(0);
});

test("edit an entry", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, [fightClub]);
  await page.goto("/my-list");

  const item = row(page, "Fight Club");
  const rating = item.getByLabel("Rating for Fight Club");
  const status = item.getByLabel("Status for Fight Club");
  await expect(rating).toHaveValue("8");
  await expect(status).toHaveValue("Completed");
  // only the rating changes; the status must survive
  await rating.selectOption("6");

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  // the action revalidates the page, no manual reload
  await expect(item.getByText(/^Movie ·/)).toHaveText("Movie · 6");
  await page.reload();
  await expect(rating).toHaveValue("6");
  await expect(status).toHaveValue("Completed");
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({ movieId: 550, status: "Completed", rating: 6 }),
  ]);
});

test("a status change on a status tab moves the row out of it", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list?status=completed");
  await expectItems(page, ["Delta Show", "Alpha Movie"]);

  await row(page, "Delta Show")
    .getByLabel("Status for Delta Show")
    .selectOption("Watching");

  await expect(page.getByText("Moved to Watching")).toBeVisible();
  await expectItems(page, ["Alpha Movie"]);
  await expect(
    statusTabs(page).getByRole("link", { name: "Watching 2" }),
  ).toBeVisible();
  expect(await getMovies(db, user.id)).toContainEqual(
    expect.objectContaining({ movieId: 4, status: "Watching", rating: 10 }),
  );
});

test("a status change on the All tab moves the row to another shelf", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list");

  await row(page, "Charlie Movie")
    .getByLabel("Status for Charlie Movie")
    .selectOption("Completed");

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  // the only planning title left, so its shelf goes
  await expect(shelf(page, "Planning to watch 1")).toHaveCount(0);
  await expect(
    shelf(page, "Completed 3").getByRole("link", { name: "Charlie Movie" }),
  ).toBeVisible();
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

test("the All tab shows a shelf per status", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, mixed);
  await page.goto("/my-list");

  await expect(page.getByRole("main").getByRole("region")).toHaveCount(3);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 2 }),
  ).toHaveText(["Watching 1", "Planning to watch 1", "Completed 2"]);
  await expect(shelf(page, "Watching 1").getByRole("link")).toHaveText([
    "Bravo Show",
  ]);
  await expect(shelf(page, "Planning to watch 1").getByRole("link")).toHaveText(
    ["Charlie Movie"],
  );
  await expect(shelf(page, "Completed 2").getByRole("link")).toHaveText([
    "Delta Show",
    "Alpha Movie",
  ]);
  await expect(statusTabs(page).getByRole("link")).toHaveText([
    "All 4",
    "Watching 1",
    "Planning to watch 1",
    "Completed 2",
  ]);
  // every shelf fits, so no "See all" and no pager
  await expect(page.getByRole("link", { name: /^See all/ })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Pagination" }),
  ).toHaveCount(0);

  // the type applies to every shelf, and empty shelves go
  await typeGroup(page).getByRole("link", { name: "TV" }).click();
  await expect(page).toHaveURL(/type=tv/);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 2 }),
  ).toHaveText(["Watching 1", "Completed 1"]);
  await expectItems(page, ["Bravo Show", "Delta Show"]);
});

// `mixed`, all watching, so one shelf (and one tab) holds every rating
const allWatching = mixed.map(
  (entry): ListMovie => ({ ...entry, status: "Watching" }),
);

test("sort and filter, with matching tab counts", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, [...allWatching, fightClub]);
  await page.goto("/my-list");
  await expect(statusTabs(page).getByRole("link")).toHaveText([
    "All 5",
    "Watching 4",
    "Planning to watch 0",
    "Completed 1",
  ]);
  await expect(shelf(page, "Watching 4").getByRole("link")).toHaveText([
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);

  // unrated titles come last under both rating sorts
  await sortGroup(page).getByRole("link", { name: "Lowest rated" }).click();
  await expect(page).toHaveURL(/sort=rating-asc/);
  await expect(shelf(page, "Watching 4").getByRole("link")).toHaveText([
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
  // the shelves come in tab order, whatever the sort
  await expectItems(
    page,
    ["Delta Show", "Charlie Movie", "Bravo Show", "Alpha Movie", "Fight Club"],
    5,
  );

  await statusTabs(page)
    .getByRole("link", { name: /^Watching/ })
    .click();
  await expect(page).toHaveURL(/status=watching/);
  // the sort carries over to the tab
  await expect(page).toHaveURL(/sort=recent/);
  await expectItems(page, [
    "Delta Show",
    "Charlie Movie",
    "Bravo Show",
    "Alpha Movie",
  ]);

  await typeGroup(page).getByRole("link", { name: "TV" }).click();
  await expect(page).toHaveURL(/type=tv/);
  // the status and sort carry over to the filter
  await expect(page).toHaveURL(/status=watching/);
  await expectItems(page, ["Delta Show", "Bravo Show"]);
  // the tab counts follow the type, the header doesn't
  await expect(statusTabs(page).getByRole("link")).toHaveText([
    "All 2",
    "Watching 2",
    "Planning to watch 0",
    "Completed 0",
  ]);
  await expect(page.getByText("5 titles", { exact: true })).toBeVisible();

  await statusTabs(page)
    .getByRole("link", { name: /^Completed/ })
    .click();
  await expect(page).toHaveURL(/status=completed/);
  await expect(page).toHaveURL(/type=tv/);
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
  // the shelves, in tab order
  await expectItems(page, [
    "Bravo Show",
    "Charlie Movie",
    "Delta Show",
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

test("a long shelf links to its tab", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);
  await page.goto("/my-list");

  // the shelf holds the first 6, and the All tab has no pager
  await expectItems(page, titles(0, 6), 30);
  await expect(
    page.getByRole("navigation", { name: "Pagination" }),
  ).toHaveCount(0);

  await shelf(page, "Completed 30")
    .getByRole("link", { name: "See all (30)" })
    .click();

  await expect(page).toHaveURL(`${BASE_URL}/my-list?status=completed`);
  await expectItems(page, titles(0, 24), 30);
});

test("a long list is paginated", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);
  await page.goto("/my-list?status=completed");

  await expectItems(page, titles(0, 24), 30);
  const pager = page.getByRole("navigation", { name: "Pagination" });
  await expect(pager.getByRole("link", { name: "Page 1" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await pager.getByRole("link", { name: "Page 2" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list?status=completed&page=2`);
  await expectItems(page, titles(24, 30), 30);

  await pager.getByRole("link", { name: "Previous" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list?status=completed`);
  await expectItems(page, titles(0, 24), 30);
});

test("a page past the end redirects to the last page", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);

  await page.goto("/my-list?status=completed&sort=recent&page=9");

  await expect(page).toHaveURL(
    `${BASE_URL}/my-list?status=completed&sort=recent&page=2`,
  );
  await expectItems(page, titles(0, 6).reverse(), 30);
});

test("the All tab ignores the page", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await seedList(db, user.id, thirty);

  await page.goto("/my-list?sort=recent&page=2");

  await expectItems(page, titles(24, 30).reverse(), 30);
});

test("a page past the end of an empty view drops the page", async ({
  page,
  loginAs,
}) => {
  await loginAs();

  await page.goto("/my-list?status=watching&type=tv&page=3");

  await expect(page).toHaveURL(`${BASE_URL}/my-list?status=watching&type=tv`);
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

  // a single long word mustn't push the row past the section's border
  test("rows with long titles fit the screen", async ({
    page,
    loginAs,
    db,
  }) => {
    const user = await loginAs();
    const name = "An Extraordinarily Long Title That Has To Wrap Somewhere";
    await seedList(db, user.id, [{ ...fightClub, name }]);
    await page.goto("/my-list");

    const item = row(page, name);
    await expect(item).toBeVisible();
    const sticksOut = await item.evaluate((li) => {
      // the page's section, not the shelf's
      const { left, right } = li
        .closest("main > section")!
        .getBoundingClientRect();
      // a closed select's options have no layout box
      return [li, ...li.querySelectorAll("*:not(option)")]
        .filter((e) => {
          const box = e.getBoundingClientRect();
          return box.left < left || box.right > right;
        })
        .map((e) => e.textContent);
    });
    expect(sticksOut).toEqual([]);
  });
});
