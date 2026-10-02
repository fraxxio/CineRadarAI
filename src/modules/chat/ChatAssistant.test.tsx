import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import ChatAssistant from "./ChatAssistant";
import {
  MAX_PROMPT_LENGTH,
  MAX_STOPPED_TEXT_LENGTH,
  MAX_STOPPED_TURNS,
} from "./chatLimits";
import type { StoppedTurn } from "./protocol";
import { controlledStream, ndjson, streamResponse } from "./testing/stream";

const GREETING = "Hi! What would you like to watch?";
const ERROR_TEXT = "Unfortunately an error occurred. Try again later.";
const CAPTCHA_FAILED = "Recaptcha failed to verify!";

const start = (interactionId: string) => ({ type: "start", interactionId });
const delta = (text: string) => ({ type: "delta", text });
const done = (interactionId: string) => ({ type: "done", interactionId });
// one complete, successful turn
const answer = (id: string, text: string) =>
  streamResponse([ndjson(start(id), delta(text), done(id))]);

// queues replies per URL and records every request body
function routeFetch(routes: Record<string, Response[]>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      const reply = routes[url]?.shift();
      if (!reply) throw new Error(`unexpected fetch: ${url}`);
      return reply;
    });
  const bodies = (url: string) =>
    calls.filter((c) => c.url === url).map((c) => c.body);
  return { spy, calls, bodies };
}

function mockRecaptcha(
  executeRecaptcha?: (action?: string) => Promise<string>,
) {
  vi.mocked(useGoogleReCaptcha).mockReturnValue({ executeRecaptcha });
}

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});
afterEach(() => {
  vi.mocked(useGoogleReCaptcha).mockReset(); // back to executeRecaptcha: undefined
  vi.useRealTimers();
});

const renderChat = ({ recaptchaEnabled = false } = {}) =>
  render(
    <ChatAssistant greeting={GREETING} recaptchaEnabled={recaptchaEnabled} />,
  );
const input = () => screen.getByPlaceholderText(/Suggest me movies/);
const submitBtn = () => screen.getByRole("button", { name: /submit|stop/i });
const newChatBtn = () => screen.getByRole("button", { name: "New chat" });

async function send(text: string) {
  await user.type(input(), text);
  await user.click(submitBtn());
}
// the turn has ended, successfully or not
const settled = () => waitFor(() => expect(input()).toBeEnabled());

