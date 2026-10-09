"use client";
import { useRef, useState } from "react";
import { SquarePen } from "lucide-react";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingLoader } from "./ThinkingLoader";
import { ChatSubmitBtn } from "./ChatSubmitBtn";
import { useChat } from "./useChat";
import { useRecaptchaCheck } from "@/infra/recaptcha/useRecaptchaCheck";
import { MAX_PROMPT_LENGTH } from "./chatLimits";
import { LOADER_WORDS } from "./loaderWords";
import { lastPartIsFinishedTool } from "./messageParts";
import type { ChatMessage } from "./protocol";
import { shuffle } from "@/shared/lib/shuffle";

type ChatAssistantProps = {
  greeting: string;
  recaptchaEnabled: boolean;
};

export default function ChatAssistant({
  greeting = "Ask me for movie or TV show suggestions. Describe what would you like to watch, for example: genre, actors, style...",
  recaptchaEnabled,
}: ChatAssistantProps) {
  const recaptcha = useRecaptchaCheck(recaptchaEnabled);
  const { messages, streamingParts, status, send, stop, reset } = useChat({
    beforeSend: recaptcha.verify,
  });
  const [prompt, setPrompt] = useState("");
  // safe to shuffle during render: the loader never renders on the server
  const [loaderWords] = useState(() => shuffle(LOADER_WORDS));
  const loaderTurn = useRef(0);

  const isBusy = status === "loading" || status === "streaming";
  const isEmpty = messages.length === 0 && status === "idle";
  // nothing has arrived yet, or the tools are done and the model is reading
  // their results; a running tool line has its own spinner
  const showLoader =
    streamingParts.length === 0 || lastPartIsFinishedTool(streamingParts);

  const assistantText = (text: string): Omit<ChatMessage, "id"> => ({
    role: "assistant",
    parts: [{ type: "text", text }],
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    loaderTurn.current += 1;
    // the prompt stays in the input for a retry if the send is cancelled
    if (await send(prompt)) {
      setPrompt("");
    }
  }

  function handlePromptChange(e: React.FormEvent<HTMLInputElement>) {
    setPrompt(e.currentTarget.value);
  }

  return (
    <div className="relative flex h-[80vh] flex-col rounded-sm border border-border-clr bg-primary-bg">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-2 pt-4">
        <h1 className="col-start-2 text-center text-2xl font-medium max-[380px]:text-xl">
          Chat with CineRadarAI
        </h1>
        <button
          type="button"
          onClick={reset}
          disabled={isEmpty}
          className="flex items-center gap-1 justify-self-end rounded-md border border-border-clr bg-dark-bg px-2 py-1 text-sm font-medium duration-200 enabled:hover:bg-primary-text enabled:hover:text-dark-bg disabled:text-slate-500"
        >
          <SquarePen size={16} />
          <span className="max-sm:sr-only">New chat</span>
        </button>
      </div>
      <div className="flex max-h-full flex-col-reverse overflow-y-auto">
        <div>
          <AssistantMessage message={assistantText(greeting)} />
          {messages.map((m) => (
            <AssistantMessage key={m.id} message={m} />
          ))}
          {isBusy && (
            <AssistantMessage
              message={{ role: "assistant", parts: streamingParts }}
            >
              {showLoader && (
                <ThinkingLoader
                  words={loaderWords}
                  startIndex={loaderTurn.current}
                />
              )}
            </AssistantMessage>
          )}
          {status === "error" && (
            <AssistantMessage
              message={assistantText(
                "Unfortunately an error occurred. Try again later.",
              )}
            />
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-auto flex px-4 py-2">
        <input
          disabled={isBusy}
          className="h-[40px] w-full rounded-bl-md rounded-tl-md border border-border-clr bg-dark-bg px-3 py-2 text-primary-text outline-none placeholder:text-secondary-text focus:ring-1 focus:ring-primary-text"
          onChange={handlePromptChange}
          value={prompt}
          maxLength={MAX_PROMPT_LENGTH}
          required
          placeholder="Suggest me movies about war with Brad Pitt..."
        />
        <ChatSubmitBtn
          isBusy={isBusy}
          disabled={prompt.length == 0}
          onStop={stop}
        />
      </form>
      {recaptchaEnabled && (
        <small className="text-center text-secondary-text">
          This site is protected by reCAPTCHA and the Google{" "}
          <a href="https://policies.google.com/privacy" className="underline">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" className="underline">
            Terms of Service
          </a>{" "}
          apply.
        </small>
      )}
      {recaptcha.failed && (
        <div className="text-center font-medium text-red-600">
          Recaptcha failed to verify!
        </div>
      )}
    </div>
  );
}
