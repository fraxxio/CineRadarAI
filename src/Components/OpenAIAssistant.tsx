"use client";
import { useState } from "react";
import { AssistantMessage } from "./ui/AssistantMessage";
import { LoaderCircle, SendHorizontal } from "lucide-react";

type OpenAIAssistantProps = {
  greeting: string;
  messageLimit: number;
};

type Tmessage = {
  id: string;
  role: string;
  content: string;
}[];

export default function OpenAIAssistant({
  greeting = "Ask me for movie or TV show suggestions. Describe what would you like to watch, for example: genre, actors, style...",
  messageLimit = 10,
}: OpenAIAssistantProps) {
  const [isLoading, setIsLoading] = useState(false);
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

    // clear streaming message
    setStreamingMessage({
      role: "assistant",
      content: "_Thinking..._",
    });

    setIsLoading(true);

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
      throw new Error("Network response was not ok.");
    }

    if (!response.body) {
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
        console.log(serverEvent);
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
            throw new Error("Thread run failed.");
        }
      }
    }

    // refetch all of the messages from the OpenAI Assistant thread
    const messagesResponse = await fetch(
      "/api/assistant?" +
        new URLSearchParams({
          threadId: newThreadId,
          messageLimit: messageLimit.toString(),
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
    <div className="relative flex min-h-[70vh] flex-col rounded-sm border border-border-clr bg-primary-bg">
      <AssistantMessage message={greetingMessage} />
      {messages.map((m) => (
        <AssistantMessage key={m.id} message={m} />
      ))}
      {isLoading && <AssistantMessage message={streamingMessage} />}
      <form onSubmit={handleSubmit} className="mx-4 mb-2 mt-auto flex">
        <input
          disabled={isLoading}
          className="w-full rounded-bl-md rounded-tl-md border border-border-clr bg-dark-bg px-3 py-2 text-primary-text outline-none placeholder:text-secondary-text focus:ring-1 focus:ring-primary-text"
          onChange={handlePromptChange}
          value={prompt}
          required
          placeholder="Suggest me movies about war with Brad Pitt..."
        />
        {isLoading ? (
          <button
            disabled
            className="flex min-h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg"
          >
            <LoaderCircle size={16} className="animate-spin" />
            Generating...
          </button>
        ) : (
          <button
            disabled={prompt.length == 0}
            className="flex min-h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:cursor-pointer hover:bg-primary-text hover:text-dark-bg"
          >
            Submit
            <SendHorizontal size={16} />
          </button>
        )}
      </form>
    </div>
  );
}

// "use client";

// import { useChat } from "ai/react";
// import { SendHorizontal } from "lucide-react";
// import Image from "next/image";
// import { useRef, useEffect } from "react";

// export default function Chat() {
//   const { messages, input, handleInputChange, handleSubmit } = useChat();
//   const chatParent = useRef<HTMLUListElement>(null);

//   useEffect(() => {
//     const domNode = chatParent.current;
//     if (domNode) {
//       domNode.scrollTop = domNode.scrollHeight;
//     }
//   });

//   return (
//     <section className="flex h-[80vh] w-full flex-col rounded-sm border border-border-clr bg-primary-bg p-4">
//       <h1 className="mx-auto pb-2 text-2xl font-bold">CineRadar AI chat</h1>

//       <ul
//         ref={chatParent}
//         className="flex h-1 flex-grow flex-col gap-4 overflow-y-auto rounded-lg p-4"
//       >
//         {messages.length === 0 ? (
//           <li className="px-4 pt-40 text-center">
//             <span className="font-bold">
//               <Image
//                 width={50}
//                 height={50}
//                 src="/CineRadarLogo.png"
//                 alt="AI icon"
//                 className="mx-auto rounded-full border border-border-clr bg-dark-bg p-1"
//               />
//               CineRadarAI
//             </span>
//             <p className="mx-auto max-w-[35rem] pt-4">
//               Ask me for movie or TV show recommendations! Describe what you
//               would like to watch: genre, actors, style or whatever.
//             </p>
//           </li>
//         ) : (
//           messages.map((m, index) => (
//             <>
//               {m.role === "user" ? (
//                 <li key={index} className="p-4">
//                   <span className="pl-[54px] font-bold">You:</span>
//                   <p className="pl-[54px]">{m.content}</p>
//                 </li>
//               ) : (
//                 <li key={index} className=" p-4">
//                   <span className="flex items-center gap-1 font-bold">
//                     <Image
//                       width={50}
//                       height={50}
//                       src="/CineRadarLogo.png"
//                       alt="AI icon"
//                       className="rounded-full border border-border-clr bg-dark-bg p-1"
//                     />
//                     CineRadarAI:
//                   </span>
//                   <p className="pl-[54px]">{m.content}</p>
//                 </li>
//               )}
//             </>
//           ))
//         )}
//       </ul>

//       <form
//         onSubmit={handleSubmit}
//         className="mx-auto flex w-full max-w-3xl items-center pt-2"
//       >
//         <input
//           className="min-h-[40px] flex-1 rounded-bl-md rounded-tl-md border border-border-clr bg-dark-bg px-2  outline-2 -outline-offset-4 outline-primary-text placeholder:text-secondary-text focus:outline"
//           placeholder="Ask for movie recommendations..."
//           type="text"
//           value={input}
//           onChange={handleInputChange}
//         />
//         <button
//           className="flex min-h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg"
//           type="submit"
//         >
//           Submit
//           <SendHorizontal size={16} />
//         </button>
//       </form>
//     </section>
//   );
// }
