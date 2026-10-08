import type { Page } from "@playwright/test";
import { deferred } from "../helpers/deferred";
import { expect, test } from "./fixtures";
import { answer, openAssistantStream, stubAssistant } from "./helpers/chat";

const FURY = "Here you go:\n1. [Fury](/search/movie/228150) (2014) — tanks.";
// the TMDB mock has a fixture for movie 550
const FIGHT_CLUB =
  "Here you go:\n1. [Fight Club](/search/movie/550) (1999) — soap.";
// a title the tools couldn't check
const FALLBACK =
  "Here you go:\n1. [Fury](/search?query=Fury&btn=movie&year=2014) (2014) — tanks.";
const SEARCHING = "Searching TMDB database...";

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

test("a recommendation link opens the title page", async ({ page }) => {
  await stubAssistant(page, () => ({ events: answer("i1", FIGHT_CLUB) }));
  await send(page, "movies about fight clubs");

  await page.getByRole("link", { name: "Fight Club" }).click();

  await expect(page).toHaveURL(/\/search\/movie\/550$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fight Club" }),
  ).toBeVisible();
});

test("a fallback link opens the prefilled search", async ({ page }) => {
  await stubAssistant(page, () => ({ events: answer("i1", FALLBACK) }));
  await send(page, "war movies");

  await page.getByRole("link", { name: "Fury" }).click();

  await expect(page).toHaveURL(/\/search\?query=Fury&btn=movie&year=2014/);
  await expect(page.getByPlaceholder("Type keywords...")).toHaveValue("Fury");
  await expect(page.locator('select[name="year"]')).toHaveValue("2014");
});

test("a status before any text replaces the loader words", async ({ page }) => {
  const stream = await openAssistantStream(page);
  await page.goto("/");
  await send(page, "war movies");

  await stream.send({ type: "start", interactionId: "i1" });
  await stream.send({ type: "status", text: SEARCHING });

  await expect(page.getByRole("status")).toContainText(SEARCHING);

  await stream.send(
    { type: "delta", text: FIGHT_CLUB },
    { type: "done", interactionId: "i1" },
  );
  await stream.close();
  await expect(answerItem(page)).toContainText("Fight Club");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a status after text shows a loader under it until the answer continues", async ({
  page,
}) => {
  const stream = await openAssistantStream(page);
  await page.goto("/");
  await send(page, "war movies");

  await stream.send(
    { type: "start", interactionId: "i1" },
    { type: "delta", text: "Let me check the database." },
    { type: "status", text: SEARCHING },
  );

  const before = page.getByText("Let me check the database.");
  await expect(before).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText(SEARCHING);
  await expect(promptInput(page)).toBeDisabled();
  // the loader sits under the text
  const textBox = (await before.boundingBox())!;
  const loaderBox = (await page.getByRole("status").boundingBox())!;
  expect(loaderBox.y).toBeGreaterThanOrEqual(textBox.y + textBox.height);

  await stream.send(
    { type: "delta", text: "\n\n" + FIGHT_CLUB },
    { type: "done", interactionId: "i1" },
  );
  await stream.close();

  await expect(answerItem(page)).toContainText("Fight Club");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(before).toBeVisible();
  await expect(promptInput(page)).toBeEnabled();
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
