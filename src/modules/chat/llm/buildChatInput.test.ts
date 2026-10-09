import { describe, expect, test } from "vitest";
import { buildChatInput } from "./llmService";

const user = (text: string) => ({
  type: "user_input",
  content: [{ type: "text", text }],
});
const model = (text: string) => ({
  type: "model_output",
  content: [{ type: "text", text }],
});

describe("buildChatInput", () => {
  test("no stopped turns: the plain prompt", () => {
    expect(buildChatInput("p2", [])).toBe("p2");
  });

  test("one stopped turn: its prompt and partial answer, then the prompt", () => {
    expect(buildChatInput("p2", [{ prompt: "p1", partialText: "A" }])).toEqual([
      user("p1"),
      model("A"),
      user("p2"),
    ]);
  });

  test("an empty partial answer adds no model_output step", () => {
    expect(buildChatInput("p2", [{ prompt: "p1", partialText: "" }])).toEqual([
      user("p1"),
      user("p2"),
    ]);
  });

  test("two stopped turns: in order, the new prompt last", () => {
    expect(
      buildChatInput("p3", [
        { prompt: "p1", partialText: "A" },
        { prompt: "p2", partialText: "B" },
      ]),
    ).toEqual([user("p1"), model("A"), user("p2"), model("B"), user("p3")]);
  });
});
