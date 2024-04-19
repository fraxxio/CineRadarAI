"use client";

import { useChat } from "ai/react";
import { SendHorizontal } from "lucide-react";
import Image from "next/image";
import { useRef, useEffect } from "react";

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const chatParent = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const domNode = chatParent.current;
    if (domNode) {
      domNode.scrollTop = domNode.scrollHeight;
    }
  });

  return (
    <section className="flex h-[80vh] w-full flex-col rounded-sm border border-border-clr bg-primary-bg p-4">
      <h1 className="mx-auto pb-2 text-2xl font-bold">CineRadar AI chat</h1>

      <ul
        ref={chatParent}
        className="flex h-1 flex-grow flex-col gap-4 overflow-y-auto rounded-lg p-4"
      >
        {messages.length === 0 ? (
          <li className="px-4 pt-40 text-center">
            <span className="font-bold">
              <Image
                width={50}
                height={50}
                src="/CineRadarLogo.png"
                alt="AI icon"
                className="mx-auto rounded-full border border-border-clr bg-dark-bg p-1"
              />
              CineRadarAI:
            </span>
            <p className="mx-auto max-w-[35rem] pt-4">
              Ask me for movie or TV show recommendations! Describe what you
              would like to watch: genre, actors, style or whatever.
            </p>
          </li>
        ) : (
          messages.map((m, index) => (
            <>
              {m.role === "user" ? (
                <li key={index} className="p-4">
                  <span className="pl-[54px] font-bold">You:</span>
                  <p className="pl-[54px]">{m.content}</p>
                </li>
              ) : (
                <li key={index} className=" p-4">
                  <span className="flex items-center gap-1 font-bold">
                    <Image
                      width={50}
                      height={50}
                      src="/CineRadarLogo.png"
                      alt="AI icon"
                      className="rounded-full border border-border-clr bg-dark-bg p-1"
                    />
                    CineRadarAI:
                  </span>
                  <p className="pl-[54px]">{m.content}</p>
                </li>
              )}
            </>
          ))
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl items-center pt-2"
      >
        <input
          className="min-h-[40px] flex-1 rounded-bl-md rounded-tl-md border border-border-clr bg-dark-bg px-2  outline-2 -outline-offset-4 outline-primary-text placeholder:text-secondary-text focus:outline"
          placeholder="Ask for movie recommendations..."
          type="text"
          value={input}
          onChange={handleInputChange}
        />
        <button
          className="flex min-h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg"
          type="submit"
        >
          Submit
          <SendHorizontal size={16} />
        </button>
      </form>
    </section>
  );
}
