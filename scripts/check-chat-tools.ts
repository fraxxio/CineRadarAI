// Live check that Gemini accepts the chat's tool schemas.
//
// What: sends two real requests to Gemini with the exact tool schemas, model
// and system prompt the AI chat uses, and reports whether Gemini accepts
// them. The first uses tool_choice "auto", the second
// FINAL_ROUND_TOOL_CHOICE (allowed_tools), which the chat sends with the
// last tool round's results. Both are the chat's own baseRequest()
// (llm/llmService.ts), so they can't drift from what the chat sends.
//
// Why: the tool schemas go out with every chat request, also requests that
// never call a tool. Gemini supports only a subset of JSON Schema, and if it
// rejects any keyword in any schema, every chat message fails (400 from
// Gemini, 502 from the chat route), not just tool calls. The unit and route
// tests mock Gemini, and the allowlist test in
// src/modules/chat/tools/registry.test.ts only checks the documented subset:
// neither can prove Gemini accepts the schemas. Added in AI chat phase 2,
// when the tools first used array arguments (items, minItems, maxItems).
//
// When to run it:
// - before merging any change to a tool's args or description, or to
//   CHAT_TOOLS
// - after changing the tool choices (FINAL_ROUND_TOOL_CHOICE, the round
//   loop)
// - after changing GEMINI_MODEL / CHAT_MODEL or the thinking level
// - after upgrading @google/genai or zod (zod generates the schemas)
// - when every chat message suddenly fails
//
// Cost: two small Gemini requests with the real GEMINI_API_KEY (read from
// .env / .env.local). No tool is run, so no TMDB calls. It doesn't check
// answer quality.
//
// How to run:
//   npm run check:chat-tools              sends the request
//   npm run check:chat-tools -- --dry-run loads everything, sends nothing
//
// If it fails: the error names the rejected field. Simplify that zod type (or
// hand-write that tool's schema), and keep ALLOWED_SCHEMA_KEYWORDS in
// registry.test.ts in line with what Gemini accepts.
import { GoogleGenAI, type Interactions } from "@google/genai";
import { CHAT_MODEL, CHAT_THINKING_LEVEL } from "@/modules/chat/chatConfig";
import {
  FINAL_ROUND_TOOL_CHOICE,
  baseRequest,
} from "@/modules/chat/llm/llmService";
import { CHAT_TOOLS } from "@/modules/chat/tools/registry";

const dryRun = process.argv.includes("--dry-run");
const names = CHAT_TOOLS.map((tool) => tool.name).join(", ");

async function main(): Promise<number> {
  console.log(`Model: ${CHAT_MODEL}, thinking level: ${CHAT_THINKING_LEVEL}`);
  console.log(`Tools (${CHAT_TOOLS.length}): ${names}`);
  // the prompts differ in one line, the schemas not at all
  const request = baseRequest({ userStatus: "signed_out" });

  if (dryRun) {
    console.log("Dry run: no request sent");
    return 0;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set (in the env, .env or .env.local)");
    return 1;
  }

  const ai = new GoogleGenAI({ apiKey });
  const checks: [string, Interactions.ToolChoiceConfig | "auto"][] = [
    // "none" might skip the tools; a tool call is fine, it isn't run
    ["auto", "auto"],
    ["final round", FINAL_ROUND_TOOL_CHOICE],
  ];
  for (const [label, toolChoice] of checks) {
    let outcome: string;
    try {
      const interaction = await ai.interactions.create({
        ...request,
        input: "Reply with the single word OK.",
        generation_config: {
          ...request.generation_config,
          tool_choice: toolChoice,
        },
      });
      if (
        interaction.status !== "completed" &&
        interaction.status !== "requires_action"
      ) {
        console.error(
          `FAIL (${label}): interaction ended with status "${interaction.status}"`,
        );
        return 1;
      }
      outcome = interaction.status;
    } catch (error) {
      // Gemini's message names the rejected field; the key is redacted in
      // case a client error echoes the request
      const { status, statusCode, message } = error as {
        status?: number;
        statusCode?: number;
        message?: string;
      };
      console.error(
        `FAIL (${label}): HTTP status ${statusCode ?? status ?? "unknown"}`,
      );
      console.error(
        (message ?? String(error)).replaceAll(apiKey, "[redacted]"),
      );
      return 1;
    }
    // "completed": answered in text, "requires_action": called a tool
    console.log(`Request with tool_choice ${label}: accepted (${outcome})`);
  }

  console.log(
    `OK: ${CHAT_MODEL} accepted ${CHAT_TOOLS.length} tool schemas (${names})`,
  );
  return 0;
}

main().then((code) => process.exit(code));
