import { expect, test } from "./fixtures";
import { sessionCount } from "./helpers/db";

test("a protected page redirects to sign-in with a callbackUrl", async ({
  page,
}) => {
  await page.goto("/my-list");

  await expect(page).toHaveURL(/\/signin\?/);
  expect(new URL(page.url()).pathname).toBe("/signin");
  const url = decodeURIComponent(page.url());
  expect(url).toContain("callbackUrl=");
  expect(url).toContain("/my-list");
});

test("the sign-in page starts the GitHub OAuth flow", async ({ page }) => {
  await page.goto("/signin");

  const google = page.getByRole("button", { name: "Sign in with Google" });
  const github = page.getByRole("button", { name: "Sign in with Github" });
  await expect(google).toBeVisible();
  await expect(google).toHaveAttribute("value", "google");
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute("value", "github");

  // Google isn't clicked: its OIDC discovery calls accounts.google.com from the server
  await page.route("https://github.com/**", (r) => r.abort());
  const authorize = page.waitForRequest(/github\.com\/login\/oauth\/authorize/);
  await github.click();

  expect((await authorize).url()).toContain("client_id=e2e-github-id");
});

test("the logged-in navbar has the account menu", async ({ page, loginAs }) => {
  await loginAs();
  await page.goto("/");

  const nav = page.locator("nav#top");
  await expect(nav.getByRole("link", { name: "Sign In" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Account menu" }).click();

  await expect(
    nav.getByRole("button", { name: "Delete my account" }),
  ).toBeVisible();
  await expect(nav.getByRole("button", { name: "Sign Out" })).toBeVisible();
});

test("sign out ends the session", async ({ page, loginAs, db }) => {
  const user = await loginAs();
  await page.goto("/");
  expect(await sessionCount(db, user.id)).toBe(1);

  const nav = page.locator("nav#top");
  await nav.getByRole("button", { name: "Account menu" }).click();
  await nav.getByRole("button", { name: "Sign Out" }).click();

  await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
  await expect.poll(() => sessionCount(db, user.id)).toBe(0);
});

// B10: needs a real OAuth round trip, so this is documentation only
test.fixme("[B10] login returns to the callbackUrl", async () => {});
