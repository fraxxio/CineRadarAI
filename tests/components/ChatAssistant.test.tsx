import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import ChatAssistant from "@/Components/ChatAssistant";
import { MAX_PROMPT_LENGTH } from "@/lib/chatLimits";
import { controlledStream, ndjson, streamResponse } from "../helpers/stream";

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
const submitBtn = () =>
  screen.getByRole("button", { name: /submit|generating/i });

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
    expect(submitBtn()).toHaveTextContent("Generating...");
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
