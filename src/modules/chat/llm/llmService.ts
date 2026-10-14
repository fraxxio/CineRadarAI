// the only module that talks to Gemini, the rest of the app uses our own types
import { GoogleGenAI, type Interactions } from "@google/genai";
import {
  CHAT_MODEL,
  CHAT_THINKING_LEVEL,
  MAX_TOOL_ROUNDS,
  buildSystemInstruction,
} from "../chatConfig";
import type { EntryKey } from "@/modules/my-list";
import type { ChatStreamEvent, StoppedTurn } from "../protocol";
import { CHAT_TOOLS, runToolCalls } from "../tools/registry";
import { SAVE_TO_LIST } from "../tools/saveToList";
import { SHOW_RECOMMENDATIONS } from "../tools/showRecommendations";
import type { ChatUser, ToolCall, ToolResult } from "../tools/types";
import { toFunctionResults, toGeminiTools } from "./geminiTools";
import { listChangeNote } from "./listChangeNote";
import { readRound, type RoundOutcome } from "./readRound";

type ChatReplyParams = {
  prompt: string;
  // oldest first
  stoppedTurns: StoppedTurn[];
  previousInteractionId?: string;
  // aborts the Gemini request, also while it's streaming
  signal: AbortSignal;
  // from the session; the tools act for this user only
  user: ChatUser;
  // entries changed outside the model, from the client; only their keys
  listChanges: EntryKey[];
};

const text = (value: string): Interactions.Content[] => [
  { type: "text", text: value },
];

// stopped turns go before the prompt so the model sees what the user saw,
// then the list-change note, which is newer than them
export function buildChatInput(
  prompt: string,
  stoppedTurns: StoppedTurn[],
  note?: string,
): string | Interactions.Step[] {
  if (stoppedTurns.length === 0 && !note) {
    return prompt;
  }

  const steps: Interactions.Step[] = [];
  for (const { prompt: stoppedPrompt, partialText } of stoppedTurns) {
    steps.push({ type: "user_input", content: text(stoppedPrompt) });
    // stopped before any text arrived: the model said nothing
    if (partialText) {
      steps.push({ type: "model_output", content: text(partialText) });
    }
  }
  if (note) {
    steps.push({ type: "user_input", content: text(note) });
  }
  steps.push({ type: "user_input", content: text(prompt) });
  return steps;
}

// the fields every round sends; scripts/check-chat-tools.ts sends them too,
// so the live check can't drift from the app's request
export function baseRequest({
  userStatus,
}: {
  userStatus: ChatUser["status"];
}) {
  return {
    model: CHAT_MODEL,
    // interaction-scoped: must be resent every round
    tools: toGeminiTools(CHAT_TOOLS),
    system_instruction: buildSystemInstruction(new Date(), { userStatus }),
    generation_config: { thinking_level: CHAT_THINKING_LEVEL },
  };
}

// the last tool round may only show the cards or save; "validated" still
// lets the model answer with text (Gemini rejects "auto" in allowed_tools)
export const FINAL_ROUND_TOOL_CHOICE: Interactions.ToolChoiceConfig = {
  allowed_tools: {
    mode: "validated",
    tools: [SHOW_RECOMMENDATIONS, SAVE_TO_LIST],
  },
};

type ToolChoice = Interactions.ToolChoiceConfig | Interactions.ToolChoiceType;

const FIRST_TOOL_CHOICE: ToolChoice = "auto";

// the tools a request sent with this choice may call, null for any
function allowedTools(choice: ToolChoice): string[] | null {
  if (choice === "none") {
    return [];
  }
  return typeof choice === "string"
    ? null
    : choice.allowed_tools?.tools ?? null;
}

// the model's answer to a call it wasn't allowed to make
const refused = (call: ToolCall): ToolResult => ({
  callId: call.id,
  name: call.name,
  output: "No more tool calls in this answer: reply in text",
  isError: true,
});

// the request carrying the results of round `round`'s calls; once the cards
// are shown, the model only writes text, so "recommend X and add the first
// one" saves nothing until the user asks again (accepted)
function nextToolChoice(round: number, shownCards: boolean): ToolChoice {
  if (shownCards || round >= MAX_TOOL_ROUNDS) {
    return "none";
  }
  return round + 1 >= MAX_TOOL_ROUNDS ? FINAL_ROUND_TOOL_CHOICE : "auto";
}

type GeminiStream = AsyncIterable<Interactions.InteractionSSEEvent>;

