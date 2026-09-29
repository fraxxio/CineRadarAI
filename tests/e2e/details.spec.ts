import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const reviewBlocks = (page: Page) => page.locator("#reviews > div");

test("movie page", async ({ page }) => {
  await page.goto("/search/movie/550");

  await expect(page).toHaveTitle("Fight Club | CineRadar");
  await expect(
    page.getByRole("heading", { level: 1, name: "Fight Club" }),
  ).toBeVisible();
  await expect(page.getByText("Duration:")).toContainText("139 min.");
  await expect(page.getByText("Budget:")).toContainText("$63.0M");
  await expect(page.getByText("Revenue:")).toContainText("$100.9M");
  await expect(page.locator('iframe[title="Trailer"]')).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/e2e-trailer-key",
  );
  await expect(
    page.getByRole("link", { name: "Where to watch?" }),
  ).toHaveAttribute("href", "https://www.themoviedb.org/movie/550/watch");
});

test("TV page", async ({ page }) => {
  await page.goto("/search/tv/1399");

  await expect(page).toHaveTitle("Game of Thrones | CineRadar");
  await expect(page.getByText("Seasons:")).toContainText("8");
  await expect(page.getByText("Show type:")).toContainText("Scripted");
  await expect(page.getByText("Budget:")).toHaveCount(0);
});

test("gallery image opens in a dialog", async ({ page }) => {
  await page.goto("/search/movie/550");
  await expect(page.getByAltText("Gallery image")).toHaveCount(9);

  await page.getByAltText("Gallery image").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("people rated this picture");
  await expect(dialog.getByAltText("Gallery image")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("reviews are capped and sanitised", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await page.goto("/search/movie/550");

  await expect(reviewBlocks(page)).toHaveCount(10);
  await expect(page.getByText("Hover to reveal").first()).toBeVisible();

  // reviews.json's 3rd review carries <script>, onerror and javascript: payloads
  const evil = reviewBlocks(page).filter({ hasText: "Evil Reviewer" });
  await expect(evil).toContainText("Nice film");
  await expect(evil.locator("script")).toHaveCount(0);
  await expect(evil.locator("img[onerror]")).toHaveCount(0);
  await expect(evil.locator('a[href^="javascript:"]')).toHaveCount(0);
  await evil.getByText("click").click();

  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

// distance from the viewport top. Every section has scroll-mt-20, which keeps it
// below the sticky nav (Reviews had none and landed under the nav: B13).
const topOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.getBoundingClientRect().top);
const navBottom = (page: Page) =>
  page.locator("nav#top").evaluate((el) => el.getBoundingClientRect().bottom);

for (const section of ["Trailer", "Gallery", "Reviews"]) {
  test(`the ${section} link scrolls to its section`, async ({ page }) => {
    await page.goto("/search/movie/550");
    const hash = `#${section.toLowerCase()}`;
    await expect(reviewBlocks(page)).toHaveCount(10); // every section has loaded
    expect(await topOf(page, hash)).toBeGreaterThan(300);

    await page.getByRole("link", { name: section, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect.poll(() => topOf(page, hash)).toBeLessThanOrEqual(100);
    // not hidden under the nav (-1: sub-pixel rounding)
    expect(await topOf(page, hash)).toBeGreaterThan(
      (await navBottom(page)) - 1,
    );
    await expect(page.locator(hash)).toBeInViewport();
  });
}

test("a TMDB error shows the error page", async ({ page }) => {
  await page.goto("/search/movie/999999");
  await expect(page.getByText("An unexpected error occured.")).toBeVisible();
});
