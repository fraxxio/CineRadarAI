import { expect, test } from "./fixtures";

// Phase 1 smoke test: proves the servers, the DB and the login fixture work.
test("about page loads", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "About", level: 1 }),
  ).toBeVisible();
});

test("loginAs shows the avatar", async ({ page, loginAs }) => {
  const user = await loginAs();
  await page.goto("/about");

  const nav = page.locator("nav#top");
  await expect(nav.getByRole("button", { name: "Account menu" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign In" })).toHaveCount(0);

  await nav.getByRole("button", { name: "Account menu" }).click();
  await expect(nav.getByText(user.email)).toBeVisible();
});
