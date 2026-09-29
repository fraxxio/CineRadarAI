import { expect, test } from "../fixtures";

// E2E_VARIANT=chat-disabled: AI_CHAT_ENABLED is blank

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the out-of-order overlay", async ({ page }) => {
  await expect(page.getByText(/OUT OF ORDER/)).toBeVisible();
  await expect(page.getByText(/no longer available/)).toBeVisible();
});

test.fail("[B9] the chat input can't be used", async ({ page }) => {
  // pointer-events-none only blocks the mouse; the keyboard needs `inert`
  await page.getByPlaceholder(/Suggest me movies/).focus();
  await page.keyboard.type("hello");

  await expect(page.getByPlaceholder(/Suggest me movies/)).toHaveValue("");
  await expect(page.locator("[inert]")).toHaveCount(1);
});
