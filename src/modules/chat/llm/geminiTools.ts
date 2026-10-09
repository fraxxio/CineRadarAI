// our tool types <-> Gemini's
import type { Interactions } from "@google/genai";
import { toolParameters } from "../tools/registry";
import type { ChatTool, ToolResult } from "../tools/types";

export const toGeminiTools = (tools: ChatTool[]): Interactions.Tool[] =>
  tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: toolParameters(tool),
  }));

// the API needs exactly one result per call, with its call_id and name
export const toFunctionResults = (
  results: ToolResult[],
): Interactions.FunctionResultStep[] =>
  results.map((result) => ({
    type: "function_result",
    call_id: result.callId,
    name: result.name,
    result: result.output,
    ...(result.isError && { is_error: true }),
  }));
