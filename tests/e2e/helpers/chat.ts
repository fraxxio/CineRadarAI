import type { Page } from "@playwright/test";

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
