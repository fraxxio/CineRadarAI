"use client";
import { useState } from "react";
import { AssistantMessage } from "./ui/AssistantMessage";
import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

type OpenAIAssistantProps = {
  greeting: string;
};

type Tmessage = {
  id: string;
  role: string;
  content: string;
}[];

export default function OpenAIAssistant({
  greeting = "Ask me for movie or TV show suggestions. Describe what would you like to watch, for example: genre, actors, style...",
}: OpenAIAssistantProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [threadId, setThreadId] = useState();
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

    // clear streaming message
    setStreamingMessage({
      role: "assistant",
      content: "_Generating list..._",
    });

    setMessages([
      ...messages,
      {
        id: "temp_user",
        role: "user",
        content: prompt,
      },
    ]);
    setPrompt("");

    // post new message to server and stream OpenAI Assistant response
    const response = await fetch("/api/assistant", {
      method: "POST",
      body: JSON.stringify({
        threadId: threadId,
        content: prompt,
      }),
    });

    if (!response.ok) {
      setIsError(true);
      throw new Error("Network response was not ok.");
    }

    if (!response.body) {
      setIsError(true);
      throw new Error("Response body is null.");
    }

    let contentSnapshot = "";
    let newThreadId = "";

    // this code can be simplified when more browsers support async iteration
    let reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      // parse server sent event
      const strChunk = new TextDecoder().decode(value).trim();

      // split on newlines (to handle multiple JSON elements passed at once)
      const strServerEvents = strChunk.split("\n");

      // process each event
      for (const strServerEvent of strServerEvents) {
        const serverEvent = JSON.parse(strServerEvent);
        switch (serverEvent.event) {
          // create new message
          case "thread.message.created":
            newThreadId = serverEvent.data.thread_id;
            setThreadId(serverEvent.data.thread_id);
            break;

          // update streaming message content
          case "thread.message.delta":
            contentSnapshot += serverEvent.data.delta.content[0].text.value;
            const newStreamingMessage = {
              ...streamingMessage,
              content: contentSnapshot,
            };
            setStreamingMessage(newStreamingMessage);
            break;
          case "thread.run.failed":
            setIsError(true);
            throw new Error("Thread run failed.");
        }
      }
    }

    // refetch all of the messages from the OpenAI Assistant thread
    const messagesResponse = await fetch(
      "/api/assistant?" +
        new URLSearchParams({
          threadId: newThreadId,
        }),
    );
    const allMessages = await messagesResponse.json();

    setMessages(allMessages);
    setIsLoading(false);
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
      {captchaFailed && (
        <div className="text-center font-medium text-red-600">
          Recaptcha failed to verify!
        </div>
      )}
    </div>
  );
}
