import type { Locator, Page } from "@playwright/test";
import { deferred } from "../helpers/deferred";
import { expect, test } from "./fixtures";
import {
  answer,
  cardsAnswer,
  openAssistantStream,
  showCards,
  stubAssistant,
  title,
} from "./helpers/chat";
import { getMovies } from "./helpers/db";

const FURY = title(228150, {
  title: "Fury",
  year: 2014,
  rating: 7.5,
  genres: ["War", "Drama", "Action"],
  reason: "A tense WWII tank-crew drama.",
});
// the TMDB mock has a fixture for movie 550
const FIGHT_CLUB = title(550, {
  title: "Fight Club",
  year: 1999,
  rating: 8.4,
  genres: ["Drama"],
});
const INTRO = "Here are some war films.";
const WAR = cardsAnswer("i1", INTRO, [FURY]);
const PREPARING = "Preparing recommendations...";
const SEARCHING = "Searching TMDB database...";
const BROWSING = "Browsing TMDB database...";
const DETAILS = "Checking title details...";

const promptInput = (page: Page) => page.getByPlaceholder(/Suggest me movies/);

const cards = (page: Page) =>
  page.getByRole("list", { name: "Recommendations" }).getByRole("listitem");

const card = (page: Page, name: string) =>
  cards(page).filter({ has: page.getByRole("link", { name, exact: true }) });

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

test("a full turn shows the recommendations as cards with TMDB data", async ({
  page,
}) => {
  const calls = await stubAssistant(page, () => ({
    events: cardsAnswer("i1", INTRO, [FURY, FIGHT_CLUB]),
  }));

  await send(page, "war movies with Brad Pitt");

  await expect(cards(page).getByRole("heading")).toHaveText([
    "Fury",
    "Fight Club",
  ]);
  const fury = card(page, "Fury");
  await expect(fury.getByAltText("Fury")).toHaveAttribute(
    "src",
    "https://image.tmdb.org/t/p/w342/poster-228150.jpg",
  );
  await expect(fury).toContainText("2014 · Movie");
  await expect(fury).toContainText("7.5 / 10");
  await expect(fury).toContainText("War · Drama · Action");
  await expect(fury).toContainText("A tense WWII tank-crew drama.");
  await expect(card(page, "Fight Club")).toContainText("8.4 / 10");
  // intro, the tool line, then the cards
  await expectAbove(page.getByText(INTRO), toolLine(page, PREPARING));
  await expectAbove(toolLine(page, PREPARING), cards(page).first());
  await expect(page.getByText("war movies with Brad Pitt")).toBeVisible();
  expect(calls).toEqual([{ content: "war movies with Brad Pitt" }]);
});

test("a card's title opens the title page", async ({ page }) => {
  await stubAssistant(page, () => ({
    events: cardsAnswer("i1", INTRO, [FIGHT_CLUB]),
  }));
  await send(page, "movies about fight clubs");

  await card(page, "Fight Club")
    .getByRole("link", { name: "Fight Club" })
    .click();

  await expect(page).toHaveURL(/\/search\/movie\/550$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Fight Club" }),
  ).toBeVisible();
});

