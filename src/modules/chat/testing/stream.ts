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

export const created = (id = "i1") => ({
  event_type: "interaction.created",
  interaction: { id },
});

export const textDelta = (text: string) => ({
  event_type: "step.delta",
  delta: { type: "text", text },
});

export const completed = (id = "i1", status = "completed") => ({
  event_type: "interaction.completed",
  interaction: { id, status },
});

export const requiresAction = (id: string) => completed(id, "requires_action");

// step.start of a function call; the real API sends `arguments: {}` here and
// the arguments as deltas
export const functionCall = (
  index: number,
  { id, name, args = {} }: { id: string; name: string; args?: object },
) => ({
  event_type: "step.start",
  index,
  step: { type: "function_call", id, name, arguments: args },
});

export const argsDelta = (index: number, json: string) => ({
  event_type: "step.delta",
  index,
  delta: { type: "arguments_delta", arguments: json },
});

export const stepStop = (index: number) => ({
  event_type: "step.stop",
  index,
});

// one complete call as the real API streams it: start, all arguments in one
// delta, stop
export const toolCall = (
  index: number,
  call: { id: string; name: string; args: object },
) => [
  functionCall(index, { id: call.id, name: call.name }),
  argsDelta(index, JSON.stringify(call.args)),
  stepStop(index),
];
