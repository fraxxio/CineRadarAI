import type { Page } from "@playwright/test";
import type {
  ChatStreamEvent,
  RecommendedTitle,
} from "../../../src/modules/chat";

type Reply = {
  status?: number;
  events?: ChatStreamEvent[];
  // a JSON body instead of the stream, e.g. an error response
  json?: unknown;
  hold?: Promise<void>;
};

export async function stubAssistant(
  page: Page,
  reply: (body: any, n: number) => Reply | Promise<Reply>,
) {
  const calls: any[] = [];
  await page.route("**/api/assistant", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const {
      status = 200,
      events = [],
      json,
      hold,
    } = await reply(body, calls.length);
    await hold; // lets a test observe the loading state
    await route
      .fulfill(
        json === undefined
          ? {
              status,
              contentType: "application/x-ndjson",
              body: events.map((e) => JSON.stringify(e) + "\n").join(""),
            }
          : { status, json },
      )
      .catch(() => {}); // the page aborted the request (Stop, New chat)
  });
  return calls;
}

export const promptInput = (page: Page) =>
  page.getByPlaceholder(/Suggest me movies/);

export async function send(page: Page, text: string) {
  await promptInput(page).fill(text);
  await page.getByRole("button", { name: "Submit" }).click();
}

export const cards = (page: Page) =>
  page.getByRole("list", { name: "Recommendations" }).getByRole("listitem");

export const card = (page: Page, name: string) =>
  cards(page).filter({ has: page.getByRole("link", { name, exact: true }) });

export const answer = (id: string, markdown: string): ChatStreamEvent[] => [
  { type: "start", interactionId: id },
  { type: "delta", text: markdown.slice(0, 20) },
  { type: "delta", text: markdown.slice(20) },
  { type: "done", interactionId: id },
];

// a card's data; the TMDB mock has a details fixture for movie 550
export const title = (
  id: number,
  extra: Partial<RecommendedTitle> = {},
): RecommendedTitle => ({
  type: "movie",
  id,
  title: `Title ${id}`,
  year: 2014,
  rating: 7.5,
  genres: ["War", "Drama"],
  posterPath: `/poster-${id}.jpg`,
  backdropPath: `/backdrop-${id}.jpg`,
  reason: `Why ${id} fits.`,
  ...extra,
});

// a turn as the server streams it: intro, the show_recommendations line, cards
export const cardsAnswer = (
  id: string,
  intro: string,
  items: RecommendedTitle[],
): ChatStreamEvent[] => [
  { type: "start", interactionId: id },
  { type: "delta", text: intro },
  ...showCards(items),
  { type: "done", interactionId: id },
];

export const showCards = (items: RecommendedTitle[]): ChatStreamEvent[] => [
  {
    type: "tool_start",
    id: "show",
    name: "show_recommendations",
    text: "Preparing recommendations...",
  },
  { type: "tool_end", id: "show" },
  { type: "cards", items },
];

// /api/assistant answered in the browser by a stream the test writes event
// by event; page.route can only answer with a complete body. Takes effect on
// the next navigation.
export async function openAssistantStream(page: Page) {
  await page.addInitScript(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== "/api/assistant") {
        return realFetch(input, init);
      }
      ((window as any).__assistantCalls ??= []).push(
        JSON.parse(String(init?.body)),
      );
      const encoder = new TextEncoder();
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start: (c) => void (controller = c),
      });
      (window as any).__assistantStream = {
        send: (event: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")),
        close: () => controller.close(),
      };
      return new Response(body, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    };
  });

  return {
    // waits for the chat's request, then writes the events
    async send(...events: ChatStreamEvent[]) {
      await page.waitForFunction(() => (window as any).__assistantStream);
      await page.evaluate((events) => {
        for (const event of events)
          (window as any).__assistantStream.send(event);
      }, events);
    },
    close: () => page.evaluate(() => (window as any).__assistantStream.close()),
    // the request bodies so far
    calls: (): Promise<any[]> =>
      page.evaluate(() => (window as any).__assistantCalls ?? []),
  };
}
