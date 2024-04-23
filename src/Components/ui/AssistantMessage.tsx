import Markdown from "react-markdown";
import Image from "next/image";

type AssistantMessageProps = {
  message: {
    id?: string;
    role: string;
    content: string;
  };
};
export function AssistantMessage({ message }: AssistantMessageProps) {
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
      <div className="text-xl font-medium">{displayRole(message.role)}</div>
      <div className="chatLink overflow-auto text-left">
        <Markdown>{message.content}</Markdown>
      </div>
    </div>
  );
}
