import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import ChatAssistant from "./ChatAssistant";
import {
  MAX_PROMPT_LENGTH,
  MAX_STOPPED_TEXT_LENGTH,
  MAX_STOPPED_TURNS,
} from "./chatLimits";
import { loadChat, saveChat, type ChatSnapshot } from "./chatStorage";
import type {
  ChatMessage,
  ListSavedPart,
  PendingSave,
  RecommendedTitle,
  StoppedTurn,
} from "./protocol";
import { listSavedPart, pendingSave, previousEntry } from "./testing/listParts";
import { controlledStream, ndjson, streamResponse } from "./testing/stream";

const GREETING = "Hi! What would you like to watch?";
const ERROR_TEXT = "Unfortunately an error occurred. Try again later.";
const CAPTCHA_FAILED = "Recaptcha failed to verify!";
const EXPIRED_TEXT = /This conversation is too old to continue/;
const expiredResponse = () =>
  Response.json({ error: "conversation_expired" }, { status: 409 });

const start = (interactionId: string) => ({ type: "start", interactionId });
const delta = (text: string) => ({ type: "delta", text });
const done = (interactionId: string) => ({ type: "done", interactionId });
const SEARCHING = "Searching TMDB database...";
const DETAILS = "Checking title details...";
const toolStart = (id: string, text = SEARCHING) => ({
  type: "tool_start",
  id,
  name: text === SEARCHING ? "search_titles" : "get_title_details",
  text,
});
const toolEnd = (id: string) => ({ type: "tool_end", id });
const PREPARING = "Preparing recommendations...";
const showStart = (id: string) => ({
  type: "tool_start",
  id,
  name: "show_recommendations",
  text: PREPARING,
});
const card = (
  id: number,
  extra: Partial<RecommendedTitle> = {},
): RecommendedTitle => ({
  type: "movie",
  id,
  title: `Title ${id}`,
  year: 2014,
  rating: 7.5,
  genres: ["War"],
  posterPath: `/poster${id}.jpg`,
  backdropPath: `/backdrop${id}.jpg`,
  reason: `Reason ${id}.`,
  ...extra,
});
const cards = (items: RecommendedTitle[]) => ({ type: "cards", items });
const FURY = card(228150, { title: "Fury", year: 2014 });
const DUNKIRK = card(374720, { title: "Dunkirk", year: 2017 });
// one complete, successful turn
const answer = (id: string, text: string) =>
  streamResponse([ndjson(start(id), delta(text), done(id))]);

// queues replies per URL and records every request
function routeFetch(routes: Record<string, Response[]>) {
  const calls: {
    url: string;
    method?: string;
    headers: Headers;
    body: Record<string, unknown>;
  }[] = [];
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method,
        headers: new Headers(init?.headers),
        // a DELETE has no body
        body:
          init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      });
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

