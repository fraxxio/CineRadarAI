import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/infra/auth/auth";
import {
  MAX_LIST_CHANGES,
  MAX_PROMPT_LENGTH,
  MAX_STOPPED_TEXT_LENGTH,
  MAX_STOPPED_TURNS,
  type ChatStreamEvent,
} from "@/modules/chat";
import {
  isInteractionGone,
  streamChatReply,
  type ChatUser,
} from "@/modules/chat/server";

export const runtime = "edge";

const promptSchema = z
  .string()
  .max(MAX_PROMPT_LENGTH)
  .refine((prompt) => prompt.trim().length > 0);

const chatRequestSchema = z.object({
  content: promptSchema,
  previousInteractionId: z.string().nullish(),
  stoppedTurns: z
    .array(
      z.object({
        prompt: promptSchema,
        // empty when stopped before any text arrived
        partialText: z.string().max(MAX_STOPPED_TEXT_LENGTH),
      }),
    )
    .max(MAX_STOPPED_TURNS)
    .optional(),
  // keys only: the note the model gets is read from the DB
  listChanges: z
    .array(
      z.object({
        movieId: z.number().int().positive(),
        type: z.enum(["movie", "tv"]),
      }),
    )
    .max(MAX_LIST_CHANGES)
    .optional(),
});

// the only source of the user the tools act for; the chat works without it
async function chatUser(): Promise<ChatUser> {
  try {
    const id = (await auth())?.user?.id;
    return id ? { status: "signed_in", id } : { status: "signed_out" };
  } catch (error) {
    console.error("Couldn't read the session for the chat:", error);
    return { status: "unavailable" };
  }
}

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
  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const {
    content,
    previousInteractionId,
    stoppedTurns = [],
    listChanges = [],
  } = parsed.data;
  const user = await chatUser();

  // stops the Gemini request when the client leaves: cancel() below is the
  // reliable trigger, request.signal may not abort on every runtime
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  let events: AsyncIterable<ChatStreamEvent>;
  try {
    events = await streamChatReply({
      prompt: content,
      stoppedTurns,
      previousInteractionId: previousInteractionId ?? undefined,
      signal: abort.signal,
      user,
      listChanges,
    });
  } catch (error) {
    // the client is already gone, nobody reads this response
    if (abort.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    // a saved chat can outlive its interaction: the client starts fresh
    if (
      previousInteractionId &&
      (await isInteractionGone(previousInteractionId, abort.signal))
    ) {
      console.info("Previous interaction is gone, the conversation expired");
      return NextResponse.json(
        { error: "conversation_expired" },
        { status: 409 },
      );
    }
    if (abort.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    // e.g. a malformed previous_interaction_id, invalid key, quota
    console.error("Gemini interaction error:", error);
    return NextResponse.json(
      { error: "Failed to start chat" },
      { status: 502 },
    );
  }

  // encode events as NDJSON
  const encoder = new TextEncoder();
  // after a cancel, enqueue() and close() throw
  let closed = false;
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (!closed) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      };
      try {
        for await (const event of events) {
          send(event);
        }
      } catch (error) {
        // an abort makes the Gemini stream throw, that's not an error
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
      console.info("Chat stream cancelled by the client");
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
