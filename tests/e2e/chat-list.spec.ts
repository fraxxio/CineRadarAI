import type { Page } from "@playwright/test";
import type {
  ChatStreamEvent,
  PendingSave,
  PreviousEntry,
  SavedEntry,
} from "../../src/modules/chat";
import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";
import {
  answer,
  card,
  cardsAnswer,
  send,
  stubAssistant,
  title,
} from "./helpers/chat";
import { getMovies, seedList } from "./helpers/db";

// list changes from the chat. /api/assistant is stubbed, so the saves the
// model makes are seeded in the DB; the real save_to_list path is covered by
// the route integration tests. Undo and the saves after sign-in use the real
// routes, and TMDB's mock answers every movie id with Fight Club

const FIGHT_CLUB = title(550, { title: "Fight Club", year: 1999 });
const FIGHT_CLUB_KEY = { movieId: 550, type: "movie" };
const ADDED = "Added to your list · Planning to watch";

const entry = (extra: Partial<SavedEntry> = {}): SavedEntry => ({
  type: "movie",
  id: 550,
  title: "Fight Club",
  posterPath: "/poster-550.jpg",
  image: "/backdrop-550.jpg",
  status: "Planning to watch",
  ...extra,
});

const pendingSave = (extra: Partial<PendingSave> = {}): PendingSave => ({
  type: "movie",
  id: 550,
  title: "Fight Club",
  posterPath: "/poster-550.jpg",
  status: "Planning to watch",
  ...extra,
});

// a turn as the server streams it: the save_to_list line, what the tool
// sent, then the model's line
const saveAnswer = (
  id: string,
  events: ChatStreamEvent[],
  text: string,
): ChatStreamEvent[] => [
  { type: "start", interactionId: id },
  {
    type: "tool_start",
    id: "save",
    name: "save_to_list",
    text: "Saving to your list...",
  },
  { type: "tool_end", id: "save" },
  ...events,
  { type: "delta", text },
  { type: "done", interactionId: id },
];

const saved = (
  e: SavedEntry,
  previous: PreviousEntry | null = null,
): ChatStreamEvent => ({ type: "list_saved", entry: e, previous });

const signInRequired = (save: PendingSave): ChatStreamEvent => ({
  type: "sign_in_required",
  save,
});

const badge = (page: Page, name: string) =>
  card(page, name).getByText(/^In your list ·/);

test("a save shows a row and a card badge, and Undo removes the title", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  // what save_to_list wrote
  await seedList(db, user.id, [
    {
      movieId: 550,
      name: "Fight Club",
      image: "/backdrop-550.jpg",
      rating: 0,
      status: "Planning to watch",
      type: "movie",
    },
  ]);
  await page.goto("/");
  const calls = await stubAssistant(page, (_body, n) => ({
    events: [
      cardsAnswer("i1", "Try this one.", [FIGHT_CLUB]),
      saveAnswer("i2", [saved(entry())], "Added to your list."),
      answer("i3", "It isn't in your list."),
    ][n - 1],
  }));
  await send(page, "movies about fight clubs");
  await expect(card(page, "Fight Club")).toBeVisible();

  await send(page, "add it to my watchlist");

  await expect(page.getByText(ADDED)).toBeVisible();
  await expect(badge(page, "Fight Club")).toHaveText(
    "In your list · Planning to watch",
  );

  await page.getByRole("button", { name: "Undo Fight Club" }).click();

  await expect(page.getByText("Undone")).toBeVisible();
  await expect(badge(page, "Fight Club")).toHaveCount(0);
  await expect.poll(() => getMovies(db, user.id)).toEqual([]);
  // the model learns of the Undo with the next message
  await send(page, "is it in my list?");
  await expect(page.getByText("It isn't in your list.")).toBeVisible();
  expect(calls[2]).toEqual({
    previousInteractionId: "i2",
    content: "is it in my list?",
    listChanges: [FIGHT_CLUB_KEY],
  });
});

test("Undo of a status change puts the old status and rating back", async ({
  page,
  loginAs,
  db,
}) => {
  const user = await loginAs();
  // after save_to_list moved it from Completed
  await seedList(db, user.id, [
    {
      movieId: 550,
      name: "Fight Club",
      image: "/fight-club.jpg",
      rating: 8,
      status: "Watching",
      type: "movie",
    },
  ]);
  await page.goto("/");
  const previous: PreviousEntry = {
    name: "Fight Club",
    image: "/fight-club.jpg",
    status: "Completed",
    rating: 8,
  };
  await stubAssistant(page, () => ({
    events: saveAnswer(
      "i1",
      [saved(entry({ image: "/fight-club.jpg", status: "Watching" }), previous)],
      "Moved it.",
    ),
  }));
  await send(page, "I'm rewatching Fight Club");

  await expect(
    page.getByText("Moved to Watching (was Completed)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo Fight Club" }).click();

  await expect(page.getByText("Undone")).toBeVisible();
  await expect
    .poll(() => getMovies(db, user.id))
    .toEqual([
      expect.objectContaining({
        movieId: 550,
        status: "Completed",
        rating: 8,
        image: "/fight-club.jpg",
      }),
    ]);
});

