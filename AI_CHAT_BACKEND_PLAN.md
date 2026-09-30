# AI chat refactor: backend implementation plan

Backend half of [issue #4](https://github.com/fraxxio/CineRadarAI/issues/4). The frontend half (`useChat`, Stop, New chat) is done on branch `refactor-ai-chat-feature`.

This plan follows the ticket, with the changes listed in section 1. Those came up while building the frontend and aren't in the ticket.

---

## 1. Changes compared to the ticket

| # | Ticket says | Change | Why |
|---|---|---|---|
| C1 | The client stores **one** stopped turn and sends it with the next message. | Send a **list**: `stoppedTurns: StoppedTurn[]`. | With one slot, two stops in a row lose the first one (see 1.1). |
| C2 | `streamChatReply(...): AsyncIterable<ChatStreamEvent>` | `streamChatReply(...): Promise<AsyncIterable<ChatStreamEvent>>` | If it's an async generator, a failing `interactions.create` only throws once the stream is already open, so the route can't answer 502 any more. The client relies on a non-OK status to know that no interaction was created (see 1.2). |
| C3 | Move `CHAT_MODEL` and `buildSystemInstruction` into `llmService`. | Keep them in `src/lib/chatConfig.ts`. `llmService` imports them. | Neither is Gemini-specific, `chatConfig.ts` doesn't import `@google/genai`, and `tests/unit/lib/chatConfig.test.ts` already covers it. The acceptance rule ("only `llmService` imports `@google/genai`") still holds. |
| C4 | "Guard `controller.close()` so it doesn't throw after a cancel." | Guard `controller.enqueue()` too, and don't log an aborted Gemini stream as an error. | After a cancel, `enqueue` throws as well. Aborting makes the `for await` over Gemini events throw an `AbortError`, which today would be logged and answered with an `error` event. |
| C5 | Stop the Gemini request from `cancel()` **and/or** `request.signal`. | Use `cancel()` as the main trigger and listen to `request.signal` as well. Check the logs in both `next dev` and on Vercel. | The route runs on `runtime = "edge"` with Next 14.1.3. Whether `request.signal` aborts on client disconnect there isn't guaranteed. `ReadableStream.cancel()` is. |
| C6 | Validate the stopped turn "with a sensible limit on the partial text". | Limits are already defined in shared code: `MAX_STOPPED_TEXT_LENGTH = 10000` in `src/lib/chatLimits.ts`. Add `MAX_STOPPED_TURNS = 5` next to it. | The client already cuts `partialText` to that length. The client and server have to use the same numbers, or valid clients get a 400. |

### 1.1 Why a list (C1)

With a single slot:

1. `p1` finishes: `interactionId = i1`.
2. `p2` is stopped with partial text `A`: stored `{ p2, A }`, `interactionId` stays `i1`.
3. `p3` is sent with `{ p2, A }`. Google creates `i3` with `[p2, A, p3]`. `p3` is stopped with partial text `B`. `i3` is ignored (stopped interactions aren't continued), and the stored turn becomes `{ p3, B }`.
4. `p4` is sent with `previousInteractionId: i1` and `{ p3, B }`. The model sees `p1, a1, p3, B, p4`, so **`p2` and `A` are lost**, even though they're still on screen.

With a list, step 4 sends `[{ p2, A }, { p3, B }]`, and the model sees everything the user saw. The list is cleared after the next finished reply, because that interaction now contains those steps.

### 1.2 What the frontend already does (don't break it)

- Request body (types in `src/types/chatStream.ts`, global, no import needed):
  `{ content, previousInteractionId?, stoppedTurns? }`. Absent keys are left out; `undefined` isn't sent.
- `partialText` can be `""` (Stop pressed before any text arrived).
- If the response is **non-OK**, or the stream fails **before a `start` event**, the client resets the conversation: it drops `interactionId` **and** the stored stopped turns. So a 400 for invalid stopped turns ends that conversation cleanly instead of failing again on every send. Keep the current status codes: 400 for bad input, 502 when `create` fails, 503 when the feature is off.
- The NDJSON protocol (`start`, `delta`, `done`, `error`) doesn't change. The client ignores the `start` id of a stopped turn, but uses it to decide whether a failed turn was created at all.

---

## 2. Step 0: check that the API accepts `model_output` steps

The ticket asks for this before anything builds on it. The SDK types allow it (`InteractionsInput = … | Array<Step>`, `ModelOutputStep = { type: "model_output", content?: Content[] }`), but the API may still reject a `model_output` step combined with `previous_interaction_id`.

Run once with a real key. It's a throwaway script; don't commit it:

```ts
// check-steps.mts — run with: npx tsx check-steps.mts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const text = (t: string) => [{ type: "text" as const, text: t }];

const first = await ai.interactions.create({ model, input: "Recommend 3 war movies." });
const second = await ai.interactions.create({
  model,
  previous_interaction_id: first.id,
  input: [
    { type: "user_input", content: text("Now 3 comedies.") },
    { type: "model_output", content: text("1. Airplane! (1980)\n2. Groundhog") },
    { type: "user_input", content: text("What was the first comedy and the first war movie you listed?") },
  ],
});
console.log(JSON.stringify(second, null, 2));
```

The answer should name *Airplane!* and the first war movie from `first`. Also try it with two stopped pairs, and with no `model_output` (Stop before any text arrived).

**If the API rejects it:** don't send `model_output` steps. Instead, turn each stopped turn into plain text and put it at the start of the new prompt, as a single `user_input`:
`[Earlier I asked: "<prompt>". You started answering: "<partialText>" and I stopped you.]`
Only `buildChatInput` (section 4) changes; nothing else in this plan does.

---

## 3. Frontend follow-up (C1)

This is a small change to code that's already done, so it can ship in the same PR:

- `src/types/chatStream.ts`: `ChatRequest.stoppedTurn?` → `stoppedTurns?: StoppedTurn[]`.
- `src/lib/chatLimits.ts`: add `export const MAX_STOPPED_TURNS = 5;`. That's 5 prompt/answer pairs, which matches the 10-message limit in the chat.
- `src/hooks/useChat.ts`: `stoppedTurnRef` becomes a list. `stop()` adds to it and keeps only the last `MAX_STOPPED_TURNS`, so a client never goes over the server limit. A finished reply, an error before `start`, and `reset()` clear it. Send `stoppedTurns` only when the list isn't empty.
- Tests: `tests/components/ChatAssistant.test.tsx` (the expected bodies change, and add a "two stops in a row" case), and the Stop e2e test in `tests/e2e/chat.spec.ts`.

---

## 4. `llmService`

New file `src/lib/llm/llmService.ts`. It is the only file that imports `@google/genai`.

```ts
import { GoogleGenAI, type Interactions } from "@google/genai"; // check the exported type name
import { CHAT_MODEL, buildSystemInstruction } from "@/lib/chatConfig";

type ChatReplyParams = {
  prompt: string;
  stoppedTurns: StoppedTurn[];
  previousInteractionId?: string;
  signal: AbortSignal;
};

// pure, exported for unit tests
export function buildChatInput(prompt: string, stoppedTurns: StoppedTurn[]) { … }

// throws if Gemini refuses to start (bad key, quota, unknown previous id)
export async function streamChatReply(params: ChatReplyParams): Promise<AsyncIterable<ChatStreamEvent>> { … }
```

**`buildChatInput`**
- If there are no stopped turns, return `prompt` as a **string**. The request then looks exactly like today's, and the existing integration test keeps passing.
- Otherwise return the steps, one stopped turn after another:
  `user_input(prompt₁)`, `model_output(partialText₁)` only if it's non-empty, …, and finally `user_input(prompt)`.

**`streamChatReply`**
- Create the client (`new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`), then:
  ```ts
  const stream = await ai.interactions.create(
    { model: CHAT_MODEL, input, previous_interaction_id, system_instruction: buildSystemInstruction(),
      generation_config: { thinking_level: "minimal" }, stream: true },
    { signal },
  );
  ```
  `signal` is accepted: the options type is `RequestOptions & Omit<RequestInit, "method" | "body">`.
- Return an async generator that maps Gemini events to `ChatStreamEvent`, moved over unchanged from `route.ts`: `interaction.created` → `start`, text `step.delta` → `delta`, `interaction.completed` → `done` or `error` depending on status, `error` → `error` (logged).
- Errors thrown while iterating are passed on to the route. The route decides whether it was an abort.

**Keeping `@google/genai` in one file**
- Add an ESLint `no-restricted-imports` rule for `@google/genai` in `.eslintrc.json`, with an `overrides` entry that allows it in `src/lib/llm/**`. `npm run lint` then enforces the acceptance rule.
- Optional: `import "server-only"`. It **isn't installed**, so this needs `npm i server-only`. Vitest would then need an alias for `server-only` to an empty module, because its default export throws outside a React Server build. Skip it if the ESLint rule is enough.
- It has to work on the Edge runtime (`route.ts` has `runtime = "edge"`). It does, because it uses the same SDK calls as today.

---

## 5. Route (`src/app/api/assistant/route.ts`)

The route handles the feature flag, validation, the abort wiring and NDJSON encoding. Nothing Gemini-specific stays in it.

### 5.1 Validation

Use a zod schema, like the add-to-list route (D38):

```ts
const promptSchema = z.string().refine((s) => s.trim().length > 0).pipe(z.string().max(MAX_PROMPT_LENGTH));
const bodySchema = z.object({
  content: promptSchema,
  previousInteractionId: z.string().nullish(),
  stoppedTurns: z
    .array(z.object({ prompt: promptSchema, partialText: z.string().max(MAX_STOPPED_TEXT_LENGTH) }))
    .max(MAX_STOPPED_TURNS)
    .optional(),
});
```

- Keep the current order and responses: 503 when the flag is off, 400 for bad JSON or JSON `null` (B11), 400 for anything the schema rejects. The existing tests only check the status codes. Keeping the error messages ("Invalid message", "Invalid interaction id") is optional.
- `partialText` may be `""`, so it has no minimum length.
- Anyone can send made-up "model" text this way. The ticket accepts that; the caps keep the cost down, at most about 55 KB of extra input per request.

### 5.2 Stopping Gemini when the client leaves

```ts
const abort = new AbortController();
request.signal.addEventListener("abort", () => abort.abort());

let events;
try {
  events = await streamChatReply({ prompt, stoppedTurns, previousInteractionId, signal: abort.signal });
} catch (error) {
  if (abort.signal.aborted) return new Response(null, { status: 499 }); // client already gone
  console.error("Gemini interaction error:", error);
  return NextResponse.json({ error: "Failed to start chat" }, { status: 502 });
}

let closed = false;
const body = new ReadableStream({
  async start(controller) {
    const send = (event: ChatStreamEvent) => {
      if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
    };
    try {
      for await (const event of events) send(event);
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Gemini stream error:", error);
        send({ type: "error" });
      }
    } finally {
      if (!closed) {
        closed = true;
        controller.close();
      }
    }
  },
  cancel() {
    closed = true;
    abort.abort();
    console.info("Chat stream cancelled by the client"); // the "check the logs" acceptance item
  },
});
```

- `ai.interactions.cancel(id)` isn't used; it only works for background interactions. Aborting is client-side only on Google's side, so a stopped turn may still finish and be billed there. That's expected.
- The client never uses a stopped interaction's id, so nothing else needs cleaning up.

---

## 6. Tests

**Unit: `tests/unit/lib/llm/buildChatInput.test.ts`** (new)
- No stopped turns → the plain string.
- One stopped turn → `user_input`, `model_output`, `user_input`.
- Empty `partialText` → no `model_output` step.
- Two stopped turns → in order, and the new prompt comes last.

**Integration: `tests/integration/api/assistant.test.ts`** (update)
- `vi.mock("@google/genai")` still works, because it mocks the module wherever it's imported. Nothing to change there.
- "passes the prompt, model, history and system instruction to Gemini": `create` now gets a second argument. Assert `expect.objectContaining({ signal: expect.any(AbortSignal) })`.
- New 400 cases: `stoppedTurns` isn't an array; more than `MAX_STOPPED_TURNS`; `prompt` isn't a string, is only whitespace, or is over `MAX_PROMPT_LENGTH`; `partialText` isn't a string or is over `MAX_STOPPED_TEXT_LENGTH`. Also check that the exact limits are accepted.
- `stoppedTurns` are passed to `create` as steps, together with `previous_interaction_id`.
- Cancel: read the first line, call `res.body.cancel()`, then expect the `signal` passed to `create` to be aborted, `console.error` not called, and nothing thrown.
- An `AbortError` thrown mid-stream → no `error` line, and nothing is logged.
- The 502 test still passes (this depends on C2).

**E2E**
- `tests/e2e/chat.spec.ts`: the Stop test expects `stoppedTurns: [{ prompt: "war movies", partialText: "" }]`. Add a "two stops in a row" case.
- The e2e tests stub `/api/assistant` in the browser, so they don't test the server. The integration tests do.

**Manual check with a real key** (acceptance items that tests can't cover)
1. Stop while the thinking loader is showing, and again mid-stream. The server logs "Chat stream cancelled by the client", and no error shows in the UI.
2. After stopping mid-list, send "continue" and "more like #2". The replies should build on the partial answer.
3. Stop twice in a row, then refer back to the first stopped answer.
4. Send the next message after a stop. It shouldn't fail with an expired or invalid interaction error.
5. Click New chat, then ask "what did I ask before?". The model shouldn't know.
6. Repeat 1 on the Vercel preview. The Edge runtime may behave differently from `next dev` (C5).

---

## 7. Order of work

1. Step 0 (section 2): decide between `model_output` steps and the plain-text fallback.
2. Extract `llmService` with no change in behaviour (C2, C3), and add the ESLint rule. The existing tests must stay green.
3. Stopped turns: the frontend follow-up (section 3), the route validation (5.1) and `buildChatInput`.
4. Abort wiring (5.2).
5. Tests (section 6) and the manual check.
6. Update issue #4 with C1 and C2, and with the step 0 result if the fallback was used.

## Out of scope

As in the ticket: persisting or listing conversations, and deleting interactions on Google's side.
