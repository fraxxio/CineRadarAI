// the only module that talks to Gemini, the rest of the app uses our own types
import { GoogleGenAI, type Interactions } from "@google/genai";
import { CHAT_MODEL, buildSystemInstruction } from "../chatConfig";
import type { ChatStreamEvent, StoppedTurn } from "../protocol";

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

// throws if Gemini refuses to start (e.g. expired/unknown previous
// interaction id, invalid key, quota), errors while streaming are thrown by
// the returned iterable
export async function streamChatReply({
  prompt,
  stoppedTurns,
  previousInteractionId,
  signal,
}: ChatReplyParams): Promise<AsyncIterable<ChatStreamEvent>> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const stream = await ai.interactions.create(
    {
      model: CHAT_MODEL,
      input: buildChatInput(prompt, stoppedTurns),
      previous_interaction_id: previousInteractionId,
      // interaction-scoped: must be resent every turn
      system_instruction: buildSystemInstruction(),
      generation_config: { thinking_level: "minimal" },
      stream: true,
    },
    { signal },
  );

  return toChatEvents(stream);
}

// convert Gemini events to our own protocol
async function* toChatEvents(
  stream: AsyncIterable<Interactions.InteractionSSEEvent>,
): AsyncGenerator<ChatStreamEvent> {
  for await (const event of stream) {
    switch (event.event_type) {
      case "interaction.created":
        yield { type: "start", interactionId: event.interaction.id };
        break;
      case "step.delta":
        // skip thought and other non-text deltas
        if (event.delta.type === "text") {
          yield { type: "delta", text: event.delta.text };
        }
        break;
      case "interaction.completed":
        yield event.interaction.status === "completed"
          ? { type: "done", interactionId: event.interaction.id }
          : { type: "error" };
        break;
      case "error":
        console.error("Gemini stream error event:", event);
        yield { type: "error" };
        break;
    }
  }
}
