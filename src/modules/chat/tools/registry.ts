import { z } from "zod/v4";
import { TmdbError } from "@/infra/tmdb/server";
import { discoverTitles } from "./discoverTitles";
import { getTitleDetails } from "./getTitleDetails";
import { searchTitles } from "./searchTitles";
import {
  ToolError,
  type ChatTool,
  type ToolCall,
  type ToolResult,
} from "./types";

export const CHAT_TOOLS: ChatTool[] = [
  searchTitles,
  discoverTitles,
  getTitleDetails,
];

// 10 recommendations max, one call each
export const MAX_CALLS_PER_ROUND = 10;
const TOOL_TIMEOUT_MS = 8000;
const MAX_ISSUES = 5;
const MIXED_STATUS = "Checking TMDB database...";

const findTool = (name: string) =>
  CHAT_TOOLS.find((tool) => tool.name === name);

// JSON Schema of the tool's args, as the model sees them
export function toolParameters(tool: ChatTool): Record<string, unknown> {
  // input side: fields with a default stay optional
  const { $schema: _, ...schema } = z.toJSONSchema(tool.args, { io: "input" });
  return schema;
}

// progress text for a round: the tool's own when it's the only one used
export function statusFor(names: string[]): string {
  const tool = new Set(names).size === 1 ? findTool(names[0]) : undefined;
  return tool?.status ?? MIXED_STATUS;
}

// runs a round's calls in parallel, results in call order; never throws
// except when the signal aborts
export async function runToolCalls(
  calls: ToolCall[],
  signal: AbortSignal,
): Promise<ToolResult[]> {
  const settled = await Promise.allSettled(
    calls.map((call, i) =>
      i < MAX_CALLS_PER_ROUND
        ? runToolCall(call, signal)
        : rejected(
            call,
            `Too many calls in one round (max ${MAX_CALLS_PER_ROUND})`,
          ),
    ),
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

async function runToolCall(
  call: ToolCall,
  signal: AbortSignal,
): Promise<ToolResult> {
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
    const output = await tool.run(args.value, { signal: timeout.signal });
    return { callId: call.id, name: call.name, output, isError: false };
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

type ParsedArgs = { ok: true; value: unknown } | { ok: false; error: string };

function parseArgs(tool: ChatTool, rawArgs: string | object): ParsedArgs {
  let json: unknown = rawArgs;
  if (typeof rawArgs === "string") {
    try {
      json = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, error: "Arguments are not valid JSON" };
    }
  }
  const parsed = tool.args.safeParse(json);
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
