import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { getMovies, seedList, userExists } from "./helpers/db";

async function openDelete(page: Page) {
  const nav = page.locator("nav#top");
  await nav.getByRole("button", { name: "Account menu" }).click();
  await nav.getByRole("button", { name: "Delete my account" }).click();
  return page.getByRole("dialog");
}

async function confirmWith(page: Page, text: string) {
  const dialog = await openDelete(page);
  await dialog.getByRole("textbox").fill(text);
  await dialog.getByRole("button", { name: "Delete" }).click();
}

test("the wrong confirmation text keeps the account", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await page.goto("/");

  await confirmWith(page, "delete");

  await expect(page).toHaveURL(/\/\?deleteAcc=fail/);
  // .first(): DeleteResult toasts on every render, so StrictMode (next dev) shows two
  await expect(
    page.getByText("Failed to delete account.").first(),
  ).toBeVisible();
  expect(await userExists(db, user.id)).toBe(true);
});

test("the right confirmation text deletes the account and list", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await seedList(db, user.id, [
    {
      movieId: 550,
      name: "Fight Club",
      image: "/f.jpg",
      rating: 8,
      status: "Completed",
      type: "movie",
    },
  ]);
  await page.goto("/");

  await confirmWith(page, "Delete account");

  await expect(page).toHaveURL(/\/\?deleteAcc=success/);
  await expect(
    page.getByText("Account deleted succesfully.").first(),
  ).toBeVisible();
  expect(await userExists(db, user.id)).toBe(false);
  expect(await getMovies(db, user.id)).toBeUndefined();
  await expect(
    page.locator("nav#top").getByRole("link", { name: "Sign In" }),
  ).toBeVisible();
});

test.fail(
  "[B3] a tampered id can't delete another account",
  async ({ page, loginAs, seedUser, db }) => {
    const victim = await seedUser();
    const attacker = await loginAs();
    await page.goto("/");

    // Editing the hidden input isn't enough: React writes the controlled
    // value={id} back before the form data is read. Rewrite the server action
    // request instead, as an attacker would.
    await page.route(
      (url) => url.pathname === "/",
      (route) => {
        const request = route.request();
        if (request.method() !== "POST") return route.continue();
        return route.continue({
          postData: request.postData()!.replace(attacker.id, victim.id),
        });
      },
    );
    await confirmWith(page, "Delete account");

    await expect(page).toHaveURL(/\/\?deleteAcc=/);
    expect(await userExists(db, victim.id)).toBe(true);
  },
);
