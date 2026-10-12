"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntryKey } from "@/modules/my-list";
import {
  MAX_LIST_CHANGES,
  MAX_STOPPED_TEXT_LENGTH,
  MAX_STOPPED_TURNS,
} from "./chatLimits";
import {
  clearSavedChat,
  loadChat,
  saveChat,
  type ChatSnapshot,
} from "./chatStorage";
import {
  addCards,
  addListSaved,
  addSignIn,
  appendText,
  endTool,
  partsToText,
  startTool,
  stopTools,
} from "./messageParts";
import type {
  ChatErrorResponse,
  ChatMessage,
  ChatRequest,
  ChatStreamEvent,
  ListSavedPart,
  MessagePart,
  StoppedTurn,
} from "./protocol";

// expired: Gemini no longer has the conversation, the next send starts fresh
export type ChatStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "error"
  | "expired";

type UseChatOptions = {
  // runs before each send (e.g. reCAPTCHA); resolve false to cancel the send
  beforeSend?: (signal: AbortSignal) => Promise<boolean>;
};

// reverses the list_saved part at partIndex of a finished message; false
// when it failed
export type UndoSave = (
  messageId: string,
  partIndex: number,
) => Promise<boolean>;

// the request in flight
type Turn = {
  controller: AbortController;
  prompt: string;
  // the answer so far
  parts: MessagePart[];
  // beforeSend passed and the prompt is shown in the chat
  accepted: boolean;
  // a save_to_list call saved a title, /my-list needs a refresh
  listSaved: boolean;
};

const MAX_MESSAGES = 10;

const capped = (messages: ChatMessage[]) => messages.slice(-MAX_MESSAGES);

class ConversationExpiredError extends Error {}

// the server's 409 for a previous interaction Gemini no longer has
async function isExpiredResponse(response: Response): Promise<boolean> {
  if (response.status !== 409) {
    return false;
  }
  try {
    const body: ChatErrorResponse = await response.json();
    return body.error === "conversation_expired";
  } catch {
    return false;
  }
}

// the number in an "m12" id, 0 for any other id
const idNumber = (id: string) => Number(/^m(\d+)$/.exec(id)?.[1] ?? 0);

// a key changed again moves to the end as a new object: a completed turn
// clears only the very objects it sent, so a change made while it ran stays
function addListChange(changes: EntryKey[], key: EntryKey): EntryKey[] {
  return [
    ...changes.filter((c) => c.movieId !== key.movieId || c.type !== key.type),
    { ...key },
  ].slice(-MAX_LIST_CHANGES);
}

// puts the row back as it was before the save, through the list's own routes
async function undoRequest({ entry, previous }: ListSavedPart) {
  const response =
    previous === null
      ? await fetch("/api/remove-from-list", {
          method: "DELETE",
          headers: { movieId: String(entry.id), type: entry.type },
        })
      : await fetch("/api/add-to-list", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieId: entry.id,
            title: previous.name,
            image: previous.image,
            status: previous.status,
            // 0 is "not rated", which the route takes as ""
            rating: previous.rating || "",
            type: entry.type,
          }),
        });
  // a DB error is a 200 with "fail"
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.addToListResult !== "success") {
    throw new Error(`Undo failed. (Status: ${response.status})`);
  }
}

