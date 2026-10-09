import Markdown, { Components } from "react-markdown";
import Link from "next/link";
import type { MessagePart } from "./protocol";
import { ToolCallLine } from "./ToolCallLine";

type MessagePartsProps = {
  parts: MessagePart[];
};

// has a scheme (https:, mailto:) or is protocol-relative (//host)
const isExternalHref = (href: string) =>
  /^([a-z][a-z\d+.-]*:|\/\/)/i.test(href);

const markdownComponents: Components = {
  a: ({ href = "", children }) =>
    isExternalHref(href) ? (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      <Link href={href}>{children}</Link>
    ),
};

function MessagePartView({ part }: { part: MessagePart }) {
  switch (part.type) {
    case "text":
      return (
        <div>
          <Markdown components={markdownComponents}>{part.text}</Markdown>
        </div>
      );
    case "tool":
      return <ToolCallLine part={part} />;
    default:
      part satisfies never;
      return null;
  }
}

// text and tool lines in the order they arrived
export function MessageParts({ parts }: MessagePartsProps) {
  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => (
        // parts are only appended, so the index is stable
        <MessagePartView key={i} part={part} />
      ))}
    </div>
  );
}
