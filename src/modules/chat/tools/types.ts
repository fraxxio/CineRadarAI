// tools the model can call during a chat turn; our own types, no Gemini types
import type { ZodType } from "zod/v4";

export type ToolContext = {
  // aborted when the turn is stopped or the call times out
  signal: AbortSignal;
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
  // short JSON for the model
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
};

// thrown by a handler: the message goes to the model as is
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}