describe("ChatAssistant", () => {
  test("shows the greeting", () => {
    renderChat();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
  });

  test("submit is disabled while the input is empty; prompt length is capped", async () => {
    renderChat();
    expect(submitBtn()).toBeDisabled();
    expect(input()).toHaveAttribute("maxlength", String(MAX_PROMPT_LENGTH));

    await user.type(input(), "x");
    expect(submitBtn()).toBeEnabled();
  });

  test("on submit: shows the prompt, clears and disables the input, shows the loader", async () => {
    const stream = controlledStream();
    routeFetch({ "/api/assistant": [stream.response] });
    renderChat();

    await send("war films");

    expect(screen.getByText("war films")).toBeInTheDocument();
    expect(input()).toHaveValue("");
    expect(input()).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(submitBtn()).toHaveTextContent("Stop");
  });

  test("renders deltas as they arrive", async () => {
    const stream = controlledStream();
    routeFetch({ "/api/assistant": [stream.response] });
    renderChat();
    await send("hi");

    stream.push(ndjson(start("i1"), delta("Hel")));
    expect(await screen.findByText("Hel")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();

    stream.push(ndjson(delta("lo")));
    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(input()).toBeDisabled();

    stream.push(ndjson(done("i1")));
    stream.close();
    await settled();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it.each([
    [
      "events split across chunks",
      [
        '{"type":"start","interactionId":"i1"}\n{"type":"del',
        'ta","text":"Hi"}\n',
        ndjson(done("i1")),
      ],
      "Hi",
    ],
    [
      "many events in one chunk",
      [ndjson(start("i1"), delta("A"), delta("B"), done("i1"))],
      "AB",
    ],
    [
      "a last line without a newline",
      [ndjson(start("i1"), delta("X")), JSON.stringify(done("i1"))],
      "X",
    ],
    [
      "blank lines",
      ["\n\n", ndjson(start("i1"), delta("Y")), "\n", ndjson(done("i1"))],
      "Y",
    ],
  ])("parses %s", async (_, chunks, expected) => {
    routeFetch({ "/api/assistant": [streamResponse(chunks)] });
    renderChat();

    await send("hi");
    await settled();

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  test("done turns the stream into a permanent message", async () => {
    routeFetch({ "/api/assistant": [answer("i1", "Watch Fury.")] });
    renderChat();

    await send("war films");
    await settled();

    expect(screen.getByText("war films")).toBeInTheDocument();
    expect(screen.getByText("Watch Fury.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(submitBtn()).toHaveTextContent("Submit");
  });

  test("sends the previous interaction id on the next turn", async () => {
    const { bodies } = routeFetch({
      "/api/assistant": [answer("i1", "a1"), answer("i2", "a2")],
    });
    renderChat();

    await send("p1");
    await settled();
    await send("p2");
    await settled();

    const [first, second] = bodies("/api/assistant");
    expect(first).toEqual({ content: "p1" }); // no previousInteractionId key
    expect(second).toEqual({ content: "p2", previousInteractionId: "i1" });
  });

  test("keeps only the last 10 messages", async () => {
    routeFetch({
      "/api/assistant": [1, 2, 3, 4, 5, 6].map((i) => answer(`i${i}`, `a${i}`)),
    });
    renderChat();

    for (let i = 1; i <= 6; i++) {
      await send(`p${i}`);
      await settled();
    }

    expect(screen.queryByText("p1")).toBeNull();
    expect(screen.queryByText("a1")).toBeNull();
    expect(screen.getByText("p2")).toBeInTheDocument();
    expect(screen.getByText("a6")).toBeInTheDocument();
    expect(screen.getByText(GREETING)).toBeInTheDocument();
  });

  describe("stop", () => {
    const stopBtn = () => screen.getByRole("button", { name: "Stop" });

    test("mid-stream: keeps the partial answer marked as stopped", async () => {
      const stream = controlledStream();
      const { calls } = routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(ndjson(start("i1"), delta("Watch Fu")));
      await screen.findByText("Watch Fu");

      await user.click(stopBtn());

      expect(screen.getByText("Watch Fu")).toBeInTheDocument();
      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(input()).toBeEnabled();
      expect(submitBtn()).toHaveTextContent("Submit");
      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
      expect(calls).toHaveLength(1); // Stop didn't submit the form again
    });

    test("while the loader shows: stops without an error", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      expect(screen.getByRole("status")).toBeInTheDocument();

      await user.click(stopBtn());

      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByText("war films")).toBeInTheDocument();
      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    });

    test("aborts the request", async () => {
      const stream = controlledStream();
      const { spy } = routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("hi");

      await user.click(stopBtn());

      expect(spy.mock.calls[0][1]?.signal?.aborted).toBe(true);
    });

    test("cancels the response stream", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("hi");
      stream.push(ndjson(start("i1"), delta("part")));
      await screen.findByText("part");

      await user.click(stopBtn());

      // the reader cancelled the stream, so no late events can arrive
      expect(() => stream.push(ndjson(delta(" more")))).toThrow();
      expect(screen.getByText("part")).toBeInTheDocument();
    });

    test("the next turn shares the stopped turn and continues from the last completed one", async () => {
      const stopped = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          answer("i1", "a1"),
          stopped.response,
          answer("i3", "a3"),
          answer("i4", "a4"),
        ],
      });
      renderChat();
      await send("p1");
      await settled();
      await send("p2");
      stopped.push(ndjson(start("i2"), delta("partial")));
      await screen.findByText("partial");
      await user.click(stopBtn());

      await send("p3");
      await settled();
      await send("p4");
      await settled();

      const [, , third, fourth] = bodies("/api/assistant");
      expect(third).toEqual({
        content: "p3",
        previousInteractionId: "i1",
        stoppedTurns: [{ prompt: "p2", partialText: "partial" }],
      });
      // the model has seen it now
      expect(fourth).toEqual({ content: "p4", previousInteractionId: "i3" });
    });

    test("two stops in a row: the next turn shares both, oldest first", async () => {
      const stopped2 = controlledStream();
      const stopped3 = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          answer("i1", "a1"),
          stopped2.response,
          stopped3.response,
          answer("i4", "a4"),
          answer("i5", "a5"),
        ],
      });
      renderChat();
      await send("p1");
      await settled();
      await send("p2");
      stopped2.push(ndjson(start("i2"), delta("A")));
      await screen.findByText("A");
      await user.click(stopBtn());
      await send("p3");
      stopped3.push(ndjson(start("i3"), delta("B")));
      await screen.findByText("B");
      await user.click(stopBtn());

      await send("p4");
      await settled();
      await send("p5");
      await settled();

      const [, second, third, fourth, fifth] = bodies("/api/assistant");
      expect(second.stoppedTurns).toBeUndefined();
      // the stopped interaction i2 isn't continued
      expect(third).toEqual({
        content: "p3",
        previousInteractionId: "i1",
        stoppedTurns: [{ prompt: "p2", partialText: "A" }],
      });
      expect(fourth).toEqual({
        content: "p4",
        previousInteractionId: "i1",
        stoppedTurns: [
          { prompt: "p2", partialText: "A" },
          { prompt: "p3", partialText: "B" },
        ],
      });
      expect(fifth).toEqual({ content: "p5", previousInteractionId: "i4" });
    });

    test(`shares at most the last ${MAX_STOPPED_TURNS} stopped turns`, async () => {
      const count = MAX_STOPPED_TURNS + 1;
      const streams = Array.from({ length: count }, () => controlledStream());
      const { bodies } = routeFetch({
        "/api/assistant": [
          ...streams.map((s) => s.response),
          answer("i1", "a1"),
        ],
      });
      renderChat();
      for (let i = 1; i <= count; i++) {
        await send(`p${i}`);
        await user.click(stopBtn());
      }

      await send("last");
      await settled();

      const { stoppedTurns } = bodies("/api/assistant")[count] as {
        stoppedTurns: StoppedTurn[];
      };
      expect(stoppedTurns.map((t) => t.prompt)).toEqual(
        Array.from({ length: MAX_STOPPED_TURNS }, (_, i) => `p${i + 2}`),
      );
    });

    test("a failed turn drops the stopped turns", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const stopped = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          stopped.response,
          new Response("", { status: 400 }),
          answer("i3", "a3"),
        ],
      });
      renderChat();
      await send("p1");
      await user.click(stopBtn());
      await send("p2");
      await screen.findByText(ERROR_TEXT);
      await settled();

      await send("p3");
      await settled();

      expect(bodies("/api/assistant")[1].stoppedTurns).toHaveLength(1);
      expect(bodies("/api/assistant")[2]).toEqual({ content: "p3" });
    });

    test("a stop before any text shares an empty partial answer", async () => {
      const stopped = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [stopped.response, answer("i2", "a2")],
      });
      renderChat();
      await send("p1");
      await user.click(stopBtn());

      await send("p2");
      await settled();

      expect(bodies("/api/assistant")[1]).toEqual({
        content: "p2",
        stoppedTurns: [{ prompt: "p1", partialText: "" }],
      });
    });

    test("the shared partial answer is capped", async () => {
      const stopped = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [stopped.response, answer("i2", "a2")],
      });
      renderChat();
      await send("p1");
      stopped.push(ndjson(delta("x".repeat(MAX_STOPPED_TEXT_LENGTH + 5))));
      await screen.findByText(/^x+$/);
      await user.click(stopBtn());

      await send("p2");
      await settled();

      const { stoppedTurns } = bodies("/api/assistant")[1] as {
        stoppedTurns: StoppedTurn[];
      };
      expect(stoppedTurns[0].partialText).toHaveLength(MAX_STOPPED_TEXT_LENGTH);
    });

    test("during reCAPTCHA verification: nothing is sent and the prompt is kept", async () => {
      mockRecaptcha(async () => "tok");
      const verification = controlledStream();
      const { calls } = routeFetch({
        "/api/recaptcha": [verification.response],
      });
      renderChat({ recaptchaEnabled: true });
      await send("hi");
      await waitFor(() => expect(calls).toHaveLength(1));

      await user.click(stopBtn());

      expect(screen.queryByText("Stopped")).toBeNull();
      expect(input()).toHaveValue("hi");
      expect(calls.map((c) => c.url)).toEqual(["/api/recaptcha"]);
    });
  });

  describe("new chat", () => {
    test("is disabled while the chat is empty", async () => {
      routeFetch({ "/api/assistant": [answer("i1", "a1")] });
      renderChat();
      expect(newChatBtn()).toBeDisabled();

      await send("hi");
      await settled();

      expect(newChatBtn()).toBeEnabled();
    });

    test("clears the chat and starts a new conversation", async () => {
      const stopped = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          answer("i1", "a1"),
          stopped.response,
          answer("i3", "a3"),
        ],
      });
      renderChat();
      await send("p1");
      await settled();
      await send("p2");
      await user.click(screen.getByRole("button", { name: "Stop" }));

      await user.click(newChatBtn());

      expect(screen.queryByText("p1")).toBeNull();
      expect(screen.queryByText("a1")).toBeNull();
      expect(screen.queryByText("Stopped")).toBeNull();
      expect(screen.getByText(GREETING)).toBeInTheDocument();
      expect(newChatBtn()).toBeDisabled();

      await send("p3");
      await settled();
      // no interaction id, no stopped turn
      expect(bodies("/api/assistant")[2]).toEqual({ content: "p3" });
    });

    test("mid-stream: aborts and leaves nothing behind", async () => {
      const stream = controlledStream();
      const { spy } = routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("hi");
      stream.push(ndjson(start("i1"), delta("part")));
      await screen.findByText("part");

      await user.click(newChatBtn());

      expect(spy.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(screen.queryByText(/part/)).toBeNull();
      expect(screen.queryByText("hi")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(input()).toBeEnabled();
      expect(submitBtn()).toHaveTextContent("Submit");
    });

    test("clears the error message", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      routeFetch({ "/api/assistant": [new Response("", { status: 500 })] });
      renderChat();
      await send("hi");
      await screen.findByText(ERROR_TEXT);

      await user.click(newChatBtn());

      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    });
  });

  describe("errors", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each([
      ["a non-OK status", () => new Response("", { status: 500 })],
      ["a null body", () => new Response(null)],
      [
        // left open: the error event alone must end the turn
        "an error event",
        () => {
          const stream = controlledStream();
          stream.push(ndjson(start("i1"), { type: "error" }));
          return stream.response;
        },
      ],
      [
        "a stream without done",
        () => streamResponse([ndjson(start("i1"), delta("x"))]),
      ],
      ["a malformed line", () => streamResponse(["not json\n"])],
    ])("shows the error message on %s", async (_, reply) => {
      routeFetch({ "/api/assistant": [reply()] });
      renderChat();

      await send("hi");

      expect(await screen.findByText(ERROR_TEXT)).toBeInTheDocument();
      await settled();
      expect(screen.queryByRole("status")).toBeNull();
    });

    test("starts a new conversation after a failed turn", async () => {
      const { bodies } = routeFetch({
        "/api/assistant": [
          answer("i1", "a1"),
          new Response("", { status: 500 }),
          answer("i3", "a3"),
        ],
      });
      renderChat();

      for (const prompt of ["p1", "p2", "p3"]) {
        await send(prompt);
        await settled();
      }

      const [, second, third] = bodies("/api/assistant");
      expect(second.previousInteractionId).toBe("i1");
      expect(third).not.toHaveProperty("previousInteractionId");
    });

    test("the error message clears on the next successful turn", async () => {
      routeFetch({
        "/api/assistant": [
          new Response("", { status: 500 }),
          answer("i1", "a1"),
        ],
      });
      renderChat();

      await send("p1");
      await screen.findByText(ERROR_TEXT);
      await settled();
      await send("p2");
      await settled();

      expect(screen.getByText("a1")).toBeInTheDocument();
      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    });
  });

  describe("reCAPTCHA enabled", () => {
    test("verifies the token before calling the assistant", async () => {
      const executeRecaptcha = vi.fn(async () => "tok");
      mockRecaptcha(executeRecaptcha);
      const { calls, bodies } = routeFetch({
        "/api/recaptcha": [Response.json({ success: true, score: 0.9 })],
        "/api/assistant": [answer("i1", "a1")],
      });
      renderChat({ recaptchaEnabled: true });

      await send("hi");
      await settled();

      expect(executeRecaptcha).toHaveBeenCalledWith("AIchatSubmit");
      expect(calls.map((c) => c.url)).toEqual([
        "/api/recaptcha",
        "/api/assistant",
      ]);
      expect(bodies("/api/recaptcha")).toEqual([{ recaptchaToken: "tok" }]);
      expect(screen.getByText("a1")).toBeInTheDocument();
    });

    test("a failed verification shows a message for 3 s and skips the assistant", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockRecaptcha(async () => "tok");
      const { bodies } = routeFetch({
        "/api/recaptcha": [Response.json({ success: false })],
      });
      renderChat({ recaptchaEnabled: true });

      await send("hi");

      expect(await screen.findByText(CAPTCHA_FAILED)).toBeInTheDocument();
      await settled();
      expect(input()).toHaveValue("hi"); // the prompt is kept for a retry

      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText(CAPTCHA_FAILED)).toBeNull();
      expect(bodies("/api/assistant")).toEqual([]);
    });

    test("a failed verification request skips the assistant", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockRecaptcha(async () => "tok");
      const { calls } = routeFetch({
        "/api/recaptcha": [new Response("", { status: 500 })],
      });
      renderChat({ recaptchaEnabled: true });

      await send("hi");
      await settled();

      expect(calls.map((c) => c.url)).toEqual(["/api/recaptcha"]);
      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    });

    test("sends nothing while executeRecaptcha is not ready", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { spy } = routeFetch({});
      renderChat({ recaptchaEnabled: true });

      await send("hi");

      expect(spy).not.toHaveBeenCalled();
      expect(input()).toHaveValue("hi");
      expect(screen.queryByRole("status")).toBeNull();
    });

    test("shows the reCAPTCHA legal notice", () => {
      renderChat({ recaptchaEnabled: true });
      expect(screen.getByText(/protected by reCAPTCHA/)).toBeInTheDocument();
    });
  });

  describe("reCAPTCHA disabled", () => {
    test("calls the assistant directly", async () => {
      const { calls } = routeFetch({ "/api/assistant": [answer("i1", "a1")] });
      renderChat();

      await send("hi");
      await settled();

      expect(calls.map((c) => c.url)).toEqual(["/api/assistant"]);
    });

    test("hides the reCAPTCHA legal notice", () => {
      renderChat();
      expect(screen.queryByText(/protected by reCAPTCHA/)).toBeNull();
    });
  });
});