const renderChat = ({ recaptchaEnabled = false, signedIn = false } = {}) =>
  render(
    <ChatAssistant
      greeting={GREETING}
      recaptchaEnabled={recaptchaEnabled}
      signedIn={signedIn}
    />,
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

  describe("tool lines", () => {
    const stopBtn = () => screen.getByRole("button", { name: "Stop" });
    // the rotating loader's screen-reader text
    const thinking = () => screen.queryByText("Generating response");
    // the line's label span; its text content includes the counter and time
    const toolLine = (label = SEARCHING) =>
      screen.getByText(label, { exact: false });
    const isBefore = (a: Element, b: Element) =>
      a.compareDocumentPosition(b) === Node.DOCUMENT_POSITION_FOLLOWING;

    test("a tool call before any text replaces the rotating loader", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      expect(thinking()).toBeInTheDocument();

      stream.push(ndjson(start("i1"), toolStart("c1")));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(SEARCHING),
      );
      expect(thinking()).toBeNull();
      expect(input()).toBeDisabled();
    });

    test("a tool line stays in the answer after it finishes", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");

      stream.push(ndjson(start("i1"), delta("Let me check."), toolStart("c1")));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(SEARCHING),
      );
      stream.push(ndjson(toolEnd("c1"), delta("Watch Fury."), done("i1")));
      stream.close();
      await settled();

      const before = screen.getByText("Let me check.");
      const line = toolLine();
      const after = screen.getByText("Watch Fury.");
      expect(isBefore(before, line)).toBe(true);
      expect(isBefore(line, after)).toBe(true);
      expect(line).toHaveTextContent(new RegExp(`^${SEARCHING} - \\d`));
      // finished: not a live loader any more
      expect(screen.queryByRole("status")).toBeNull();
      expect(document.querySelector("svg.animate-spin")).toBeNull();
    });

    test("tool lines of earlier answers stay in the history", async () => {
      routeFetch({
        "/api/assistant": [
          streamResponse([
            ndjson(start("i1"), toolStart("c1"), toolEnd("c1")),
            ndjson(delta("a1"), done("i1")),
          ]),
          answer("i2", "a2"),
        ],
      });
      renderChat();
      await send("p1");
      await settled();
      await send("p2");
      await settled();

      expect(isBefore(toolLine(), screen.getByText("a1"))).toBe(true);
      expect(isBefore(screen.getByText("a1"), screen.getByText("p2"))).toBe(
        true,
      );
    });

    test("two different tools make two lines", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");

      stream.push(
        ndjson(start("i1"), toolStart("c1"), toolStart("c2", DETAILS)),
      );

      await waitFor(() =>
        expect(screen.getAllByRole("status")).toHaveLength(2),
      );
      expect(isBefore(toolLine(SEARCHING), toolLine(DETAILS))).toBe(true);
      expect(toolLine(SEARCHING)).not.toHaveTextContent(/\(\d+x\)/);
    });

    test("repeated calls of one tool share a line with a counter", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");

      stream.push(
        ndjson(
          start("i1"),
          toolStart("c1", DETAILS),
          toolStart("c2", DETAILS),
          toolStart("c3", DETAILS),
        ),
      );

      await waitFor(() => expect(toolLine(DETAILS)).toHaveTextContent("(3x)"));
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getAllByText(DETAILS, { exact: false })).toHaveLength(1);
    });

    test("the rotating loader shows after a tool ends, until the next delta", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(ndjson(start("i1"), toolStart("c1")));
      await waitFor(() => expect(thinking()).toBeNull());

      stream.push(ndjson(toolEnd("c1")));

      // the model reads the results
      await waitFor(() => expect(thinking()).toBeInTheDocument());
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(isBefore(toolLine(), screen.getByRole("status"))).toBe(true);

      stream.push(ndjson(delta("Watch Fury.")));
      await screen.findByText("Watch Fury.");
      expect(thinking()).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    test("a stop during a tool freezes its line and marks the answer stopped", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(ndjson(start("i1"), delta("Let me check."), toolStart("c1")));
      await waitFor(() => expect(thinking()).toBeNull());
      act(() => vi.advanceTimersByTime(12_000));
      expect(toolLine()).toHaveTextContent("12s");

      await user.click(stopBtn());

      expect(screen.queryByRole("status")).toBeNull();
      expect(document.querySelector("svg.animate-spin")).toBeNull();
      const stopped = screen.getByText("Stopped").parentElement!;
      expect(within(stopped).getByText("Let me check.")).toBeInTheDocument();
      expect(within(stopped).getByText(SEARCHING, { exact: false })).toBe(
        toolLine(),
      );
      act(() => vi.advanceTimersByTime(5000));
      expect(toolLine()).toHaveTextContent(`${SEARCHING} - 12s`);
    });

    test("an error during a tool round drops the partial answer", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");

      stream.push(ndjson(start("i1"), delta("Let me check."), toolStart("c1")));
      await waitFor(() => expect(thinking()).toBeNull());
      stream.push(ndjson({ type: "error" }));

      expect(await screen.findByText(ERROR_TEXT)).toBeInTheDocument();
      await settled();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByText("Let me check.")).toBeNull();
      expect(screen.queryByText(SEARCHING, { exact: false })).toBeNull();
    });

    test("the next turn starts with the rotating loader", async () => {
      const first = controlledStream();
      const second = controlledStream();
      routeFetch({ "/api/assistant": [first.response, second.response] });
      renderChat();
      await send("p1");
      first.push(ndjson(start("i1"), toolStart("c1")));
      await waitFor(() => expect(thinking()).toBeNull());
      await user.click(stopBtn());

      await send("p2");

      // the stopped line stays in p1's answer, frozen
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(thinking()).toBeInTheDocument();
      expect(isBefore(toolLine(), screen.getByText("p2"))).toBe(true);
    });

    test("the turn after a failed tool round starts with the rotating loader", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const first = controlledStream();
      const second = controlledStream();
      routeFetch({ "/api/assistant": [first.response, second.response] });
      renderChat();
      await send("p1");
      first.push(ndjson(start("i1"), toolStart("c1"), { type: "error" }));
      await screen.findByText(ERROR_TEXT);
      await settled();

      await send("p2");

      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(thinking()).toBeInTheDocument();
    });

    test("a stop shares only the text with the model, one paragraph per text part", async () => {
      const toolRound = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          answer("i1", "a1"),
          toolRound.response,
          answer("i3", "a3"),
        ],
      });
      renderChat();
      await send("p1");
      await settled();
      await send("p2");
      toolRound.push(
        ndjson(
          start("i2"),
          delta("Let me check."),
          toolStart("c1"),
          toolEnd("c1"),
          delta("Fury is"),
          toolStart("c2", DETAILS),
        ),
      );
      await screen.findByText("Fury is");

      await user.click(stopBtn());
      await send("p3");
      await settled();

      // continues from the last completed turn, not the stopped one
      expect(bodies("/api/assistant")[2]).toEqual({
        content: "p3",
        previousInteractionId: "i1",
        stoppedTurns: [
          { prompt: "p2", partialText: "Let me check.\n\nFury is" },
        ],
      });
    });
  });

  describe("cards", () => {
    const stopBtn = () => screen.getByRole("button", { name: "Stop" });
    const thinking = () => screen.queryByText("Generating response");
    const cardLists = () =>
      screen.queryAllByRole("list", { name: "Recommendations" });
    const cardTitles = (list: HTMLElement) =>
      within(list)
        .getAllByRole("heading")
        .map((heading) => heading.textContent);
    const isBefore = (a: Element, b: Element) =>
      a.compareDocumentPosition(b) === Node.DOCUMENT_POSITION_FOLLOWING;
    // intro, show_recommendations line, cards
    const cardsRound = (...items: RecommendedTitle[]) =>
      ndjson(
        start("i1"),
        delta("Intro."),
        showStart("s1"),
        toolEnd("s1"),
        cards(items),
      );

    test("render live and stay after done", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");

      stream.push(cardsRound(FURY, DUNKIRK));

      await waitFor(() => expect(cardLists()).toHaveLength(1));
      expect(cardTitles(cardLists()[0])).toEqual(["Fury", "Dunkirk"]);
      expect(input()).toBeDisabled();

      stream.push(ndjson(done("i1")));
      stream.close();
      await settled();
      expect(cardLists()).toHaveLength(1);
      expect(cardTitles(cardLists()[0])).toEqual(["Fury", "Dunkirk"]);
      expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
        "href",
        "/search/movie/228150",
      );
    });

    test("intro, tool line, cards and closing line in arrival order", async () => {
      routeFetch({
        "/api/assistant": [
          streamResponse([
            cardsRound(FURY),
            ndjson(delta("Want older ones?"), done("i1")),
          ]),
        ],
      });
      renderChat();
      await send("war films");
      await settled();

      const shown = [
        screen.getByText("Intro."),
        screen.getByText(PREPARING, { exact: false }),
        cardLists()[0],
        screen.getByText("Want older ones?"),
      ];
      for (let i = 1; i < shown.length; i++) {
        expect(isBefore(shown[i - 1], shown[i])).toBe(true);
      }
    });

    test("the rotating loader shows after the cards until the next delta", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(ndjson(start("i1"), delta("Intro."), showStart("s1")));
      await waitFor(() => expect(thinking()).toBeNull());

      stream.push(ndjson(toolEnd("s1"), cards([FURY])));

      // the model works on its next round
      await waitFor(() => expect(cardLists()).toHaveLength(1));
      expect(thinking()).toBeInTheDocument();
      expect(isBefore(cardLists()[0], screen.getByRole("status"))).toBe(true);

      stream.push(ndjson(delta("Want older ones?")));
      await screen.findByText("Want older ones?");
      expect(thinking()).toBeNull();
    });

    test("a stop after the cards keeps them and shares them with the model", async () => {
      const stream = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [stream.response, answer("i2", "a2")],
      });
      renderChat();
      await send("war films");
      stream.push(cardsRound(FURY, card(5, { title: "Untitled", year: null })));
      await waitFor(() => expect(cardLists()).toHaveLength(1));

      await user.click(stopBtn());

      const stopped = screen.getByText("Stopped").parentElement!;
      expect(
        cardTitles(
          within(stopped).getByRole("list", { name: "Recommendations" }),
        ),
      ).toEqual(["Fury", "Untitled"]);

      await send("more like the first one");
      await settled();
      expect(bodies("/api/assistant")[1]).toEqual({
        content: "more like the first one",
        stoppedTurns: [
          {
            prompt: "war films",
            partialText:
              "Intro.\n\n[Shown as cards: 1. Fury (movie 228150, 2014); 2. Untitled (movie 5, unknown year)]",
          },
        ],
      });
      // the stopped turn's cards stay above the new answer
      expect(cardLists()).toHaveLength(1);
      expect(isBefore(cardLists()[0], screen.getByText("a2"))).toBe(true);
    });

    test("a stop before the cards leaves none in the history", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(ndjson(start("i1"), delta("Intro."), showStart("s1")));
      await waitFor(() => expect(thinking()).toBeNull());

      await user.click(stopBtn());

      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(screen.getByText(PREPARING, { exact: false })).toBeInTheDocument();
      expect(cardLists()).toHaveLength(0);
    });

    test("an error after the cards drops the answer", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("war films");
      stream.push(cardsRound(FURY));
      await waitFor(() => expect(cardLists()).toHaveLength(1));

      stream.push(ndjson({ type: "error" }));

      expect(await screen.findByText(ERROR_TEXT)).toBeInTheDocument();
      await settled();
      expect(cardLists()).toHaveLength(0);
      expect(screen.queryByText("Intro.")).toBeNull();
    });

    test("cards of earlier answers stay while the next turn streams", async () => {
      const second = controlledStream();
      routeFetch({
        "/api/assistant": [
          streamResponse([cardsRound(FURY), ndjson(done("i1"))]),
          second.response,
        ],
      });
      renderChat();
      await send("p1");
      await settled();

      await send("p2");
      second.push(
        ndjson(start("i2"), showStart("s2"), toolEnd("s2"), cards([DUNKIRK])),
      );

      await waitFor(() => expect(cardLists()).toHaveLength(2));
      const [first, latest] = cardLists();
      expect(cardTitles(first)).toEqual(["Fury"]);
      expect(cardTitles(latest)).toEqual(["Dunkirk"]);
      expect(isBefore(first, screen.getByText("p2"))).toBe(true);
      expect(isBefore(screen.getByText("p2"), latest)).toBe(true);
    });

    test("signed in: Add to list on a card saves it", async () => {
      const { bodies } = routeFetch({
        "/api/assistant": [
          streamResponse([cardsRound(FURY), ndjson(done("i1"))]),
        ],
        "/api/add-to-list": [Response.json({ addToListResult: "success" })],
      });
      renderChat({ signedIn: true });
      await send("war films");
      await settled();

      await user.click(screen.getByRole("button", { name: /add to list/i }));
      const dialog = within(screen.getByRole("dialog"));
      await user.selectOptions(dialog.getByLabelText("Status:"), "Completed");
      await user.click(dialog.getByRole("button", { name: "Add to list" }));

      await waitFor(() =>
        expect(bodies("/api/add-to-list")).toEqual([
          expect.objectContaining({ movieId: "228150", title: "Fury" }),
        ]),
      );
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });

  describe("list saves", () => {
    const SAVING = "Saving to your list...";
    const saveStart = (id: string) => ({
      type: "tool_start",
      id,
      name: "save_to_list",
      text: SAVING,
    });
    const saved = ({ entry, previous }: ListSavedPart) => ({
      type: "list_saved",
      entry,
      previous,
    });
    const signInRequired = (save: PendingSave) => ({
      type: "sign_in_required",
      save,
    });
    // a save_to_list round and the model's line after it
    const saveTurn = (id: string, ...events: object[]) =>
      streamResponse([
        ndjson(
          start(id),
          saveStart("t1"),
          toolEnd("t1"),
          ...events,
          delta("Added to your list."),
          done(id),
        ),
      ]);
    const success = () => Response.json({ addToListResult: "success" });
    const undoBtn = (title = "Fury") =>
      screen.queryByRole("button", { name: `Undo ${title}` });
    const FURY_KEY = { movieId: 228150, type: "movie" };

    test("a save shows live, with Undo once the answer is finished", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat({ signedIn: true });
      await send("add Fury to my watchlist");

      stream.push(
        ndjson(
          start("i1"),
          saveStart("t1"),
          toolEnd("t1"),
          saved(listSavedPart()),
        ),
      );

      const line = await screen.findByText(
        "Added to your list · Planning to watch",
      );
      expect(line.closest("[aria-live]")).toHaveAttribute(
        "aria-live",
        "polite",
      );
      expect(undoBtn()).toBeNull();
      // the model writes its line next
      expect(screen.getByText("Generating response")).toBeInTheDocument();

      stream.push(ndjson(delta("Added."), done("i1")));
      stream.close();
      await settled();
      expect(undoBtn()).toBeEnabled();
      expect(
        screen
          .getByText("Added to your list · Planning to watch")
          .closest("[aria-live]"),
      ).toBeNull();
    });

    test("Undo of a new title removes it and tells the model next turn", async () => {
      const { calls, bodies } = routeFetch({
        "/api/assistant": [
          saveTurn("i1", saved(listSavedPart())),
          answer("i2", "It isn't."),
          answer("i3", "a3"),
        ],
        "/api/remove-from-list": [success()],
      });
      renderChat({ signedIn: true });
      await send("add Fury");
      await settled();
      vi.mocked(useRouter().refresh).mockClear();

      await user.click(undoBtn()!);

      expect(await screen.findByText("Undone")).toBeInTheDocument();
      const [removal] = calls.filter((c) => c.url === "/api/remove-from-list");
      expect(removal.method).toBe("DELETE");
      expect(removal.headers.get("movieId")).toBe("228150");
      expect(removal.headers.get("type")).toBe("movie");
      expect(useRouter().refresh).toHaveBeenCalledOnce();

      await send("is Fury in my list?");
      await settled();
      await send("p3");
      await settled();
      const [, second, third] = bodies("/api/assistant");
      expect(second).toEqual({
        content: "is Fury in my list?",
        previousInteractionId: "i1",
        listChanges: [FURY_KEY],
      });
      // the model has seen it
      expect(third).not.toHaveProperty("listChanges");
    });

    it.each([
      [8, 8],
      [0, ""],
    ])(
      "Undo of a status change puts the row back (rating %j -> %j)",
      async (rating, sent) => {
        const part = listSavedPart(
          { status: "Completed" },
          previousEntry({ rating }),
        );
        const { calls, bodies } = routeFetch({
          "/api/assistant": [saveTurn("i1", saved(part))],
          "/api/add-to-list": [success()],
        });
        renderChat({ signedIn: true });
        await send("mark Fury as completed");
        await settled();
        expect(
          screen.getByText("Moved to Completed (was Watching)"),
        ).toBeInTheDocument();

        await user.click(undoBtn()!);

        expect(await screen.findByText("Undone")).toBeInTheDocument();
        expect(calls.find((c) => c.url === "/api/add-to-list")?.method).toBe(
          "PUT",
        );
        expect(bodies("/api/add-to-list")).toEqual([
          {
            movieId: 228150,
            title: "Fury",
            image: "/old.jpg",
            status: "Watching",
            rating: sent,
            type: "movie",
          },
        ]);
      },
    );

    it.each([
      [
        "a legacy status (400)",
        () => Response.json({ addToListResult: "fail" }, { status: 400 }),
      ],
      [
        "a DB error (200 fail)",
        () => Response.json({ addToListResult: "fail" }),
      ],
    ])("a failed Undo: %s -> toast, the save stays", async (_, reply) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const part = listSavedPart({}, previousEntry({ status: "Dropped" }));
      const { bodies } = routeFetch({
        "/api/assistant": [saveTurn("i1", saved(part)), answer("i2", "a2")],
        "/api/add-to-list": [reply()],
      });
      renderChat({ signedIn: true });
      await send("add Fury");
      await settled();
      vi.mocked(useRouter().refresh).mockClear();

      await user.click(undoBtn()!);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "Something went wrong while undoing.",
          expect.anything(),
        ),
      );
      expect(undoBtn()).toBeEnabled();
      expect(screen.queryByText("Undone")).toBeNull();
      expect(useRouter().refresh).not.toHaveBeenCalled();

      await send("p2");
      await settled();
      expect(bodies("/api/assistant")[1]).not.toHaveProperty("listChanges");
    });

    test("list changes are kept after a failed turn", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { bodies } = routeFetch({
        "/api/assistant": [
          saveTurn("i1", saved(listSavedPart())),
          new Response("", { status: 500 }),
          answer("i3", "a3"),
        ],
        "/api/remove-from-list": [success()],
      });
      renderChat({ signedIn: true });
      await send("add Fury");
      await settled();
      await user.click(undoBtn()!);
      await screen.findByText("Undone");

      await send("p2");
      await screen.findByText(ERROR_TEXT);
      await send("p3");
      await settled();

      const [, failed, retry] = bodies("/api/assistant");
      expect(failed.listChanges).toEqual([FURY_KEY]);
      expect(retry.listChanges).toEqual([FURY_KEY]);
    });

    test("an Undo while the next answer streams is sent with the one after", async () => {
      const second = controlledStream();
      const { bodies } = routeFetch({
        "/api/assistant": [
          saveTurn("i1", saved(listSavedPart())),
          second.response,
          answer("i3", "a3"),
        ],
        "/api/remove-from-list": [success()],
      });
      renderChat({ signedIn: true });
      await send("add Fury");
      await settled();

      await send("p2");
      await user.click(undoBtn()!);
      await screen.findByText("Undone");
      second.push(ndjson(start("i2"), delta("a2"), done("i2")));
      second.close();
      await settled();
      await send("p3");
      await settled();

      const [, during, after] = bodies("/api/assistant");
      expect(during).not.toHaveProperty("listChanges");
      expect(after.listChanges).toEqual([FURY_KEY]);
    });

    test("cards show the list status from the chat's saves and Undo", async () => {
      routeFetch({
        "/api/assistant": [
          streamResponse([
            ndjson(
              start("i1"),
              showStart("s1"),
              toolEnd("s1"),
              cards([FURY, DUNKIRK]),
              done("i1"),
            ),
          ]),
          saveTurn("i2", saved(listSavedPart({ status: "Completed" }))),
        ],
        "/api/remove-from-list": [success()],
      });
      renderChat({ signedIn: true });
      await send("war films");
      await settled();
      const badge = (title: string) =>
        within(
          screen.getByRole("heading", { name: title }).closest("li")!,
        ).queryByText(/^In your list/);
      expect(badge("Fury")).toBeNull();

      await send("mark the first one as completed");
      await settled();
      expect(badge("Fury")).toHaveTextContent("In your list · Completed");
      expect(badge("Dunkirk")).toBeNull();

      await user.click(undoBtn()!);
      await screen.findByText("Undone");
      expect(badge("Fury")).toBeNull();
    });

    test("refreshes /my-list once per turn with saves", async () => {
      routeFetch({
        "/api/assistant": [
          saveTurn(
            "i1",
            saved(listSavedPart()),
            saved(listSavedPart({ id: 374720, title: "Dunkirk" })),
          ),
          answer("i2", "a2"),
        ],
      });
      renderChat({ signedIn: true });

      await send("add both");
      await settled();
      expect(screen.getAllByText(/^Added to your list ·/)).toHaveLength(2);
      expect(useRouter().refresh).toHaveBeenCalledOnce();

      await send("thanks");
      await settled();
      expect(useRouter().refresh).toHaveBeenCalledOnce();
    });

    test("a stop after a save refreshes too", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat({ signedIn: true });
      await send("add Fury");
      stream.push(ndjson(start("i1"), saved(listSavedPart())));
      await screen.findByText(/^Added to your list/);
      expect(useRouter().refresh).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Stop" }));

      expect(useRouter().refresh).toHaveBeenCalledOnce();
    });

    test("signed out: one sign-in card for the answer's titles", async () => {
      routeFetch({
        "/api/assistant": [
          saveTurn(
            "i1",
            signInRequired(pendingSave()),
            signInRequired(pendingSave({ id: 374720, title: "Dunkirk" })),
          ),
        ],
      });
      renderChat();
      await send("add Fury and Dunkirk");
      await settled();

      expect(
        screen.getByText("Sign in to add 2 titles to your list"),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
        "href",
        "/signin?callbackUrl=/",
      );
      expect(useRouter().refresh).not.toHaveBeenCalled();
    });

    test("the undone save and the list changes survive a remount", async () => {
      routeFetch({
        "/api/assistant": [saveTurn("i1", saved(listSavedPart()))],
        "/api/remove-from-list": [success()],
      });
      const { unmount } = renderChat({ signedIn: true });
      await send("add Fury");
      await settled();
      await user.click(undoBtn()!);
      await screen.findByText("Undone");
      unmount();
      expect(loadChat()?.listChanges).toEqual([FURY_KEY]);

      const { bodies } = routeFetch({ "/api/assistant": [answer("i2", "a2")] });
      renderChat({ signedIn: true });
      expect(await screen.findByText("Undone")).toBeInTheDocument();
      expect(undoBtn()).toBeNull();

      await send("p2");
      await settled();
      expect(bodies("/api/assistant")[0].listChanges).toEqual([FURY_KEY]);
    });

    test("New chat drops the list changes", async () => {
      routeFetch({
        "/api/assistant": [saveTurn("i1", saved(listSavedPart()))],
        "/api/remove-from-list": [success()],
      });
      renderChat({ signedIn: true });
      await send("add Fury");
      await settled();
      await user.click(undoBtn()!);
      await screen.findByText("Undone");

      await user.click(newChatBtn());

      const { bodies } = routeFetch({ "/api/assistant": [answer("i2", "a2")] });
      await send("p2");
      await settled();
      expect(bodies("/api/assistant")[0]).toEqual({ content: "p2" });
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

  describe("kept for the session", () => {
    const KEY = "cineradar.chat.v1";
    const text = (
      id: string,
      role: ChatMessage["role"],
      value: string,
    ): ChatMessage => ({ id, role, parts: [{ type: "text", text: value }] });
    const SAVED: ChatSnapshot = {
      messages: [
        text("m1", "user", "war films"),
        {
          id: "m2",
          role: "assistant",
          parts: [
            {
              type: "tool",
              name: "search_titles",
              label: SEARCHING,
              callIds: ["c1"],
              runningIds: [],
              elapsedMs: 2400,
            },
            { type: "text", text: "Watch Fury." },
            { type: "cards", items: [FURY] },
          ],
        },
        text("m3", "user", "older ones"),
        { ...text("m4", "assistant", "Try"), stopped: true },
      ],
      interactionId: "i1",
      stoppedTurns: [{ prompt: "older ones", partialText: "Try" }],
    };
    const stopBtn = () => screen.getByRole("button", { name: "Stop" });

    test("a saved chat is restored on mount", async () => {
      saveChat(SAVED);
      renderChat();

      expect(await screen.findByText("Watch Fury.")).toBeInTheDocument();
      expect(screen.getByText("war films")).toBeInTheDocument();
      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(
        screen.getByRole("list", { name: "Recommendations" }),
      ).toBeInTheDocument();
      expect(newChatBtn()).toBeEnabled();
    });

    test("a restored tool line shows its final time and doesn't tick", async () => {
      saveChat(SAVED);
      renderChat();

      expect(await screen.findByText(SEARCHING)).toHaveTextContent("2.4s");
      expect(screen.queryByRole("status")).toBeNull();
    });

    test("the next request continues the restored conversation", async () => {
      saveChat(SAVED);
      const { bodies } = routeFetch({ "/api/assistant": [answer("i2", "a2")] });
      renderChat();
      await screen.findByText("Watch Fury.");

      await send("p2");
      await settled();

      expect(bodies("/api/assistant")).toEqual([
        {
          content: "p2",
          previousInteractionId: "i1",
          stoppedTurns: [{ prompt: "older ones", partialText: "Try" }],
        },
      ]);
    });

    test("the first render doesn't overwrite the saved chat", async () => {
      saveChat(SAVED);
      const before = sessionStorage.getItem(KEY);
      renderChat();
      await screen.findByText("Watch Fury.");

      // not even its age: restoring isn't a change
      expect(sessionStorage.getItem(KEY)).toBe(before);
    });

    test("new messages after a restore get unique ids", async () => {
      const consoleError = vi.spyOn(console, "error");
      saveChat(SAVED);
      routeFetch({ "/api/assistant": [answer("i2", "a2")] });
      renderChat();
      await screen.findByText("Watch Fury.");

      await send("p2");
      await settled();

      const ids = loadChat()!.messages.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.slice(-2)).toEqual(["m5", "m6"]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    test("a completed turn survives a remount", async () => {
      routeFetch({
        "/api/assistant": [answer("i1", "a1"), answer("i2", "a2")],
      });
      const { unmount } = renderChat();
      await send("p1");
      await settled();
      unmount();

      const { bodies } = routeFetch({ "/api/assistant": [answer("i2", "a2")] });
      renderChat();
      expect(await screen.findByText("a1")).toBeInTheDocument();
      expect(screen.getByText("p1")).toBeInTheDocument();

      await send("p2");
      await settled();
      expect(bodies("/api/assistant")[0]).toEqual({
        content: "p2",
        previousInteractionId: "i1",
      });
    });

    test("a stop is saved with its stopped turn", async () => {
      const stream = controlledStream();
      routeFetch({ "/api/assistant": [stream.response] });
      renderChat();
      await send("hi");
      stream.push(ndjson(start("i1"), delta("part")));
      await screen.findByText("part");

      await user.click(stopBtn());

      expect(loadChat()).toMatchObject({
        messages: [
          { role: "user", parts: [{ type: "text", text: "hi" }] },
          { role: "assistant", stopped: true },
        ],
        stoppedTurns: [{ prompt: "hi", partialText: "part" }],
      });
    });

    test("a failed turn drops the saved interaction id", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      saveChat(SAVED);
      routeFetch({ "/api/assistant": [new Response("", { status: 500 })] });
      renderChat();
      await screen.findByText("Watch Fury.");

      await send("p2");
      await screen.findByText(ERROR_TEXT);

      const saved = loadChat()!;
      expect(saved).not.toHaveProperty("interactionId");
      expect(saved.stoppedTurns).toEqual([]);
      expect(saved.messages.at(-1)).toMatchObject({ role: "user" });
    });

    describe("expired", () => {
      beforeEach(() => {
        vi.spyOn(console, "info").mockImplementation(() => {});
      });

      test("a 409 keeps the messages and shows the notice, not the error", async () => {
        saveChat(SAVED);
        routeFetch({ "/api/assistant": [expiredResponse()] });
        renderChat();
        await screen.findByText("Watch Fury.");

        await send("p2");

        expect(await screen.findByText(EXPIRED_TEXT)).toBeInTheDocument();
        expect(screen.queryByText(ERROR_TEXT)).toBeNull();
        expect(screen.getByText("Watch Fury.")).toBeInTheDocument();
        expect(screen.getByText("p2")).toBeInTheDocument();
        await settled();
        expect(newChatBtn()).toBeEnabled();
      });

      test("the next send starts a new conversation and clears the notice", async () => {
        saveChat(SAVED);
        const { bodies } = routeFetch({
          "/api/assistant": [expiredResponse(), answer("i2", "a2")],
        });
        renderChat();
        await screen.findByText("Watch Fury.");

        await send("p2");
        await screen.findByText(EXPIRED_TEXT);
        await settled();
        await send("p2");
        await settled();

        expect(bodies("/api/assistant")).toEqual([
          {
            content: "p2",
            previousInteractionId: "i1",
            stoppedTurns: [{ prompt: "older ones", partialText: "Try" }],
          },
          { content: "p2" },
        ]);
        expect(screen.getByText("a2")).toBeInTheDocument();
        expect(screen.queryByText(EXPIRED_TEXT)).toBeNull();
      });

      test("the saved chat keeps the messages without the dead interaction", async () => {
        saveChat(SAVED);
        routeFetch({ "/api/assistant": [expiredResponse()] });
        renderChat();
        await screen.findByText("Watch Fury.");

        await send("p2");
        await screen.findByText(EXPIRED_TEXT);

        const saved = loadChat()!;
        expect(saved).not.toHaveProperty("interactionId");
        expect(saved.stoppedTurns).toEqual([]);
        expect(saved.messages.map((m) => m.id)).toEqual([
          "m1",
          "m2",
          "m3",
          "m4",
          "m5",
        ]);
      });

      it.each([
        [
          "another 409 error",
          () => Response.json({ error: "x" }, { status: 409 }),
        ],
        ["a 409 without JSON", () => new Response("", { status: 409 })],
      ])("%s is a plain error", async (_, reply) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        routeFetch({ "/api/assistant": [reply()] });
        renderChat();

        await send("hi");

        expect(await screen.findByText(ERROR_TEXT)).toBeInTheDocument();
        expect(screen.queryByText(EXPIRED_TEXT)).toBeNull();
      });

      test("New chat clears the notice", async () => {
        routeFetch({ "/api/assistant": [expiredResponse()] });
        renderChat();
        await send("hi");
        await screen.findByText(EXPIRED_TEXT);

        await user.click(newChatBtn());

        expect(screen.queryByText(EXPIRED_TEXT)).toBeNull();
      });
    });

    test("New chat clears it", async () => {
      saveChat(SAVED);
      renderChat();
      await screen.findByText("Watch Fury.");

      await user.click(newChatBtn());

      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    describe.each([
      ["pagehide", () => window.dispatchEvent(new Event("pagehide"))],
      ["unmount", (unmount: () => void) => unmount()],
    ])("leaving mid-answer (%s)", (_, leave) => {
      // read before React renders again: there's no later render to save in
      // when the page goes away
      const savedOnLeave = (unmount: () => void) => {
        const saved: ReturnType<typeof loadChat>[] = [];
        act(() => {
          leave(unmount);
          saved.push(loadChat());
        });
        return saved[0];
      };

      test("saves the partial answer as a stopped message", async () => {
        saveChat(SAVED);
        const stream = controlledStream();
        const { spy } = routeFetch({ "/api/assistant": [stream.response] });
        const { unmount } = renderChat();
        await screen.findByText("Watch Fury.");
        await send("p2");
        stream.push(ndjson(start("i2"), delta("Hal")));
        await screen.findByText("Hal");

        const saved = savedOnLeave(unmount);

        expect(spy.mock.calls[0][1]?.signal?.aborted).toBe(true);
        expect(saved).toMatchObject({
          // stays on the last completed turn, as with Stop
          interactionId: "i1",
          stoppedTurns: [
            { prompt: "older ones", partialText: "Try" },
            { prompt: "p2", partialText: "Hal" },
          ],
        });
        expect(saved!.messages.slice(-2)).toEqual([
          text("m5", "user", "p2"),
          { ...text("m6", "assistant", "Hal"), stopped: true },
        ]);
      });

      test("while the tools run: their lines keep their time", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const stream = controlledStream();
        routeFetch({ "/api/assistant": [stream.response] });
        const { unmount } = renderChat();
        await send("hi");
        stream.push(ndjson(start("i1"), toolStart("t1")));
        await screen.findByText(SEARCHING);
        vi.advanceTimersByTime(1500);

        const [, answer] = savedOnLeave(unmount)!.messages;
        expect(answer.parts).toEqual([
          expect.objectContaining({
            type: "tool",
            runningIds: [],
            elapsedMs: expect.toSatisfy((ms: number) => ms >= 1500),
          }),
        ]);
        expect(answer.parts[0]).not.toHaveProperty("runningSince");
      });

      test("before the prompt was accepted: saves nothing", async () => {
        mockRecaptcha(async () => "tok");
        const verification = controlledStream();
        const { calls } = routeFetch({
          "/api/recaptcha": [verification.response],
        });
        const { unmount } = renderChat({ recaptchaEnabled: true });
        await send("hi");
        await waitFor(() => expect(calls).toHaveLength(1));

        expect(savedOnLeave(unmount)).toBeNull();
      });
    });

    test("pagehide after the answer changes nothing", async () => {
      routeFetch({ "/api/assistant": [answer("i1", "a1")] });
      renderChat();
      await send("hi");
      await settled();
      const before = sessionStorage.getItem(KEY);

      act(() => void window.dispatchEvent(new Event("pagehide")));

      expect(sessionStorage.getItem(KEY)).toBe(before);
      expect(screen.queryByText("Stopped")).toBeNull();
    });

    test("storage throwing: the chat still works", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const failing = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(failing);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(failing);
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(failing);
      const { bodies } = routeFetch({
        "/api/assistant": [answer("i1", "a1"), answer("i2", "a2")],
      });
      renderChat();

      await send("p1");
      await settled();
      await send("p2");
      await settled();
      await user.click(newChatBtn());

      expect(bodies("/api/assistant")[1]).toEqual({
        content: "p2",
        previousInteractionId: "i1",
      });
      expect(screen.queryByText(ERROR_TEXT)).toBeNull();
      expect(screen.queryByText("a2")).toBeNull();
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