test("signed out, the sign-in card signs in and the title is saved on return", async ({
  page,
  loginAs,
  db,
}) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events:
      n === 1
        ? saveAnswer(
            "i1",
            [signInRequired(pendingSave())],
            "Please sign in to add titles to your list.",
          )
        : answer(`i${n}`, "Glad to help."),
  }));
  await page.goto("/");
  await send(page, "add Fight Club to my watchlist");
  await expect(
    page.getByText("Sign in to add Fight Club to your list"),
  ).toBeVisible();

  // aborting the provider's page instead fails the navigation itself, which
  // races the goto below
  await page.route("https://github.com/**", (r) =>
    r.fulfill({ body: "<html>GitHub</html>", contentType: "text/html" }),
  );
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.waitForURL(/github\.com\/login\/oauth\/authorize/);
  // what the OAuth callback would do
  const user = await loginAs();
  await page.goto("/");

  await expect(page.getByText("add Fight Club to my watchlist")).toBeVisible();
  await expect(page.getByText(ADDED)).toBeVisible();
  await expect(page.getByText(/^Sign in to add/)).toHaveCount(0);
  expect(await getMovies(db, user.id)).toEqual([
    expect.objectContaining({
      movieId: 550,
      name: "Fight Club",
      status: "Planning to watch",
      rating: 0,
      type: "movie",
    }),
  ]);

  // the model learns of the save with the next message
  await send(page, "thanks");
  await expect(page.getByText("Glad to help.")).toBeVisible();
  expect(calls[1]).toEqual({
    previousInteractionId: "i1",
    content: "thanks",
    listChanges: [FIGHT_CLUB_KEY],
  });

  // a refresh doesn't save again
  await page.reload();
  await expect(page.getByText(ADDED)).toHaveCount(1);

  await page.locator("nav#top").getByRole("link", { name: "My list" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await expect(
    page.locator("main").getByRole("link", { name: "Fight Club", exact: true }),
  ).toBeVisible();
});

test.describe("at 320 px", () => {
  test.use({ viewport: { width: 320, height: 800 } });

  const LONG = "An Extraordinarily Long Title That Has To Wrap Somewhere";

  // each message scrolls on its own, so check those too
  const overflowing = (page: Page) =>
    page
      .locator("html, main .overflow-auto, main .overflow-y-auto")
      .evaluateAll((elements) =>
        elements
          .filter((e) => e.scrollWidth > e.clientWidth)
          .map((e) => e.className),
      );

  async function expectTappable(page: Page, name: string) {
    const target = page.getByRole("main").getByRole("button", { name });
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport({ ratio: 1 });
    // fails when something covers it
    await target.click({ trial: true });
  }

  test("a saved row fits the screen", async ({ page }) => {
    await page.goto("/");
    await stubAssistant(page, () => ({
      events: saveAnswer(
        "i1",
        [
          saved(entry({ id: 1, title: LONG })),
          saved(entry({ id: 2, title: "Fury", status: "Completed" }), {
            name: "Fury",
            image: "",
            status: "Watching",
            rating: 0,
          }),
        ],
        "Added to your list.",
      ),
    }));
    await send(page, "add them");

    await expect(page.getByText(ADDED)).toBeVisible();
    await expectTappable(page, `Undo ${LONG}`);
    await expectTappable(page, "Undo Fury");
    expect(await overflowing(page)).toEqual([]);
  });

  test("the sign-in card fits the screen", async ({ page }) => {
    await page.goto("/");
    await stubAssistant(page, () => ({
      events: saveAnswer(
        "i1",
        [
          signInRequired(pendingSave()),
          signInRequired(pendingSave({ id: 1, title: LONG })),
          signInRequired(pendingSave({ id: 2, title: "Fury", status: null })),
        ],
        "Please sign in to add titles to your list.",
      ),
    }));
    await send(page, "add them");

    await expect(
      page.getByText("Sign in to add 3 titles to your list"),
    ).toBeVisible();
    await expectTappable(page, "Sign in with Google");
    await expectTappable(page, "Sign in with GitHub");
    const other = page.getByRole("link", { name: "Other sign-in options" });
    await expect(other).toBeInViewport({ ratio: 1 });
    await other.click({ trial: true });
    expect(await overflowing(page)).toEqual([]);
  });
});
