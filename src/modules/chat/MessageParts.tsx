import { memo } from "react";
import Markdown, { Components } from "react-markdown";
import Link from "next/link";
import type { MessagePart } from "./protocol";
import { RecommendationCards } from "./RecommendationCards";
import { ToolCallLine } from "./ToolCallLine";

type MessagePartsProps = {
  parts: MessagePart[];
  signedIn: boolean;
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

function MessagePartView({
  part,
  signedIn,
}: {
  part: MessagePart;
  signedIn: boolean;
}) {
  switch (part.type) {
    case "text":
      return (
        <div>
          <Markdown components={markdownComponents}>{part.text}</Markdown>
        </div>
      );
    case "tool":
      return <ToolCallLine part={part} />;
    case "cards":
      return <RecommendationCards items={part.items} signedIn={signedIn} />;
    default:
      part satisfies never;
      return null;
  }
}

// text, tool lines and cards in the order they arrived; memo: a finished
// message keeps its parts, so streaming the next answer doesn't re-parse its
// markdown
export const MessageParts = memo(function MessageParts({
  parts,
  signedIn,
}: MessagePartsProps) {
  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => (
        // parts are only appended, so the index is stable
        <MessagePartView key={i} part={part} signedIn={signedIn} />
      ))}
    </div>
  );
});
