import type { Interactions } from "@google/genai";
import type { ChatStreamEvent } from "../protocol";
import { statusFor } from "../tools/registry";
import type { ToolCall } from "../tools/types";

type RoundOptions = {
  // only the first round's id goes to the client, the rest stay on the server
  firstRound: boolean;
};

export type RoundOutcome = {
  // "" if the stream ended before the interaction was created
  interactionId: string;
  // "requires_action" when the model wants the calls run; "error" after an
  // error event; "" if the stream ended without interaction.completed
  status: string;
  calls: ToolCall[];
};

type PendingCall = {
  id: string;
  name: string;
  arguments: object | undefined;
  // joined arguments_delta strings
  argumentsText: string;
};

// converts one round's Gemini events to our protocol and collects its calls
export async function* readRound(
  stream: AsyncIterable<Interactions.InteractionSSEEvent>,
  { firstRound }: RoundOptions,
): AsyncGenerator<ChatStreamEvent, RoundOutcome> {
  // by step index: argument deltas name the step by index only
  const calls = new Map<number, PendingCall>();
  let interactionId = "";
  let status = "";
  let failed = false;

  for await (const event of stream) {
    switch (event.event_type) {
      case "interaction.created":
        interactionId = event.interaction.id;
        if (firstRound) {
          yield { type: "start", interactionId };
        }
        break;
      case "step.start":
        if (event.step.type === "function_call") {
          yield {
            type: "tool_start",
            id: event.step.id,
            name: event.step.name,
            text: statusFor(event.step.name),
          };
          calls.set(event.index, {
            id: event.step.id,
            name: event.step.name,
            arguments: event.step.arguments,
            argumentsText: "",
          });
        }
        break;
      case "step.delta":
        if (event.delta.type === "text") {
          yield { type: "delta", text: event.delta.text };
        } else if (event.delta.type === "arguments_delta") {
          const call = calls.get(event.index);
          if (call) {
            call.argumentsText += event.delta.arguments ?? "";
          }
        }
        // thought and other deltas are skipped
        break;
      case "interaction.completed":
        interactionId = event.interaction.id;
        status = event.interaction.status;
        break;
      case "error":
        console.error("Gemini stream error event:", event);
        failed = true;
        break;
    }
  }

  return {
    interactionId,
    status: failed ? "error" : status,
    // step.start carries `arguments: {}`, the real ones arrive as deltas
    calls: Array.from(calls.values(), (call) => ({
      id: call.id,
      name: call.name,
      rawArgs: call.argumentsText || call.arguments || {},
    })),
  };
}
