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
  // exactly one toast, also under StrictMode in next dev (B12)
  await expect(page.getByText("Failed to delete account.")).toBeVisible();
  // the dialog closes once the action has finished (B14)
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await userExists(db, user.id)).toBe(true);
});

test("[B14] an empty confirmation keeps the dialog open", async ({
  page,
  loginAs,
}) => {
  await loginAs();
  await page.goto("/");

  // the required input blocks the submit
  await confirmWith(page, "");
  await page.waitForTimeout(500); // the old code closed it after 300 ms

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/deleteAcc=/);
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
  await expect(page.getByText("Account deleted succesfully.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await userExists(db, user.id)).toBe(false);
  expect(await getMovies(db, user.id)).toBeUndefined();
  await expect(
    page.locator("nav#top").getByRole("link", { name: "Sign In" }),
  ).toBeVisible();
});

test("[B3] a tampered id can't delete another account", async ({
  page,
  loginAs,
  seedUser,
  db,
}) => {
  const victim = await seedUser();
  const attacker = await loginAs();
  await page.goto("/");

  // the form no longer sends an id; add one, as an attacker would
  const dialog = await openDelete(page);
  await dialog.locator("form").evaluate((form, id) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "id";
    input.value = id;
    form.append(input);
  }, victim.id);
  await dialog.getByRole("textbox").fill("Delete account");
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL(/\/\?deleteAcc=success/);
  expect(await userExists(db, victim.id)).toBe(true);
  expect(await userExists(db, attacker.id)).toBe(false);
});
