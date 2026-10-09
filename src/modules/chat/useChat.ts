"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_STOPPED_TEXT_LENGTH, MAX_STOPPED_TURNS } from "./chatLimits";
import {
  appendText,
  endTool,
  partsToText,
  startTool,
  stopTools,
} from "./messageParts";
import type {
  ChatMessage,
  ChatRequest,
  ChatStreamEvent,
  MessagePart,
  StoppedTurn,
} from "./protocol";

export type ChatStatus = "idle" | "loading" | "streaming" | "error";

type UseChatOptions = {
  // runs before each send (e.g. reCAPTCHA); resolve false to cancel the send
  beforeSend?: (signal: AbortSignal) => Promise<boolean>;
};

// the request in flight
type Turn = {
  controller: AbortController;
  prompt: string;
  // the answer so far
  parts: MessagePart[];
  // beforeSend passed and the prompt is shown in the chat
  accepted: boolean;
};

const MAX_MESSAGES = 10;

const capped = (messages: ChatMessage[]) => messages.slice(-MAX_MESSAGES);

export function useChat({ beforeSend }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // the answer in flight: text and tool lines in order
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const turnRef = useRef<Turn | null>(null);
  // last completed turn, the next request continues from it
  const interactionIdRef = useRef<string>();
  // stopped since the last completed turn, the model hasn't seen them yet
  const stoppedTurnsRef = useRef<StoppedTurn[]>([]);
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
      parts: [],
      accepted: false,
    };
    const { signal } = turn.controller;
    // false once the turn was stopped or the chat was reset
    const isCurrent = () => turnRef.current === turn;
    turnRef.current = turn;

    // set before beforeSend so the loader shows during verification
    setStreamingParts([]);
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
      capped([
        ...prev,
        { id: nextId(), role: "user", parts: [{ type: "text", text: prompt }] },
      ]),
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
        stoppedTurns: stoppedTurnsRef.current.length
          ? stoppedTurnsRef.current
          : undefined,
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
            turn.parts = appendText(turn.parts, serverEvent.text);
            setStreamingParts(turn.parts);
            setStatus("streaming");
            break;
          case "tool_start":
            turn.parts = startTool(turn.parts, serverEvent, Date.now());
            setStreamingParts(turn.parts);
            break;
          case "tool_end":
            turn.parts = endTool(turn.parts, serverEvent.id, Date.now());
            setStreamingParts(turn.parts);
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
      // the model has now seen the stopped turns as part of this interaction
      stoppedTurnsRef.current = [];
      // every call has ended by now; stopTools only guards against a line
      // that would spin forever in the history
      const parts = stopTools(turn.parts, Date.now());
      setMessages((prev) =>
        capped([...prev, { id: nextId(), role: "assistant", parts }]),
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
      // turns), start a new conversation next time
      if (!newInteractionId) {
        interactionIdRef.current = undefined;
        stoppedTurnsRef.current = [];
      }
    }

    turnRef.current = null;
    setStreamingParts([]);
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
      // running tool lines keep the time they had at the stop
      const parts = stopTools(turn.parts, Date.now());
      // don't continue from the stopped interaction: its state on Google's side
      // is unreliable, so interactionId stays on the last completed turn
      // keep the newest ones so the request stays within the server limit
      stoppedTurnsRef.current = [
        ...stoppedTurnsRef.current,
        {
          prompt: turn.prompt,
          partialText: partsToText(parts).slice(0, MAX_STOPPED_TEXT_LENGTH),
        },
      ].slice(-MAX_STOPPED_TURNS);
      setMessages((prev) =>
        capped([
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            parts,
            stopped: true,
          },
        ]),
      );
    }
    setStreamingParts([]);
    setStatus("idle");
  }

  // starts a fresh conversation
  function reset() {
    turnRef.current?.controller.abort();
    turnRef.current = null;
    interactionIdRef.current = undefined;
    stoppedTurnsRef.current = [];
    setMessages([]);
    setStreamingParts([]);
    setStatus("idle");
  }

  return { messages, streamingParts, status, send, stop, reset };
}
