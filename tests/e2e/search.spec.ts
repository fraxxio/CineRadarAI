import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { TMDB_URL } from "./env";
import { expect, test } from "./fixtures";

// Next's Data Cache keeps successful TMDB responses across runs (F12), so queries
// that must reach the mock (slow, request log) get a unique suffix.
const unique = (query: string) => `${query} ${randomUUID().slice(0, 8)}`;

const cardTitle = (page: Page, title: string) =>
  page.getByRole("heading", { name: title, exact: true });

async function search(page: Page, query: string, target = "Search movies") {
  await page.goto("/search");
  await page.getByPlaceholder("Type keywords...").fill(query);
  await page.getByRole("button", { name: target }).click();
}

test("trending results without a query", async ({ page }) => {
  await page.goto("/search");

  await expect(
    page.getByRole("heading", { name: "Trending movies" }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/search/movie/"]')).toHaveCount(20);
  await expect(cardTitle(page, "Trending movie p1 #1")).toBeVisible();
});

test("search with every filter, kept after a reload", async ({ page }) => {
  await page.goto("/search");
  await page.getByPlaceholder("Type keywords...").fill("Fury");
  await page.locator('select[name="language"]').selectOption("fr");
  await page.locator('select[name="year"]').selectOption("2014");
  await page.getByText("Include adult").click();
  await page.getByRole("button", { name: "Search movies" }).click();

  await expect(page).toHaveURL(
    /query=Fury&language=fr&year=2014&adult=true&btn=movie/,
  );
  const heading = page.getByRole("heading", {
    name: "Results for: Fury in FR language, 2014 year, including adult.",
  });
  await expect(heading).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByPlaceholder("Type keywords...")).toHaveValue("Fury");
  await expect(page.locator('select[name="language"]')).toHaveValue("fr");
  await expect(page.locator('select[name="year"]')).toHaveValue("2014");
  await expect(page.locator('input[name="adult"]')).toBeChecked();
});

test("TV search links to TV details", async ({ page }) => {
  await search(page, "Fury", "Search TV shows");

  await expect(page).toHaveURL(/btn=tv/);
  await expect(cardTitle(page, "Fury tv p1 #1")).toBeVisible();
  await expect(page.locator('a[href^="/search/tv/"]')).toHaveCount(20);
  await expect(page.locator('a[href^="/search/movie/"]')).toHaveCount(0);
});

test("pagination", async ({ page }) => {
  await search(page, "Fury");
  await expect(cardTitle(page, "Fury movie p1 #1")).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(cardTitle(page, "Fury movie p2 #1")).toBeVisible();

  await page.getByRole("button", { name: "4", exact: true }).click();
  await expect(page).toHaveURL(/page=4/);
  await expect(cardTitle(page, "Fury movie p4 #1")).toBeVisible();

  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page).toHaveURL(/page=3/);
  await expect(cardTitle(page, "Fury movie p3 #1")).toBeVisible();
});

test("no results", async ({ page }) => {
  await search(page, "__empty__");

  await expect(
    page.getByText(
      "No results with these filters were found. Try something else.",
    ),
  ).toBeVisible();
});

test("a TMDB failure shows the error page", async ({ page }) => {
  await search(page, "__error__");

  await expect(page.getByText("An unexpected error occured.")).toBeVisible();
});

test("shows the skeleton while results load", async ({ page }) => {
  const query = unique("__slow__");
  await search(page, query);

  await expect(page.getByTestId("search-results-skeleton")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Results for: ${query}` }),
  ).toBeVisible();
  await expect(page.getByTestId("search-results-skeleton")).toHaveCount(0);
});

test.fail(
  "[B6] the query is URL-encoded in the TMDB request",
  async ({ page, request }) => {
    const query = unique("Tom & Jerry");
    await search(page, query);
    await expect(
      page.getByRole("heading", { name: `Results for: ${query}` }),
    ).toBeVisible();

    const log: { path: string; query: string }[] = await (
      await request.get(`${TMDB_URL}/__requests`)
    ).json();
    const sent = log
      .filter((r) => r.path === "/search/movie")
      .map((r) => new URLSearchParams(r.query).get("query"));
    expect(sent).toContain(query.split(" ").join("|"));
  },
);
