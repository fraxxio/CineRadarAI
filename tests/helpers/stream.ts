const encoder = new TextEncoder();

export const ndjson = (...events: object[]) =>
  events.map((e) => JSON.stringify(e) + "\n").join("");

// fixed chunks: the chunk boundaries are exactly what the test passes in
export const streamResponse = (chunks: string[], init?: ResponseInit) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((ch) => c.enqueue(encoder.encode(ch)));
        c.close();
      },
    }),
    init,
  );

// open stream the test drives step by step (live-rendering assertions)
export function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: (c) => void (controller = c),
  });
  return {
    response: new Response(body),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

export async function readNdjson(res: Response) {
  const text = await res.text();
  return {
    text,
    events: text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l)),
  };
}

// Gemini SDK side: async iterable of interaction events, optionally throwing midway
export async function* geminiEvents(events: object[], throwAfter?: number) {
  for (const [i, e] of events.entries()) {
    if (i === throwAfter) throw new Error("stream broke");
    yield e;
  }
}
