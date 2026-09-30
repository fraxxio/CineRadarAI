"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_STOPPED_TEXT_LENGTH } from "@/lib/chatLimits";

export type ChatStatus = "idle" | "loading" | "streaming" | "error";

type UseChatOptions = {
  // runs before each send (e.g. reCAPTCHA); resolve false to cancel the send
  beforeSend?: (signal: AbortSignal) => Promise<boolean>;
};

// the request in flight
type Turn = {
  controller: AbortController;
  prompt: string;
  text: string;
  // beforeSend passed and the prompt is shown in the chat
  accepted: boolean;
};

const MAX_MESSAGES = 10;

const capped = (messages: Tmessage) => messages.slice(-MAX_MESSAGES);

export function useChat({ beforeSend }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Tmessage>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const turnRef = useRef<Turn | null>(null);
  // last completed turn, the next request continues from it
  const interactionIdRef = useRef<string>();
  const stoppedTurnRef = useRef<StoppedTurn>();
  const messageCount = useRef(0);

  const nextId = () => `m${++messageCount.current}`;

  // abort the request in flight when the chat unmounts
  useEffect(
    () => () => {
      turnRef.current?.controller.abort();
      turnRef.current = null;
    },
    [],
  );

  // resolves once the prompt is accepted (true) or cancelled before sending
  // (false); the answer keeps streaming after that
  async function send(prompt: string): Promise<boolean> {
    if (turnRef.current) {
      return false;
    }

    const turn: Turn = {
      controller: new AbortController(),
      prompt,
      text: "",
      accepted: false,
    };
    const { signal } = turn.controller;
    // false once the turn was stopped or the chat was reset
    const isCurrent = () => turnRef.current === turn;
    turnRef.current = turn;

    // set before beforeSend so the loader shows during verification
    setStreamingContent("");
    setStatus("loading");

    if (beforeSend) {
      const allowed = await beforeSend(signal);
      if (!isCurrent()) {
        return false;
      }
      if (!allowed) {
        turnRef.current = null;
        setStatus("idle");
        return false;
      }
    }

    turn.accepted = true;
    setMessages((prev) =>
      capped([...prev, { id: nextId(), role: "user", content: prompt }]),
    );
    void streamReply(turn, isCurrent);
    return true;
  }

  async function streamReply(turn: Turn, isCurrent: () => boolean) {
    const { signal } = turn.controller;
    let newInteractionId = "";

    try {
      const request: ChatRequest = {
        content: turn.prompt,
        previousInteractionId: interactionIdRef.current,
        stoppedTurn: stoppedTurnRef.current,
      };
      // post new message to server and stream Gemini response
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal,
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
            turn.text += serverEvent.text;
            setStreamingContent(turn.text);
            setStatus("streaming");
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
      // also ends reads on streams that ignore the fetch signal
      signal.addEventListener("abort", () => {
        reader.cancel().catch(() => {});
      });
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (!isCurrent()) {
          return;
        }

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

      interactionIdRef.current = newInteractionId;
      // the model has now seen the stopped turn as part of this interaction
      stoppedTurnRef.current = undefined;
      setMessages((prev) =>
        capped([
          ...prev,
          { id: nextId(), role: "assistant", content: turn.text },
        ]),
      );
      setStatus("idle");
    } catch (error) {
      // stopped or reset: the fetch/read rejects with an AbortError
      if (!isCurrent()) {
        return;
      }
      console.error("AI chat error:", error);
      setStatus("error");
      // turn was never created (e.g. expired interaction or rejected stopped
      // turn), start a new conversation next time
      if (!newInteractionId) {
        interactionIdRef.current = undefined;
        stoppedTurnRef.current = undefined;
      }
    }

    turnRef.current = null;
    setStreamingContent("");
  }

  // keeps the partial answer; the next send shares it with the model
  function stop() {
    const turn = turnRef.current;
    if (!turn) {
      return;
    }
    turnRef.current = null;
    turn.controller.abort();

    if (turn.accepted) {
      // don't continue from the stopped interaction: its state on Google's side
      // is unreliable, so interactionId stays on the last completed turn
      stoppedTurnRef.current = {
        prompt: turn.prompt,
        partialText: turn.text.slice(0, MAX_STOPPED_TEXT_LENGTH),
      };
      setMessages((prev) =>
        capped([
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: turn.text,
            stopped: true,
          },
        ]),
      );
    }
    setStreamingContent("");
    setStatus("idle");
  }

  // starts a fresh conversation
  function reset() {
    turnRef.current?.controller.abort();
    turnRef.current = null;
    interactionIdRef.current = undefined;
    stoppedTurnRef.current = undefined;
    setMessages([]);
    setStreamingContent("");
    setStatus("idle");
  }

  return { messages, streamingContent, status, send, stop, reset };
}
