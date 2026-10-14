import { z } from "zod/v4";
import { TmdbError } from "@/infra/tmdb/server";
import { discoverTitles } from "./discoverTitles";
import { getPersonCredits } from "./getPersonCredits";
import { getRecommendations } from "./getRecommendations";
import { getSimilar } from "./getSimilar";
import { getTitleDetails } from "./getTitleDetails";
import { getTrending } from "./getTrending";
import { searchPerson } from "./searchPerson";
import { searchTitles } from "./searchTitles";
import {
  SHOW_RECOMMENDATIONS,
  showRecommendations,
} from "./showRecommendations";
import { SAVE_TO_LIST, saveToList } from "./saveToList";
import {
  DisplayOutput,
  ToolError,
  type ChatTool,
  type ToolCall,
  type ToolContext,
  type ToolResult,
} from "./types";

export const CHAT_TOOLS: ChatTool[] = [
  searchTitles,
  searchPerson,
  discoverTitles,
  getTrending,
  getRecommendations,
  getSimilar,
  getPersonCredits,
  getTitleDetails,
  showRecommendations,
  saveToList,
];

// enough for a round of parallel lookups
export const MAX_CALLS_PER_ROUND = 10;
const TOOL_TIMEOUT_MS = 8000;
const MAX_ISSUES = 5;
// the model called a tool that doesn't exist
const FALLBACK_STATUS = "Checking TMDB database...";

const findTool = (name: string) =>
  CHAT_TOOLS.find((tool) => tool.name === name);

// JSON Schema of the tool's args, as the model sees them
export function toolParameters(tool: ChatTool): Record<string, unknown> {
  // input side: fields with a default stay optional
  const { $schema: _, ...schema } = z.toJSONSchema(tool.args, { io: "input" });
  return schema;
}

// progress text of a call, e.g. "Searching TMDB database..."
export function statusFor(name: string): string {
  return findTool(name)?.status ?? FALLBACK_STATUS;
}

// runs a round's calls in parallel, results in call order; never throws
// except when the signal aborts
export async function runToolCalls(
  calls: ToolCall[],
  ctx: ToolContext,
): Promise<ToolResult[]> {
  const { signal } = ctx;
  // one list of cards per round: each item is a TMDB request, so more calls
  // could flood TMDB
  const firstShow = calls.findIndex(
    (call) => call.name === SHOW_RECOMMENDATIONS,
  );
  const repeatedSaves = repeatedSaveIndexes(calls);
  const settled = await Promise.allSettled(
    calls.map((call, i) => {
      if (i >= MAX_CALLS_PER_ROUND) {
        return rejected(
          call,
          `Too many calls in one round (max ${MAX_CALLS_PER_ROUND})`,
        );
      }
      if (call.name === SHOW_RECOMMENDATIONS && i !== firstShow) {
        return rejected(
          call,
          `Call ${SHOW_RECOMMENDATIONS} once per answer, with every title`,
        );
      }
      if (repeatedSaves.has(i)) {
        return rejected(
          call,
          `This title is already saved by another ${SAVE_TO_LIST} call in this round: one call per title`,
        );
      }
      return runToolCall(call, ctx);
    }),
  );
  // stopped turn: no results, the loop ends here
  if (signal.aborted) {
    throw signal.reason;
  }
  return settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // runToolCall only rejects on abort, handled above: a guard in case that
    // changes
    console.error(`Tool ${calls[i].name} failed:`, outcome.reason);
    return errorResult(calls[i], "Tool failed");
  });
}

// the save_to_list calls of a title that an earlier call of the round saves
// too: the calls run in parallel, so each would read the row before the other
// writes it, and both rows in the chat would offer an Undo of the same state
function repeatedSaveIndexes(calls: ToolCall[]): Set<number> {
  const titles = new Set<string>();
  const repeated = new Set<number>();
  calls.forEach((call, i) => {
    if (call.name !== SAVE_TO_LIST) {
      return;
    }
    // invalid args: the call is rejected when it runs
    const args = parseArgs(saveToList, call.rawArgs);
    if (!args.ok) {
      return;
    }
    const title = `${args.value.type}-${args.value.id}`;
    if (titles.has(title)) {
      repeated.add(i);
    }
    titles.add(title);
  });
  return repeated;
}

async function runToolCall(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  const { signal } = ctx;
  const tool = findTool(call.name);
  if (!tool) {
    return rejected(call, `Unknown tool: ${call.name}`);
  }
  const args = parseArgs(tool, call.rawArgs);
  if (!args.ok) {
    return rejected(call, args.error);
  }

  const timeout = withTimeout(signal, TOOL_TIMEOUT_MS);
  try {
    const value = await tool.run(args.value, {
      ...ctx,
      signal: timeout.signal,
    });
    return value instanceof DisplayOutput
      ? {
          callId: call.id,
          name: call.name,
          output: value.output,
          events: value.events,
          isError: false,
        }
      : { callId: call.id, name: call.name, output: value, isError: false };
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    if (error instanceof ToolError) {
      return rejected(call, error.message);
    }
    console.error(`Tool ${call.name} failed:`, error);
    return errorResult(call, errorMessage(error, timeout.signal));
  } finally {
    timeout.clear();
  }
}

type ParsedArgs<Args> =
  | { ok: true; value: Args }
  | { ok: false; error: string };

function parseArgs<Args>(
  tool: ChatTool<Args>,
  rawArgs: string | object,
): ParsedArgs<Args> {
  let json: unknown = rawArgs;
  if (typeof rawArgs === "string") {
    try {
      json = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, error: "Arguments are not valid JSON" };
    }
  }
  // z.object drops unknown keys: a model repeating an old arg (e.g. the
  // former discover_titles `year`) would get an unfiltered list. Strict only
  // here, so the schema the model sees stays the same; strict() doesn't
  // change what the args parse to
  const schema = (
    tool.args instanceof z.ZodObject ? tool.args.strict() : tool.args
  ) as z.ZodType<Args>;
  const parsed = schema.safeParse(json);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  // e.g. "year: Invalid input: expected int, received number"
  const issues = parsed.error.issues
    .slice(0, MAX_ISSUES)
    .map((issue) =>
      issue.path.length
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    );
  return { ok: false, error: `Invalid arguments: ${issues.join("; ")}` };
}

// short, model-safe text: no stack traces, URLs or tokens
function errorMessage(error: unknown, timeoutSignal: AbortSignal) {
  if (timeoutSignal.aborted) {
    return "TMDB request timed out";
  }
  if (error instanceof TmdbError) {
    return `TMDB request failed (status ${error.status})`;
  }
  return "Tool failed";
}

const errorResult = (call: ToolCall, message: string): ToolResult => ({
  callId: call.id,
  name: call.name,
  output: message,
  isError: true,
});

// the model's mistake (bad name, args, too many calls, a ToolError), not a
// server error
function rejected(call: ToolCall, message: string): Promise<ToolResult> {
  console.warn(`Tool call ${call.name} rejected: ${message}`);
  return Promise.resolve(errorResult(call, message));
}

// AbortSignal.any isn't in the edge runtime, so the signals are linked by hand
function withTimeout(signal: AbortSignal, ms: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) {
    abort();
  } else {
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(
    () => controller.abort(new DOMException("Tool timed out", "TimeoutError")),
    ms,
  );
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    },
  };
}
