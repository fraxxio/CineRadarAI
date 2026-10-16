import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { answer, stubAssistant } from "../helpers/chat";

// E2E_VARIANT=recaptcha: both reCAPTCHA keys are set (F8)

// Stands in for https://www.google.com/recaptcha/api.js. The flag tells the test
// that the provider has its grecaptcha instance, so executeRecaptcha is ready.
const GRECAPTCHA_STUB = `window.grecaptcha = {
  ready: (cb) => { cb(); window.__grecaptchaReady = true; },
  execute: () => Promise.resolve("e2e-token"),
};`;

async function stubRecaptcha(page: Page) {
  await page.route("https://www.google.com/recaptcha/**", (r) =>
    r.fulfill({ contentType: "text/javascript", body: GRECAPTCHA_STUB }),
  );
}

async function openChat(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => "__grecaptchaReady" in window);
}

async function send(page: Page, text: string) {
  await page.getByPlaceholder(/Suggest me movies/).fill(text);
  await page.getByRole("button", { name: "Submit" }).click();
}

test("a rejected token takes the prompt back to the input", async ({
  page,
}) => {
  await stubRecaptcha(page);
  await stubAssistant(page, () => ({
    status: 403,
    json: { error: "recaptcha_failed" },
  }));
  await openChat(page);

  await expect(page.getByText(/protected by reCAPTCHA/)).toBeVisible();
  await send(page, "war movies");

  const failed = page.getByText("Recaptcha failed to verify!");
  await expect(failed).toBeVisible();
  await expect(page.getByPlaceholder(/Suggest me movies/)).toHaveValue(
    "war movies",
  );
  await expect(page.getByText("war movies")).toBeHidden();
  await expect(failed).toBeHidden({ timeout: 5_000 });
});

test("the token goes with the chat request", async ({ page }) => {
  await stubRecaptcha(page);
  const calls = await stubAssistant(page, () => ({
    events: answer("i1", "Try **Fury** (2014)."),
  }));
  await openChat(page);

  await send(page, "war movies");

  await expect(page.getByText("Try Fury (2014).")).toBeVisible();
  expect(calls).toEqual([
    { content: "war movies", recaptchaToken: "e2e-token" },
  ]);
});
