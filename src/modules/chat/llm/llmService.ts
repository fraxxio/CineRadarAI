// the only module that talks to Gemini, the rest of the app uses our own types
import { GoogleGenAI, type Interactions } from "@google/genai";
import {
  CHAT_MODEL,
  CHAT_THINKING_LEVEL,
  MAX_TOOL_ROUNDS,
  buildSystemInstruction,
} from "../chatConfig";
import type { ChatStreamEvent, StoppedTurn } from "../protocol";
import { CHAT_TOOLS, runToolCalls } from "../tools/registry";
import { toFunctionResults, toGeminiTools } from "./geminiTools";
import { readRound, type RoundOutcome } from "./readRound";

type ChatReplyParams = {
  prompt: string;
  // oldest first
  stoppedTurns: StoppedTurn[];
  previousInteractionId?: string;
  // aborts the Gemini request, also while it's streaming
  signal: AbortSignal;
};

const text = (value: string): Interactions.Content[] => [
  { type: "text", text: value },
];

// stopped turns go before the prompt so the model sees what the user saw
export function buildChatInput(
  prompt: string,
  stoppedTurns: StoppedTurn[],
): string | Interactions.Step[] {
  if (stoppedTurns.length === 0) {
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
  steps.push({ type: "user_input", content: text(prompt) });
  return steps;
}

type GeminiStream = AsyncIterable<Interactions.InteractionSSEEvent>;

type RoundRequest = {
  input: string | Interactions.Step[];
  previousInteractionId?: string;
  toolChoice: Interactions.ToolChoiceType;
};

// throws if Gemini refuses to start (e.g. expired/unknown previous
// interaction id, invalid key, quota); later failures, including tool rounds,
// are thrown by the returned iterable or sent as an error event
export async function streamChatReply({
  prompt,
  stoppedTurns,
  previousInteractionId,
  signal,
}: ChatReplyParams): Promise<AsyncIterable<ChatStreamEvent>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const tools = toGeminiTools(CHAT_TOOLS);
  const systemInstruction = buildSystemInstruction();

  // every round is a new interaction continuing the previous one
  const openRound = (request: RoundRequest): Promise<GeminiStream> =>
    ai.interactions.create(
      {
        model: CHAT_MODEL,
        input: request.input,
        previous_interaction_id: request.previousInteractionId,
        // interaction-scoped: must be resent every round
        tools,
        system_instruction: systemInstruction,
        generation_config: {
          thinking_level: CHAT_THINKING_LEVEL,
          tool_choice: request.toolChoice,
        },
        stream: true,
      },
      { signal },
    );

  const first = await openRound({
    input: buildChatInput(prompt, stoppedTurns),
    previousInteractionId,
    toolChoice: "auto",
  });
  return runTurn(first, openRound, signal);
}

// reads rounds and runs the requested tools until the model answers
async function* runTurn(
  first: GeminiStream,
  openRound: (request: RoundRequest) => Promise<GeminiStream>,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  let stream = first;

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
    // tool_choice "none" was ignored
    if (round >= MAX_TOOL_ROUNDS) {
      console.error(`Gemini still wants tools after ${MAX_TOOL_ROUNDS} rounds`);
      yield { type: "error" };
      return;
    }

    // throws on abort: the turn ends without another request
    const started = Date.now();
    const results = await runToolCalls(outcome.calls, signal);
    const errors = results.filter((result) => result.isError).length;
    console.info(
      `Tool round ${round + 1}: ${outcome.calls.map((call) => call.name).join(", ")} (${Date.now() - started} ms, ${errors} errors)`,
    );
    // every started call ends, also the rejected ones: the round settles
    // together, so all its lines stop at once
    for (const call of outcome.calls) {
      yield { type: "tool_end", id: call.id };
    }

    stream = await openRound({
      input: toFunctionResults(results),
      previousInteractionId: outcome.interactionId,
      toolChoice: round + 1 >= MAX_TOOL_ROUNDS ? "none" : "auto",
    });
  }
}
