import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";

test("navbar links", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("nav#top");

  await nav.getByRole("link", { name: "Manual Search" }).click();
  await expect(page).toHaveURL(/\/search$/);

  await nav.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);

  await nav.getByRole("link", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/signin$/);

  await nav.getByRole("link", { name: "CineRadar" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test("My list: logged out -> sign-in", async ({ page }) => {
  await page.goto("/");
  await page.locator("nav#top").getByRole("link", { name: "My list" }).click();

  await expect(page).toHaveURL(/\/signin\?/);
});

test("My list: logged in -> the list", async ({ page, loginAs }) => {
  const user = await loginAs();
  await page.goto("/");
  await page.locator("nav#top").getByRole("link", { name: "My list" }).click();

  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expect(
    page.getByText(`${user.name} movie and TV show list.`),
  ).toBeVisible();
});

test("about page", async ({ page }) => {
  await page.goto("/about");

  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Data source" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Legal notice" }),
  ).toBeVisible();
});

test("unknown route -> 404 page", async ({ page }) => {
  const response = await page.goto("/definitely-missing");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await page.getByRole("link", { name: "Return Home" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu button slides the mobile nav in and out", async ({ page }) => {
    await page.goto("/about");
    const mobileNav = page.locator("#MobileNav");
    const toggle = page.getByRole("button", { name: "Toggle menu" });
    const closed = /(^|\s)-translate-y-\[10rem\](\s|$)/;
    const open = /(^|\s)translate-y-\[4rem\](\s|$)/;

    await expect(page.locator("nav#top ul")).toBeHidden(); // desktop links
    await expect(mobileNav).toHaveClass(closed);

    await toggle.click();
    await expect(mobileNav).toHaveClass(open);
    await expect(
      mobileNav.getByRole("link", { name: "About" }),
    ).toBeInViewport();

    await toggle.click();
    await expect(mobileNav).toHaveClass(closed);

    await toggle.click();
    await mobileNav.getByRole("link", { name: "Manual Search" }).click();
    await expect(page).toHaveURL(/\/search$/);
  });
});
