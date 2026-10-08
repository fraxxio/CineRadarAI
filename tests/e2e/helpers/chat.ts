import type { Page } from "@playwright/test";
import type { ChatStreamEvent } from "../../../src/modules/chat";

type Reply = {
  status?: number;
  events?: ChatStreamEvent[];
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
    const { status = 200, events = [], hold } = await reply(body, calls.length);
    await hold; // lets a test observe the loading state
    await route
      .fulfill({
        status,
        contentType: "application/x-ndjson",
        body: events.map((e) => JSON.stringify(e) + "\n").join(""),
      })
      .catch(() => {}); // the page aborted the request (Stop, New chat)
  });
  return calls;
}

export const answer = (id: string, markdown: string): ChatStreamEvent[] => [
  { type: "start", interactionId: id },
  { type: "delta", text: markdown.slice(0, 20) },
  { type: "delta", text: markdown.slice(20) },
  { type: "done", interactionId: id },
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
  };
}
