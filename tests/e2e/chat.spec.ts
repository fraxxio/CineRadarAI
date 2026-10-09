import type { Locator, Page } from "@playwright/test";
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
const BROWSING = "Browsing TMDB database...";
const DETAILS = "Checking title details...";

const promptInput = (page: Page) => page.getByPlaceholder(/Suggest me movies/);

// scoped: the navbar is a list too
const answerItem = (page: Page) => page.getByRole("main").getByRole("listitem");

async function send(page: Page, text: string) {
  await promptInput(page).fill(text);
  await page.getByRole("button", { name: "Submit" }).click();
}

// needs page.clock.install() before the page loads; from here on the page's
// time only moves with page.clock.runFor
async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

const toolStart = (id: string, name: string, text: string) =>
  ({ type: "tool_start", id, name, text }) as const;
const toolEnd = (id: string) => ({ type: "tool_end", id }) as const;

// the line's label, counter and time; the role="status" goes when it ends
const toolLine = (page: Page, label: string) => page.getByText(label);

async function expectAbove(upper: Locator, lower: Locator) {
  const a = (await upper.boundingBox())!;
  const b = (await lower.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
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

test("a tool line shows a spinner and a timer, and stays in the answer after it ends", async ({
  page,
}) => {
  const stream = await openAssistantStream(page);
  await page.clock.install();
  await page.goto("/");
  await send(page, "war movies");

  await stream.send(
    { type: "start", interactionId: "i1" },
    { type: "delta", text: "Let me check the database." },
  );
  const before = page.getByText("Let me check the database.");
  await expect(before).toBeVisible();
  await pauseClock(page);

  await stream.send(toolStart("c1", "search_titles", SEARCHING));

  const line = toolLine(page, SEARCHING);
  const status = page.getByRole("status");
  await expect(line).toHaveText(`${SEARCHING} - 0.0s`);
  await expect(status).toHaveCount(1);
  await expect(status).toContainText(SEARCHING);
  await expect(status.locator("svg.animate-spin")).toBeVisible();
  await expect(promptInput(page)).toBeDisabled();
  await expectAbove(before, line);

  await page.clock.runFor(2400);
  await expect(line).toHaveText(`${SEARCHING} - 2.4s`);

  await stream.send(toolEnd("c1"));

  // the rotating loader covers the model reading the results
  await expect(status).toHaveCount(1);
  await expect(status).toContainText("Generating response");
  await expect(page.locator("svg.animate-spin")).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(line).toHaveText(`${SEARCHING} - 2.4s`);

  await stream.send(
    { type: "delta", text: FIGHT_CLUB },
    { type: "done", interactionId: "i1" },
  );
  await stream.close();

  await expect(answerItem(page)).toContainText("Fight Club");
  await expect(status).toHaveCount(0);
  await expect(promptInput(page)).toBeEnabled();
  // text before the tool, the tool line, then the answer
  await expect(line).toHaveText(`${SEARCHING} - 2.4s`);
  await expectAbove(before, line);
  await expectAbove(line, answerItem(page));
});

test("repeated calls of one tool share a line with a counter; a different tool gets a new line", async ({
  page,
}) => {
  const stream = await openAssistantStream(page);
  await page.clock.install();
  await page.goto("/");
  await send(page, "war movies");
  await stream.send({ type: "start", interactionId: "i1" });
  await expect(page.getByRole("status")).toContainText("Generating response");
  await pauseClock(page);

  await stream.send(toolStart("d1", "discover_titles", BROWSING));
  await expect(toolLine(page, BROWSING)).toBeVisible();
  await page.clock.runFor(2100);
  await stream.send(
    toolEnd("d1"),
    toolStart("c1", "get_title_details", DETAILS),
    toolStart("c2", "get_title_details", DETAILS),
    toolStart("c3", "get_title_details", DETAILS),
  );

  const details = toolLine(page, DETAILS);
  await expect(details).toHaveText(`${DETAILS} (3x) - 0.0s`);
  await expect(details).toHaveCount(1);
  // only the running line is live
  await expect(page.getByRole("status")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText(DETAILS);

  await page.clock.runFor(14_000);
  await stream.send(toolEnd("c1"), toolEnd("c2"), toolEnd("c3"));
  await stream.send(
    { type: "delta", text: FIGHT_CLUB },
    { type: "done", interactionId: "i1" },
  );
  await stream.close();

  await expect(answerItem(page)).toContainText("Fight Club");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(toolLine(page, BROWSING)).toHaveText(`${BROWSING} - 2.1s`);
  await expect(details).toHaveText(`${DETAILS} (3x) - 14s`);
  await expectAbove(toolLine(page, BROWSING), details);
  await expectAbove(details, answerItem(page));
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
