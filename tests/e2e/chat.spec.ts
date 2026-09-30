import type { Page } from "@playwright/test";
import { deferred } from "../helpers/deferred";
import { expect, test } from "./fixtures";
import { answer, stubAssistant } from "./helpers/chat";

const FURY =
  "Here you go:\n1. [Fury](/search?query=Fury&btn=movie&year=2014) (2014) — tanks.";

const promptInput = (page: Page) => page.getByPlaceholder(/Suggest me movies/);

// scoped: the navbar is a list too
const answerItem = (page: Page) => page.getByRole("main").getByRole("listitem");

async function send(page: Page, text: string) {
  await promptInput(page).fill(text);
  await page.getByRole("button", { name: "Submit" }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a full turn renders the markdown answer", async ({ page }) => {
  const calls = await stubAssistant(page, () => ({
    events: answer("i1", FURY),
  }));

  await send(page, "war movies with Brad Pitt");

  await expect(answerItem(page)).toContainText("Fury");
  await expect(page.getByText("war movies with Brad Pitt")).toBeVisible();
  expect(calls).toEqual([{ content: "war movies with Brad Pitt" }]);
});

test("shows the loader and disables the input while waiting", async ({
  page,
}) => {
  const hold = deferred<void>();
  await stubAssistant(page, () => ({
    events: answer("i1", FURY),
    hold: hold.promise,
  }));

  await send(page, "war movies");

  await expect(page.getByRole("status")).toBeVisible();
  await expect(promptInput(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

  hold.resolve();

  await expect(answerItem(page)).toContainText("Fury");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(promptInput(page)).toBeEnabled();
});

test("a recommendation link opens the prefilled search", async ({ page }) => {
  await stubAssistant(page, () => ({ events: answer("i1", FURY) }));
  await send(page, "war movies");

  await page.getByRole("link", { name: "Fury" }).click();

  await expect(page).toHaveURL(/\/search\?query=Fury&btn=movie&year=2014/);
  await expect(page.getByPlaceholder("Type keywords...")).toHaveValue("Fury");
  await expect(page.locator('select[name="year"]')).toHaveValue("2014");
});

test("a follow-up sends the previous interaction id", async ({ page }) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events: answer(`i${n}`, n === 1 ? FURY : "Also try **Platoon**."),
  }));

  await send(page, "war movies");
  await expect(answerItem(page)).toContainText("Fury");
  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();

  expect(calls).toHaveLength(2);
  expect(calls[0]).not.toHaveProperty("previousInteractionId");
  expect(calls[1]).toEqual({
    previousInteractionId: "i1",
    content: "something older",
  });
});

test("a failed request shows the error message", async ({ page }) => {
  await stubAssistant(page, () => ({ status: 500 }));

  await send(page, "war movies");

  await expect(
    page.getByText("Unfortunately an error occurred. Try again later."),
  ).toBeVisible();
  await expect(promptInput(page)).toBeEnabled();
});

test("Stop keeps the turn and shares it with the model", async ({ page }) => {
  const hold = deferred<void>();
  const calls = await stubAssistant(page, (_body, n) =>
    n === 1
      ? { events: answer("i1", FURY), hold: hold.promise }
      : { events: answer("i2", "Also try **Platoon**.") },
  );

  await send(page, "war movies");
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  hold.resolve();

  await expect(page.getByText("Stopped")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(promptInput(page)).toBeEnabled();
  await expect(
    page.getByText("Unfortunately an error occurred. Try again later."),
  ).toHaveCount(0);

  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[1]).toEqual({
    content: "something older",
    stoppedTurns: [{ prompt: "war movies", partialText: "" }],
  });
});

test("two stops in a row are both shared with the model", async ({ page }) => {
  const holds = [deferred<void>(), deferred<void>()];
  const calls = await stubAssistant(page, (_body, n) =>
    n <= 2
      ? { events: answer(`i${n}`, FURY), hold: holds[n - 1].promise }
      : { events: answer(`i${n}`, "Also try **Platoon**.") },
  );

  for (const [i, prompt] of ["war movies", "comedies"].entries()) {
    await send(page, prompt);
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    holds[i].resolve();
    await expect(page.getByText("Stopped")).toHaveCount(i + 1);
  }

  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[2]).toEqual({
    content: "something older",
    stoppedTurns: [
      { prompt: "war movies", partialText: "" },
      { prompt: "comedies", partialText: "" },
    ],
  });
});

test("New chat clears the conversation", async ({ page }) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events: answer(`i${n}`, n === 1 ? FURY : "Also try **Platoon**."),
  }));
  const newChat = page.getByRole("button", { name: "New chat" });
  await expect(newChat).toBeDisabled();

  await send(page, "war movies");
  await expect(answerItem(page)).toContainText("Fury");
  await newChat.click();

  await expect(answerItem(page)).toHaveCount(0);
  await expect(page.getByText("war movies")).toHaveCount(0);
  await expect(newChat).toBeDisabled();

  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[1]).toEqual({ content: "something older" });
});