export function useChat({ beforeSend }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // the answer in flight: text, tool lines and cards in order
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const turnRef = useRef<Turn | null>(null);
  // last completed turn, the next request continues from it
  const interactionIdRef = useRef<string>();
  // stopped since the last completed turn, the model hasn't seen them yet
  const stoppedTurnsRef = useRef<StoppedTurn[]>([]);
  // entries changed outside the model (Undo) since the last completed turn;
  // the server tells the model their state
  const listChangesRef = useRef<EntryKey[]>([]);
  const messageCount = useRef(0);
  // the saved chat has been read; state, not a ref, so the effects of the
  // first render (run twice in strict mode) can't save over it
  const [restored, setRestored] = useState(false);
  // the messages the restore set, already saved as they are
  const restoredMessagesRef = useRef<ChatMessage[]>();
  // the latest messages, for saving when the page goes away
  const messagesRef = useRef<ChatMessage[]>([]);
  const router = useRouter();

  const nextId = () => `m${++messageCount.current}`;

  // what's saved besides the messages, read from the refs
  const snapshot = (messages: ChatMessage[]): ChatSnapshot => ({
    messages,
    interactionId: interactionIdRef.current,
    stoppedTurns: stoppedTurnsRef.current,
    listChanges: listChangesRef.current,
  });

  // after mount, not during render: the server has no saved chat to render
  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      interactionIdRef.current = saved.interactionId;
      stoppedTurnsRef.current = saved.stoppedTurns;
      listChangesRef.current = saved.listChanges ?? [];
      // new ids continue after the restored ones, so keys don't collide
      messageCount.current = Math.max(
        0,
        ...saved.messages.map((m) => idNumber(m.id)),
      );
      restoredMessagesRef.current = saved.messages;
      setMessages(saved.messages);
    }
    setRestored(true);
  }, []);

  // the refs are written before the setMessages (or setStatus) of the same
  // update, so this sees them; the answer in flight isn't saved
  useEffect(() => {
    messagesRef.current = messages;
    // saving the restored chat again would only extend its age
    if (!restored || messages === restoredMessagesRef.current) {
      return;
    }
    if (messages.length === 0) {
      clearSavedChat();
      return;
    }
    saveChat(snapshot(messages));
    // snapshot only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, restored]);

  // leaving mid-answer counts as Stop; there's no later render to save it in,
  // so it's saved right away. pagehide: refresh, closing the tab, leaving the
  // site; unmount: client-side navigation
  useEffect(() => {
    const leave = () => stopTurn({ saveNow: true });
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // stopTurn only uses refs and state setters, the first one is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      listSaved: false,
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
    const sentListChanges = listChangesRef.current;

    try {
      const request: ChatRequest = {
        content: turn.prompt,
        previousInteractionId: interactionIdRef.current,
        stoppedTurns: stoppedTurnsRef.current.length
          ? stoppedTurnsRef.current
          : undefined,
        listChanges: sentListChanges.length ? sentListChanges : undefined,
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

      if (await isExpiredResponse(response)) {
        throw new ConversationExpiredError();
      }
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
          case "cards":
            turn.parts = addCards(turn.parts, serverEvent.items);
            setStreamingParts(turn.parts);
            break;
          case "list_saved":
            turn.parts = addListSaved(turn.parts, serverEvent);
            turn.listSaved = true;
            setStreamingParts(turn.parts);
            break;
          case "sign_in_required":
            turn.parts = addSignIn(turn.parts, serverEvent.save);
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
      // the model has now seen the stopped turns and the list changes as part
      // of this interaction
      stoppedTurnsRef.current = [];
      listChangesRef.current = listChangesRef.current.filter(
        (change) => !sentListChanges.includes(change),
      );
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
      const expired = error instanceof ConversationExpiredError;
      if (expired) {
        console.info("AI chat conversation expired, starting a new one");
      } else {
        console.error("AI chat error:", error);
      }
      setStatus(expired ? "expired" : "error");
      // turn was never created (e.g. expired interaction or rejected stopped
      // turns), start a new conversation next time
      if (!newInteractionId) {
        interactionIdRef.current = undefined;
        stoppedTurnsRef.current = [];
      }
    }

    turnRef.current = null;
    setStreamingParts([]);
    refreshIfSaved(turn);
  }

  // once per turn, at its end: router.refresh() clears the client router
  // cache, so /my-list shows the saves
  function refreshIfSaved(turn: Turn) {
    if (turn.listSaved) {
      router.refresh();
    }
  }

  // keeps the partial answer; the next send shares it with the model
  function stop() {
    stopTurn({ saveNow: false });
  }

  // ends the turn in flight; `saveNow` when the page is going away
  function stopTurn({ saveNow }: { saveNow: boolean }) {
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
      const message: ChatMessage = {
        id: nextId(),
        role: "assistant",
        parts,
        stopped: true,
      };
      setMessages((prev) => capped([...prev, message]));
      if (saveNow) {
        saveChat(snapshot(capped([...messagesRef.current, message])));
      }
    }
    setStreamingParts([]);
    setStatus("idle");
    // the page is going away, the next one loads fresh data
    if (!saveNow) {
      refreshIfSaved(turn);
    }
  }

  // reverses a save shown in a finished message; resolves false when it
  // failed, and the part stays as it is
  const undoSave = useCallback<UndoSave>(
    async (messageId, partIndex) => {
      const part = messagesRef.current.find((m) => m.id === messageId)?.parts[
        partIndex
      ];
      if (part?.type !== "list_saved") {
        return false;
      }
      if (part.undone) {
        return true;
      }
      try {
        await undoRequest(part);
      } catch (error) {
        console.error("Couldn't undo the list save:", error);
        return false;
      }
      // before setMessages, so the save effect stores it
      listChangesRef.current = addListChange(listChangesRef.current, {
        movieId: part.entry.id,
        type: part.entry.type,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                parts: m.parts.map((p, i) =>
                  i === partIndex && p.type === "list_saved"
                    ? { ...p, undone: true }
                    : p,
                ),
              }
            : m,
        ),
      );
      router.refresh();
      return true;
    },
    [router],
  );

  // starts a fresh conversation
  function reset() {
    const turn = turnRef.current;
    turn?.controller.abort();
    turnRef.current = null;
    interactionIdRef.current = undefined;
    stoppedTurnsRef.current = [];
    listChangesRef.current = [];
    clearSavedChat();
    setMessages([]);
    setStreamingParts([]);
    setStatus("idle");
    if (turn) {
      refreshIfSaved(turn);
    }
  }

  return { messages, streamingParts, status, send, stop, reset, undoSave };
}
