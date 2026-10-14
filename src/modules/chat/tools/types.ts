// tools the model can call during a chat turn; our own types, no Gemini types
import type { ZodType } from "zod/v4";
import type { StoredEntry } from "@/modules/my-list";
import type { ChatStreamEvent } from "../protocol";

// who the chat is for, read from the session by the route; never from the
// model's args
export type ChatUser =
  | { status: "signed_in"; id: string }
  | { status: "signed_out" }
  // the session couldn't be read (e.g. DB down)
  | { status: "unavailable" };

export type ToolContext = {
  // aborted when the turn is stopped or the call times out
  signal: AbortSignal;
  user: ChatUser;
  // the user's list, shared by the turn's calls (see userList.ts)
  list(): Promise<StoredEntry[] | null>;
};

export type ChatTool<Args = unknown> = {
  // e.g. "search_titles"
  name: string;
  // shown to the model
  description: string;
  // progress text, e.g. "Searching TMDB database..."
  status: string;
  // validated before the handler runs
  args: ZodType<Args>;
  // short JSON for the model, or a DisplayOutput
  run(args: Args, ctx: ToolContext): Promise<object>;
};

// keeps each handler typed by its own args schema
export const defineTool = <Args>(tool: ChatTool<Args>): ChatTool<Args> => tool;

export type ToolCall = {
  id: string;
  name: string;
  // JSON text as streamed, or already parsed
  rawArgs: string | object;
};

export type ToolResult = {
  callId: string;
  name: string;
  // the handler's JSON, or a short message when isError
  output: object | string;
  isError: boolean;
  // only for a successful DisplayOutput
  events?: ToolEvent[];
};

// what a tool shows in the chat, streamed after the round's tool_ends
export type ToolEvent = Extract<
  ChatStreamEvent,
  { type: "cards" | "list_saved" | "sign_in_required" }
>;

// thrown by a handler: the message goes to the model as is
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

// returned by a tool that shows something: the model gets `output`, the chat
// gets `events`
export class DisplayOutput {
  constructor(
    readonly output: object,
    readonly events: ToolEvent[],
  ) {}
}
