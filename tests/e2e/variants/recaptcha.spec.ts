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

async function stubRecaptcha(page: Page, verdict: object) {
  await page.route("https://www.google.com/recaptcha/**", (r) =>
    r.fulfill({ contentType: "text/javascript", body: GRECAPTCHA_STUB }),
  );
  const verifyBodies: unknown[] = [];
  await page.route("**/api/recaptcha", (r) => {
    verifyBodies.push(r.request().postDataJSON());
    return r.fulfill({ json: verdict });
  });
  return verifyBodies;
}

async function openChat(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => "__grecaptchaReady" in window);
}

async function send(page: Page, text: string) {
  await page.getByPlaceholder(/Suggest me movies/).fill(text);
  await page.getByRole("button", { name: "Submit" }).click();
}

test("a failed verification blocks the chat request", async ({ page }) => {
  const verifyBodies = await stubRecaptcha(page, { success: false });
  const calls = await stubAssistant(page, () => ({
    events: answer("i1", "unused"),
  }));
  await openChat(page);

  await expect(page.getByText(/protected by reCAPTCHA/)).toBeVisible();
  await send(page, "war movies");

  const failed = page.getByText("Recaptcha failed to verify!");
  await expect(failed).toBeVisible();
  await expect(failed).toBeHidden({ timeout: 5_000 });
  expect(verifyBodies).toHaveLength(1);
  expect(calls).toHaveLength(0);
});

test("a passed verification sends the chat request", async ({ page }) => {
  const verifyBodies = await stubRecaptcha(page, {
    success: true,
    score: 0.9,
  });
  const calls = await stubAssistant(page, () => ({
    events: answer("i1", "Try **Fury** (2014)."),
  }));
  await openChat(page);

  await send(page, "war movies");

  await expect(page.getByText("Try Fury (2014).")).toBeVisible();
  expect(verifyBodies).toEqual([{ recaptchaToken: "e2e-token" }]);
  expect(calls).toEqual([{ content: "war movies" }]);
});