type RoundRequest = {
  input: string | Interactions.Step[];
  previousInteractionId?: string;
  toolChoice: ToolChoice;
};

const geminiClient = () =>
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// true only when Gemini says the interaction doesn't exist (anymore), e.g. a
// saved chat that outlived it; any other failure (invalid key, quota, a
// malformed id) is a 4xx too, so the status of the failed create can't tell
export async function isInteractionGone(
  id: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    await geminiClient().interactions.get(id, null, { signal });
    return false;
  } catch (error) {
    return (error as { status?: unknown } | null)?.status === 404;
  }
}

// throws if Gemini refuses to start (e.g. expired/unknown previous
// interaction id, invalid key, quota); later failures, including tool rounds,
// are thrown by the returned iterable or sent as an error event
export async function streamChatReply({
  prompt,
  stoppedTurns,
  previousInteractionId,
  signal,
  user,
  listChanges,
}: ChatReplyParams): Promise<AsyncIterable<ChatStreamEvent>> {
  const ai = geminiClient();
  const base = baseRequest({ userStatus: user.status });

  // every round is a new interaction continuing the previous one
  const openRound = (request: RoundRequest): Promise<GeminiStream> =>
    ai.interactions.create(
      {
        ...base,
        input: request.input,
        previous_interaction_id: request.previousInteractionId,
        generation_config: {
          ...base.generation_config,
          tool_choice: request.toolChoice,
        },
        stream: true,
      },
      { signal },
    );

  const note = await listChangeNote(user, listChanges);
  const first = await openRound({
    input: buildChatInput(prompt, stoppedTurns, note),
    previousInteractionId,
    toolChoice: FIRST_TOOL_CHOICE,
  });
  return runTurn(first, openRound, { signal, user });
}

// reads rounds and runs the requested tools until the model answers
async function* runTurn(
  first: GeminiStream,
  openRound: (request: RoundRequest) => Promise<GeminiStream>,
  ctx: { signal: AbortSignal; user: ChatUser },
): AsyncGenerator<ChatStreamEvent> {
  let stream = first;
  // the choice the request of the current round was sent with
  let toolChoice = FIRST_TOOL_CHOICE;
  let ignoredChoice = false;

  // round 0 answers the prompt, round n the results of tool round n
  for (let round = 0; ; round++) {
    const outcome: RoundOutcome = yield* readRound(stream, {
      firstRound: round === 0,
    });

    if (outcome.status === "completed") {
      yield { type: "done", interactionId: outcome.interactionId };
      return;
    }
    if (outcome.status !== "requires_action" || outcome.calls.length === 0) {
      console.error(
        `Gemini round ${round} ended with status "${outcome.status}" and ${outcome.calls.length} calls`,
      );
      yield { type: "error" };
      return;
    }
    const names = outcome.calls.map((call) => call.name).join(", ");
    // Gemini can ignore the tool choice (e.g. call show_recommendations again
    // after "none"): the round's calls don't run, and it gets one more
    // request, with "none", to answer in text; the cards shown stay
    const allowed = allowedTools(toolChoice);
    const ignored =
      allowed !== null &&
      outcome.calls.some((call) => !allowed.includes(call.name));
    if (ignored) {
      const message = `Gemini round ${round} ignored tool_choice ${JSON.stringify(toolChoice)}: ${names}`;
      if (ignoredChoice) {
        console.error(message);
        yield { type: "error" };
        return;
      }
      console.warn(message);
      ignoredChoice = true;
    }

    // throws on abort: the turn ends without another request
    const started = Date.now();
    const results = ignored
      ? outcome.calls.map(refused)
      : await runToolCalls(outcome.calls, ctx);
    const errors = results.filter((result) => result.isError).length;
    console.info(
      `Tool round ${round + 1}: ${names} (${Date.now() - started} ms, ${errors} errors)`,
    );
    // every started call ends, also the rejected ones: the round settles
    // together, so all its lines stop at once
    for (const call of outcome.calls) {
      yield { type: "tool_end", id: call.id };
    }
    // below the paused tool line, in call order
    const events = results.flatMap((result) => result.events ?? []);
    yield* events;
    const shownCards = events.some((event) => event.type === "cards");

    toolChoice = ignored ? "none" : nextToolChoice(round, shownCards);
    stream = await openRound({
      input: toFunctionResults(results),
      previousInteractionId: outcome.interactionId,
      toolChoice,
    });
  }
}
