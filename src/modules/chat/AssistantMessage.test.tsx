import { render, screen } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import { AssistantMessage } from "./AssistantMessage";
import type { MessagePart, ToolPart } from "./protocol";

const text = (value: string): MessagePart => ({ type: "text", text: value });
const tool = (label: string, calls = 1): ToolPart => ({
  type: "tool",
  name: label,
  label,
  callIds: Array.from({ length: calls }, (_, i) => `c${i}`),
  runningIds: [],
  elapsedMs: 2400,
});

const assistant = (content: string) =>
  render(
    <AssistantMessage message={{ role: "assistant", parts: [text(content)] }} />,
  );

describe("AssistantMessage", () => {
  test("labels user messages", () => {
    render(<AssistantMessage message={{ role: "user", parts: [text("hi")] }} />);
    expect(screen.getByText("You:")).toBeInTheDocument();
    expect(screen.queryByAltText("CineRadar Bot")).toBeNull();
  });

  test("labels assistant messages with the logo", () => {
    assistant("hi");
    expect(screen.getByText("CineRadar AI:")).toBeInTheDocument();
    expect(screen.getByAltText("CineRadar Bot")).toBeInTheDocument();
  });

  test("renders markdown lists, bold text and links", () => {
    const { container } = assistant(
      "1. **Fury** — [Fury](/search?query=Fury&btn=movie&year=2014)\n2. Two",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("strong")).toHaveTextContent("Fury");
    expect(screen.getByRole("link", { name: "Fury" })).toBeInTheDocument();
  });

  test("internal links open in the same tab", () => {
    assistant("[Fury](/search?query=Fury&btn=movie&year=2014)");
    const link = screen.getByRole("link", { name: "Fury" });
    expect(link).toHaveAttribute(
      "href",
      "/search?query=Fury&btn=movie&year=2014",
    );
    expect(link).not.toHaveAttribute("target");
  });

  it.each(["https://example.com", "mailto:a@b.co", "//evil.example"])(
    "external link %s opens in a new tab",
    (href) => {
      assistant(`[x](${href})`);
      const link = screen.getByRole("link", { name: "x" });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    },
  );

  test("neutralises javascript: links", () => {
    assistant("[x](javascript:alert(1))");
    // react-markdown 8 rewrites unsafe schemes to javascript:void(0)
    const link = screen.getByText("x").closest("a");
    expect(link?.getAttribute("href") ?? "").not.toMatch(/alert/);
  });

  test("does not render raw HTML", () => {
    const { container } = assistant(
      `<img src=x onerror="alert(1)"><script>alert(1)</script>`,
    );
    expect(container.querySelector("img[onerror], script")).toBeNull();
  });

  test("renders text and tool lines in order", () => {
    render(
      <AssistantMessage
        message={{
          role: "assistant",
          parts: [
            text("Let me check."),
            tool("Searching", 3),
            tool("Browsing"),
            text("Here you go."),
          ],
        }}
      />,
    );
    const shown = [
      screen.getByText("Let me check."),
      screen.getByText(/^Searching/),
      screen.getByText(/^Browsing/),
      screen.getByText("Here you go."),
    ];
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i - 1].compareDocumentPosition(shown[i])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    expect(shown[1]).toHaveTextContent("Searching (3x) - 2.4s");
    expect(shown[2]).toHaveTextContent("Browsing - 2.4s");
    // finished lines aren't live loaders
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("each text part is markdown on its own", () => {
    const { container } = render(
      <AssistantMessage
        message={{
          role: "assistant",
          parts: [text("1. One"), tool("Searching"), text("2. Two")],
        }}
      />,
    );
    // two lists: the tool line sits between them
    expect(container.querySelectorAll("ol")).toHaveLength(2);
  });

  test("children render after the parts, above the stopped note", () => {
    render(
      <AssistantMessage
        message={{
          role: "assistant",
          parts: [text("Let me check.")],
          stopped: true,
        }}
      >
        <span>loader</span>
      </AssistantMessage>,
    );
    const content = screen.getByText("Let me check.");
    const loader = screen.getByText("loader");
    const stopped = screen.getByText("Stopped");
    expect(content.compareDocumentPosition(loader)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(loader.compareDocumentPosition(stopped)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
