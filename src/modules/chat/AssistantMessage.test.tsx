import { render, screen } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import { AssistantMessage } from "./AssistantMessage";

const assistant = (content: string) =>
  render(<AssistantMessage message={{ role: "assistant", content }} />);

describe("AssistantMessage", () => {
  test("labels user messages", () => {
    render(<AssistantMessage message={{ role: "user", content: "hi" }} />);
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

  test("children replace the markdown content", () => {
    render(
      <AssistantMessage message={{ role: "assistant", content: "content" }}>
        <span>loader</span>
      </AssistantMessage>,
    );
    expect(screen.getByText("loader")).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });

  test("the footer renders under the content, above the stopped note", () => {
    render(
      <AssistantMessage
        message={{ role: "assistant", content: "Let me check.", stopped: true }}
        footer={<span>footer</span>}
      />,
    );
    const content = screen.getByText("Let me check.");
    const footer = screen.getByText("footer");
    const stopped = screen.getByText("Stopped");
    expect(content.compareDocumentPosition(footer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(footer.compareDocumentPosition(stopped)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
