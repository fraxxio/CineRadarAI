import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { CHAT_MODEL, buildSystemInstruction } from "@/lib/chatConfig";
import { MAX_PROMPT_LENGTH } from "@/lib/chatLimits";

export const runtime = "edge";

// post a new message and stream Gemini response
export async function POST(request: NextRequest) {
  if (process.env.AI_CHAT_ENABLED !== "true") {
    return NextResponse.json({ error: "AI chat is disabled" }, { status: 503 });
  }

  // parse message from post
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { previousInteractionId, content } = payload ?? {};

  if (
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.length > MAX_PROMPT_LENGTH
  ) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  if (
    previousInteractionId != null &&
    typeof previousInteractionId !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid interaction id" },
      { status: 400 },
    );
  }

  // create Gemini client
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  let stream;
  try {
    stream = await ai.interactions.create({
      model: CHAT_MODEL,
      input: content,
      previous_interaction_id: previousInteractionId ?? undefined,
      // interaction-scoped: must be resent every turn
      system_instruction: buildSystemInstruction(),
      generation_config: { thinking_level: "minimal" },
      stream: true,
    });
  } catch (error) {
    // e.g. expired/unknown previous_interaction_id, invalid key, quota
    console.error("Gemini interaction error:", error);
    return NextResponse.json({ error: "Failed to start chat" }, { status: 502 });
  }

  // convert Gemini events to our own NDJSON protocol
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of stream) {
          switch (event.event_type) {
            case "interaction.created":
              send({ type: "start", interactionId: event.interaction.id });
              break;
            case "step.delta":
              // skip thought and other non-text deltas
              if (event.delta.type === "text") {
                send({ type: "delta", text: event.delta.text });
              }
              break;
            case "interaction.completed":
              send(
                event.interaction.status === "completed"
                  ? { type: "done", interactionId: event.interaction.id }
                  : { type: "error" },
              );
              break;
            case "error":
              console.error("Gemini stream error event:", event);
              send({ type: "error" });
              break;
          }
        }
      } catch (error) {
        console.error("Gemini stream error:", error);
        send({ type: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
