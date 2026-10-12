import Image from "next/image";
import type { ListStatuses } from "./messageParts";
import { MessageParts } from "./MessageParts";
import type { ChatMessage } from "./protocol";
import type { StartSignIn, UndoSave } from "./useChat";

const NO_LIST_STATUS: ListStatuses = new Map();
// the greeting and notices have no sign-in cards
const NO_SIGN_IN: StartSignIn = () => {};

type AssistantMessageProps = {
  message: {
    id?: string;
    role: ChatMessage["role"];
    parts: ChatMessage["parts"];
    stopped?: boolean;
  };
  // for "Add to list" on the cards; required, so no message can forget it and
  // tell signed-in users to log in
  signedIn: boolean;
  // the cards' list badges; the greeting and notices have no cards
  listStatus?: ListStatuses;
  // Undo on the saves of a finished message, which has an id
  onUndo?: UndoSave;
  // the sign-in cards' buttons keep their titles for after the sign-in
  onSignIn?: StartSignIn;
  // after the parts, e.g. the loader
  children?: React.ReactNode;
};

export function AssistantMessage({
  message,
  signedIn,
  listStatus = NO_LIST_STATUS,
  onUndo,
  onSignIn = NO_SIGN_IN,
  children,
}: AssistantMessageProps) {
  function displayRole(roleName: string) {
    switch (roleName) {
      case "user":
        return "You:";
      case "assistant":
        return (
          <div className="flex items-center gap-2">
            <Image
              src="/CineRadarLogo.png"
              width={50}
              height={50}
              alt="CineRadar Bot"
              className="rounded-full border border-border-clr bg-dark-bg p-1"
            />
            <p>CineRadar AI:</p>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <div className="text-xl font-medium max-[380px]:text-lg">
        {displayRole(message.role)}
      </div>
      <div className="chatLink overflow-auto text-left">
        <MessageParts
          parts={message.parts}
          signedIn={signedIn}
          listStatus={listStatus}
          messageId={message.id}
          onUndo={onUndo}
          onSignIn={onSignIn}
        />
        {children}
      </div>
      {message.stopped && (
        <small className="italic text-secondary-text">Stopped</small>
      )}
    </div>
  );
}
