import Markdown, { Components } from "react-markdown";
import Image from "next/image";
import Link from "next/link";

type AssistantMessageProps = {
  message: {
    id?: string;
    role: string;
    content?: string;
    stopped?: boolean;
  };
  children?: React.ReactNode;
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

export function AssistantMessage({ message, children }: AssistantMessageProps) {
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
        {children ?? (
          <Markdown components={markdownComponents}>
            {message.content ?? ""}
          </Markdown>
        )}
      </div>
      {message.stopped && (
        <small className="italic text-secondary-text">Stopped</small>
      )}
    </div>
  );
}
