"use client";
import { useState } from "react";
import { AssistantMessage } from "./ui/AssistantMessage";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { MAX_PROMPT_LENGTH } from "@/lib/chatLimits";

type ChatAssistantProps = {
  greeting: string;
  recaptchaEnabled: boolean;
};

export default function ChatAssistant({
  greeting = "Ask me for movie or TV show suggestions. Describe what would you like to watch, for example: genre, actors, style...",
  recaptchaEnabled,
}: ChatAssistantProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [interactionId, setInteractionId] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Tmessage>([]);
  const [streamingMessage, setStreamingMessage] = useState({
    role: "assistant",
    content: "_Thinking..._",
  });

  // set default greeting Message
  const greetingMessage = {
    role: "assistant",
    content: greeting,
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (recaptchaEnabled) {
      if (!executeRecaptcha) {
        console.log("Execute recaptcha not yet available");
        return;
      }
      const recaptchaToken = await executeRecaptcha("AIchatSubmit");
      setIsLoading(true);
      try {
        const response = await fetch("/api/recaptcha", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recaptchaToken }),
        });
        if (!response.ok) {
          const error = new Error(
            `Failed to verify captcha. (Status: ${response.status})`,
          );
          throw error;
        }
        const res = await response.json();
        if (res.success === false) {
          setCaptchaFailed(true);
          setTimeout(() => {
            setCaptchaFailed(false);
          }, 3000);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Recaptcha verify error (Client):", error);
        setIsLoading(false);
        return;
      }
    } else {
      setIsLoading(true);
    }

    // clear streaming message
    setStreamingMessage({
      role: "assistant",
      content: "_Generating list..._",
    });

    setIsError(false);

    const userPrompt = prompt;
    const tempId = `temp_user_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: userPrompt,
      },
    ]);
    setPrompt("");

    let contentSnapshot = "";
    let newInteractionId = "";

    try {
      // post new message to server and stream Gemini response
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          previousInteractionId: interactionId,
          content: userPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Network response was not ok. (Status: ${response.status})`,
        );
      }

      if (!response.body) {
        throw new Error("Response body is null.");
      }

      let completed = false;

      const handleServerEvent = (serverEvent: ChatStreamEvent) => {
        switch (serverEvent.type) {
          case "start":
            newInteractionId = serverEvent.interactionId;
            break;

          // update streaming message content
          case "delta":
            contentSnapshot += serverEvent.text;
            setStreamingMessage({
              ...streamingMessage,
              content: contentSnapshot,
            });
            break;
          case "done":
            newInteractionId = serverEvent.interactionId;
            completed = true;
            break;
          case "error":
            throw new Error("Chat response failed.");
        }
      };

      // this code can be simplified when more browsers support async iteration
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();

        // keep the last (possibly partial) line in the buffer for the next read
        buffer += decoder.decode(value, { stream: !done });
        const lines = done ? [buffer] : buffer.split("\n");
        buffer = done ? "" : lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            handleServerEvent(JSON.parse(line));
          }
        }

        if (done) {
          break;
        }
      }

      if (!completed) {
        throw new Error("Chat stream ended unexpectedly.");
      }

      setInteractionId(newInteractionId);

      // keep only the last 10 messages
      setMessages((prev) =>
        [
          ...prev.filter((m) => m.id !== tempId),
          { id: `${newInteractionId}-user`, role: "user", content: userPrompt },
          {
            id: `${newInteractionId}-model`,
            role: "assistant",
            content: contentSnapshot,
          },
        ].slice(-10),
      );
    } catch (error) {
      console.error("AI chat error:", error);
      setIsError(true);
      // turn was never created (e.g. expired interaction), start a new conversation next time
      if (!newInteractionId) {
        setInteractionId(undefined);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handlePromptChange(e: React.FormEvent<HTMLInputElement>) {
    setPrompt(e.currentTarget.value);
  }

  return (
    <div className="relative flex h-[80vh] flex-col rounded-sm border border-border-clr bg-primary-bg">
      <h1 className="pb-2 pt-4 text-center text-2xl font-medium max-[380px]:text-xl">
        Chat with CineRadarAI
      </h1>
      <div className="flex max-h-full flex-col-reverse overflow-y-auto">
        <div>
          <AssistantMessage message={greetingMessage} />
          {messages.map((m) => (
            <AssistantMessage key={m.id} message={m} />
          ))}
          {isLoading && <AssistantMessage message={streamingMessage} />}
          {isError && (
            <AssistantMessage
              message={{
                role: "assistant",
                content: "Unfortunately an error occurred. Try again later.",
              }}
            />
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-auto flex px-4 py-2">
        <input
          disabled={isLoading}
          className="h-[40px] w-full rounded-bl-md rounded-tl-md border border-border-clr bg-dark-bg px-3 py-2 text-primary-text outline-none placeholder:text-secondary-text focus:ring-1 focus:ring-primary-text"
          onChange={handlePromptChange}
          value={prompt}
          maxLength={MAX_PROMPT_LENGTH}
          required
          placeholder="Suggest me movies about war with Brad Pitt..."
        />
        {isLoading ? (
          <button
            disabled
            className="flex h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg"
          >
            <LoaderCircle size={16} className="animate-spin" />
            Generating...
          </button>
        ) : (
          <button
            disabled={prompt.length == 0}
            className="flex h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:cursor-pointer hover:bg-primary-text hover:text-dark-bg"
          >
            Submit
            <SendHorizontal size={16} />
          </button>
        )}
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
      {captchaFailed && (
        <div className="text-center font-medium text-red-600">
          Recaptcha failed to verify!
        </div>
      )}
    </div>
  );
}
