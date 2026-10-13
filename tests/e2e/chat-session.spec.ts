import { BASE_URL } from "./env";
import { expect, test } from "./fixtures";
import {
  answer,
  card,
  cards,
  cardsAnswer,
  openAssistantStream,
  send,
  stubAssistant,
  title,
} from "./helpers/chat";

// the chat is kept in sessionStorage for the tab: refreshes, other pages
// and the sign-in round trip keep it

const FURY = title(228150, { title: "Fury" });
const WAR = cardsAnswer("i1", "Here are some war films.", [FURY]);
const PLATOON = "Also try **Platoon**.";
const EXPIRED = /This conversation is too old to continue/;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a refresh keeps the chat, and the follow-up continues it", async ({
  page,
}) => {
  const calls = await stubAssistant(page, (_body, n) => ({
    events: n === 1 ? WAR : answer(`i${n}`, PLATOON),
  }));
  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();

  await page.reload();

  await expect(page.getByText("war movies")).toBeVisible();
  await expect(card(page, "Fury")).toBeVisible();
  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[1]).toEqual({
    previousInteractionId: "i1",
    content: "something older",
  });
});

test("another page and back keeps the chat", async ({ page, loginAs }) => {
  await loginAs();
  await page.goto("/");
  const calls = await stubAssistant(page, (_body, n) => ({
    events: n === 1 ? WAR : answer(`i${n}`, PLATOON),
  }));
  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();

  // client-side navigation: the chat unmounts and mounts again
  const nav = page.locator("nav#top");
  await nav.getByRole("link", { name: "My list" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/my-list`);
  await nav.getByRole("link", { name: "CineRadar" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/`);

  await expect(card(page, "Fury")).toBeVisible();
  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  expect(calls[1]).toMatchObject({ previousInteractionId: "i1" });
});

test("New chat clears the saved chat", async ({ page }) => {
  await stubAssistant(page, () => ({ events: WAR }));
  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();

  await page.getByRole("button", { name: "New chat" }).click();
  await page.reload();

  await expect(page.getByText(/Ask me for movie or TV show/)).toBeVisible();
  await expect(page.getByText("war movies")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New chat" })).toBeDisabled();
});

test("signing out clears the saved chat", async ({ page, loginAs }) => {
  await loginAs();
  await page.goto("/");
  await stubAssistant(page, () => ({ events: WAR }));
  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();

  const nav = page.locator("nav#top");
  await nav.getByRole("button", { name: "Account menu" }).click();
  await nav.getByRole("button", { name: "Sign Out" }).click();
  await expect(nav.getByRole("link", { name: "Sign In" })).toBeVisible();
  await page.reload();

  await expect(page.getByText(/Ask me for movie or TV show/)).toBeVisible();
  await expect(page.getByText("war movies")).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
});

test("a refresh during an answer keeps it as stopped", async ({ page }) => {
  const stream = await openAssistantStream(page);
  await page.goto("/");
  await send(page, "war movies");
  await stream.send(
    { type: "start", interactionId: "i1" },
    { type: "delta", text: "Fury is a tense tank drama." },
  );
  await expect(page.getByText("Fury is a tense tank drama.")).toBeVisible();

  await page.reload();

  await expect(page.getByText("Fury is a tense tank drama.")).toBeVisible();
  await expect(page.getByText("Stopped")).toBeVisible();
  await send(page, "something older");
  await expect.poll(() => stream.calls()).toHaveLength(1);
  expect((await stream.calls())[0]).toEqual({
    content: "something older",
    stoppedTurns: [
      { prompt: "war movies", partialText: "Fury is a tense tank drama." },
    ],
  });
});

test("a conversation Gemini no longer has shows a notice, and the next message starts fresh", async ({
  page,
}) => {
  const calls = await stubAssistant(page, (_body, n) =>
    n === 2
      ? { status: 409, json: { error: "conversation_expired" } }
      : { events: n === 1 ? WAR : answer(`i${n}`, PLATOON) },
  );
  await send(page, "war movies");
  await expect(card(page, "Fury")).toBeVisible();
  await page.reload();

  await send(page, "something older");

  await expect(page.getByText(EXPIRED)).toBeVisible();
  await expect(
    page.getByText("Unfortunately an error occurred. Try again later."),
  ).toHaveCount(0);
  // the messages stay
  await expect(card(page, "Fury")).toBeVisible();
  await expect(page.getByText("something older")).toBeVisible();
  expect(calls[1]).toMatchObject({ previousInteractionId: "i1" });

  await send(page, "something older");
  await expect(page.getByText("Platoon")).toBeVisible();
  await expect(page.getByText(EXPIRED)).toHaveCount(0);
  expect(calls[2]).toEqual({ content: "something older" });
});
