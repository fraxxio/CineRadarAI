import { describe, expect, test } from "vitest";
import { CHAT_TOOLS, toolParameters } from "../tools/registry";
import { toFunctionResults, toGeminiTools } from "./geminiTools";

describe("toGeminiTools", () => {
  test("one function declaration per tool", () => {
    expect(toGeminiTools(CHAT_TOOLS)).toEqual(
      CHAT_TOOLS.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: toolParameters(tool),
      })),
    );
  });
});

describe("toFunctionResults", () => {
  test("one result per call; is_error only on errors", () => {
    expect(
      toFunctionResults([
        {
          callId: "c1",
          name: "search_titles",
          output: { results: [] },
          isError: false,
        },
        {
          callId: "c2",
          name: "get_weather",
          output: "Unknown tool: get_weather",
          isError: true,
        },
      ]),
    ).toEqual([
      {
        type: "function_result",
        call_id: "c1",
        name: "search_titles",
        result: { results: [] },
      },
      {
        type: "function_result",
        call_id: "c2",
        name: "get_weather",
        result: "Unknown tool: get_weather",
        is_error: true,
      },
    ]);
  });
});
