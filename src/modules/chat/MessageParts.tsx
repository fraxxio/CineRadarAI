import { memo } from "react";
import Markdown, { Components } from "react-markdown";
import Link from "next/link";
import { ListSavedRow } from "./ListSavedRow";
import type { ListStatuses } from "./messageParts";
import type { MessagePart } from "./protocol";
import { RecommendationCards } from "./RecommendationCards";
import { SignInCard } from "./SignInCard";
import { ToolCallLine } from "./ToolCallLine";
import type { UndoSave } from "./useChat";

type MessagePartsProps = {
  parts: MessagePart[];
  signedIn: boolean;
  // for the cards' list badges
  listStatus: ListStatuses;
  // both set on finished messages only: the streaming answer has no Undo
  messageId?: string;
  onUndo?: UndoSave;
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
  listStatus,
  onUndo,
}: {
  part: MessagePart;
  signedIn: boolean;
  listStatus: ListStatuses;
  onUndo?: () => Promise<boolean>;
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
      return (
        <RecommendationCards
          items={part.items}
          signedIn={signedIn}
          listStatus={listStatus}
        />
      );
    case "list_saved":
      return <ListSavedRow part={part} onUndo={onUndo} />;
    case "sign_in":
      return <SignInCard saves={part.saves} />;
    default:
      part satisfies never;
      return null;
  }
}

// text, tool lines, cards, saves and sign-in cards in the order they
// arrived; memo: a finished message keeps its parts, so streaming the next
// answer doesn't re-parse its markdown
export const MessageParts = memo(function MessageParts({
  parts,
  signedIn,
  listStatus,
  messageId,
  onUndo,
}: MessagePartsProps) {
  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) => (
        // parts are only appended, so the index is stable
        <MessagePartView
          key={i}
          part={part}
          signedIn={signedIn}
          listStatus={listStatus}
          onUndo={
            messageId !== undefined && onUndo
              ? () => onUndo(messageId, i)
              : undefined
          }
        />
      ))}
    </div>
  );
});