test("shows the loader and disables the input while waiting", async ({
  page,
}) => {
  const hold = deferred<void>();
  await stubAssistant(page, () => ({ events: WAR, hold: hold.promise }));

  await send(page, "war movies");

  await expect(page.getByRole("status")).toBeVisible();
  await expect(promptInput(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

  hold.resolve();

  await expect(card(page, "Fury")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(promptInput(page)).toBeEnabled();
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

  await stream.send(...showCards([FIGHT_CLUB]), {
    type: "done",
    interactionId: "i1",
  });
  await stream.close();

  await expect(card(page, "Fight Club")).toBeVisible();
  await expect(status).toHaveCount(0);
  await expect(promptInput(page)).toBeEnabled();
  // text before the tool, the tool line, then the cards
  await expect(line).toHaveText(`${SEARCHING} - 2.4s`);
  await expectAbove(before, line);
  await expectAbove(line, card(page, "Fight Club"));
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
  await stream.send(...showCards([FIGHT_CLUB]), {
    type: "done",
    interactionId: "i1",
  });
  await stream.close();

  await expect(card(page, "Fight Club")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(toolLine(page, BROWSING)).toHaveText(`${BROWSING} - 2.1s`);
  await expect(details).toHaveText(`${DETAILS} (3x) - 14s`);
  await expectAbove(toolLine(page, BROWSING), details);
  await expectAbove(details, card(page, "Fight Club"));
});

test("a follow-up sends the previous interaction id", async ({ page }) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events: n === 1 ? WAR : answer(`i${n}`, "Also try **Platoon**."),
  }));

  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();
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
      ? { events: WAR, hold: hold.promise }
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
      ? { events: WAR, hold: holds[n - 1].promise }
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

test("Stop after the cards keeps them and shares them with the model", async ({
  page,
}) => {
  const stream = await openAssistantStream(page);
  await page.goto("/");
  await send(page, "war movies");
  await stream.send(
    { type: "start", interactionId: "i1" },
    { type: "delta", text: INTRO },
    ...showCards([FURY, FIGHT_CLUB]),
  );
  await expect(cards(page)).toHaveCount(2);
  // the model is still writing its closing line
  await expect(page.getByRole("status")).toBeVisible();

  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByText("Stopped")).toBeVisible();
  await expect(cards(page).getByRole("heading")).toHaveText([
    "Fury",
    "Fight Club",
  ]);
  await send(page, "more like the first one");
  await expect.poll(() => stream.calls()).toHaveLength(2);
  expect((await stream.calls())[1]).toEqual({
    content: "more like the first one",
    stoppedTurns: [
      {
        prompt: "war movies",
        partialText: `${INTRO}\n\n[Shown as cards: 1. Fury (movie 228150, 2014); 2. Fight Club (movie 550, 1999)]`,
      },
    ],
  });
});

test("Add to list on a card saves the title to the list", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  await page.goto("/");
  await stubAssistant(page, () => ({ events: WAR }));
  await send(page, "war movies");

  await card(page, "Fury").getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Planning to watch");
  await dialog.getByRole("button", { name: "Add to list" }).click();

  await expect(page.getByText("Fury was added to the list.")).toBeVisible();
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({
      movieId: 228150,
      name: "Fury",
      image: "/backdrop-228150.jpg",
      status: "Planning to watch",
      type: "movie",
    }),
  ]);
});

test("Add to list on a card asks a signed-out user to log in", async ({
  page,
}) => {
  await stubAssistant(page, () => ({ events: WAR }));
  await send(page, "war movies");

  await card(page, "Fury").getByRole("button", { name: "Add to list" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status:").selectOption("Planning to watch");
  await dialog.getByRole("button", { name: "Add to list" }).click();

  await expect(page.getByText("You need to be logged in!")).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

for (const width of [375, 320]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("cards fit the screen", async ({ page }) => {
      const long = title(1, {
        title: "An Extraordinarily Long Title That Has To Wrap Somewhere",
        reason: `Unbreakable: ${"x".repeat(120)}`,
      });
      await stubAssistant(page, () => ({
        events: cardsAnswer("i1", INTRO, [FURY, long]),
      }));
      await send(page, "war movies");

      await expect(cards(page)).toHaveCount(2);
      for (const item of await cards(page).all()) {
        const add = item.getByRole("button", { name: "Add to list" });
        await add.scrollIntoViewIfNeeded();
        await expect(add).toBeInViewport({ ratio: 1 });
        // the title wraps left of the corner button
        const titleBox = (await item.getByRole("heading").boundingBox())!;
        const linkBox = (await item.getByRole("link").boundingBox())!;
        const addBox = (await add.boundingBox())!;
        expect(linkBox.x + linkBox.width).toBeLessThanOrEqual(addBox.x);
        expect(titleBox.y + titleBox.height).toBeGreaterThanOrEqual(
          addBox.y + addBox.height,
        );
      }
      // each message scrolls on its own, so check those too
      const overflowing = await page
        .locator("html, main .overflow-auto, main .overflow-y-auto")
        .evaluateAll((elements) =>
          elements
            .filter((e) => e.scrollWidth > e.clientWidth)
            .map((e) => e.className),
        );
      expect(overflowing).toEqual([]);
    });
  });
}

test("New chat clears the conversation", async ({ page }) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events: n === 1 ? WAR : answer(`i${n}`, "Also try **Platoon**."),
  }));
  const newChat = page.getByRole("button", { name: "New chat" });
  await expect(newChat).toBeDisabled();

  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();
  await newChat.click();

  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("war movies")).toHaveCount(0);
  await expect(newChat).toBeDisabled();

  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[1]).toEqual({ content: "something older" });
});
