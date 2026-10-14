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
import { saveTitleRequest, undoRequest } from "./listApi";
import {
  addCards,
  addListSaved,
  addSignIn,
  appendText,
  endTool,
  isListSaved,
  partsToText,
  startTool,
  stopTools,
  undoableSaves,
} from "./messageParts";
import type {
  ChatErrorResponse,
  ChatMessage,
  ChatRequest,
  ChatStreamEvent,
  ListSavedPart,
  MessagePart,
  PendingSave,
} from "./protocol";

// expired: Gemini no longer has the conversation, the next send starts fresh
export type ChatStatus = "idle" | "loading" | "streaming" | "error" | "expired";

type UseChatOptions = {
  // runs before each send (e.g. reCAPTCHA); resolve false to cancel the send
  beforeSend?: (signal: AbortSignal) => Promise<boolean>;
  // the pending saves of a sign-in run once this is true
  signedIn?: boolean;
};

// reverses the list_saved part at partIndex of a finished message; false
// when it failed
export type UndoSave = (
  messageId: string,
  partIndex: number,
) => Promise<boolean>;

// the titles of a sign-in card, saved once the user is back signed in
export type StartSignIn = (saves: PendingSave[]) => void;

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

// everything kept with the messages (see SavedChat), in one object so a save
// can't leave a field out
type Conversation = Omit<ChatSnapshot, "messages"> & {
  // entries changed outside the model (Undo, saves after sign-in, saves of a
  // failed turn) since the last completed turn; the server tells the model
  // their state
  listChanges: EntryKey[];
};

const NEW_CONVERSATION: Conversation = { stoppedTurns: [], listChanges: [] };

const MAX_MESSAGES = 10;
// saves resumed after one sign-in
const MAX_PENDING_SAVES = 10;

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
function addListChanges(
  changes: EntryKey[],
  saves: Pick<ListSavedPart, "entry">[],
): EntryKey[] {
  return saves
    .reduce(
      (all, { entry }) => [
        ...all.filter((c) => c.movieId !== entry.id || c.type !== entry.type),
        { movieId: entry.id, type: entry.type },
      ],
      changes,
    )
    .slice(-MAX_LIST_CHANGES);
}

export function useChat({ beforeSend, signedIn = false }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // the answer in flight: text, tool lines and cards in order
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([]);
  // its saves: a new array only when one arrives, not on every delta
  const [streamingSaves, setStreamingSaves] = useState<ListSavedPart[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [conversation, setConversation] = useState(NEW_CONVERSATION);
  // the same, for the requests and for the saves that can't wait for a render
  const conversationRef = useRef(conversation);
  const turnRef = useRef<Turn | null>(null);
  // the pending saves have been sent; strict mode runs effects twice
  const resumedRef = useRef(false);
  const messageCount = useRef(0);
  // the saved chat has been read; state, not a ref, so the effects of the
  // first render (run twice in strict mode) can't save over it
  const [restored, setRestored] = useState(false);
  // what the restore set, already saved as it is
  const restoredRef = useRef<{
    messages: ChatMessage[];
    conversation: Conversation;
  }>();
  // the latest messages, for saving when the page goes away
  const messagesRef = useRef<ChatMessage[]>([]);
  const router = useRouter();

  const nextId = () => `m${++messageCount.current}`;

  // the ref right away, the state (and so the saved chat) with the next render
  const updateConversation = useCallback(
    (update: (current: Conversation) => Conversation) => {
      conversationRef.current = update(conversationRef.current);
      setConversation(conversationRef.current);
    },
    [],
  );

  // for when no render follows (the page is going away), or the save can't
  // wait for one
  const saveChatNow = useCallback(
    (messages: ChatMessage[]) =>
      saveChat({ messages, ...conversationRef.current }),
    [],
  );

  // after mount, not during render: the server has no saved chat to render
  useEffect(() => {
    const saved = loadChat();
    if (saved) {
      const { version: _, savedAt: __, messages: _messages, ...rest } = saved;
      const restoredConversation = {
        ...rest,
        listChanges: rest.listChanges ?? [],
      };
      updateConversation(() => restoredConversation);
      // new ids continue after the restored ones, so keys don't collide
      messageCount.current = Math.max(
        0,
        ...saved.messages.map((m) => idNumber(m.id)),
      );
      restoredRef.current = {
        messages: saved.messages,
        conversation: restoredConversation,
      };
      setMessages(saved.messages);
    }
    setRestored(true);
  }, [updateConversation]);

  // saves every change; the answer in flight isn't saved
  useEffect(() => {
    messagesRef.current = messages;
    const restoredChat = restoredRef.current;
    // saving the restored chat again would only extend its age
    if (
      !restored ||
      (messages === restoredChat?.messages &&
        conversation === restoredChat.conversation)
    ) {
      return;
    }
    if (messages.length === 0) {
      clearSavedChat();
      return;
    }
    saveChat({ messages, ...conversation });
  }, [messages, conversation, restored]);

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

  // back from signing in with saves pending: run them once. Signed out, they
  // stay until they're too old (loadChat drops them): the user may have
  // cancelled the sign-in and try again
  const pending = conversation.pendingSaves;
  useEffect(() => {
    if (!restored || !signedIn || !pending || resumedRef.current) {
      return;
    }
    resumedRef.current = true;
    // gone from storage before any request, so a refresh can't save twice
    updateConversation((current) => ({ ...current, pendingSaves: undefined }));
    saveChatNow(messages);
    void resumeSaves(pending.saves);
    // resumeSaves only uses refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, signedIn, pending, messages, updateConversation, saveChatNow]);

  async function resumeSaves(saves: PendingSave[]) {
    const sent = saves.slice(0, MAX_PENDING_SAVES);
    const results = await Promise.allSettled(sent.map(saveTitleRequest));
    let parts: MessagePart[] = [];
    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        parts = addListSaved(parts, result.value);
      } else {
        console.error("Couldn't save a title after sign-in:", result.reason);
        failed.push(sent[i].title);
      }
    });
    // the rest aren't sent, so one sign-in makes a bounded number of requests
    failed.push(...saves.slice(MAX_PENDING_SAVES).map((save) => save.title));
    const saved = parts.filter(isListSaved);
    if (failed.length) {
      parts = appendText(
        parts,
        `Couldn't save ${failed.join(", ")} to your list. Ask me to add ${failed.length === 1 ? "it" : "them"} again.`,
      );
    }
    updateConversation((current) => ({
      ...current,
      listChanges: addListChanges(current.listChanges, saved),
    }));
    setMessages((prev) =>
      capped([...prev, { id: nextId(), role: "assistant", parts }]),
    );
    if (saved.length) {
      router.refresh();
    }
  }

  // a sign-in button was clicked: the page is about to leave for the
  // provider, so it's saved right away
  const startSignIn = useCallback<StartSignIn>(
    (saves) => {
      updateConversation((current) => ({
        ...current,
        pendingSaves: { saves, since: Date.now() },
      }));
      saveChatNow(messagesRef.current);
    },
    [updateConversation, saveChatNow],
  );

  function clearStreaming() {
    setStreamingParts([]);
    setStreamingSaves([]);
  }

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
    clearStreaming();
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
    const { interactionId, stoppedTurns, listChanges } =
      conversationRef.current;

    try {
      const request: ChatRequest = {
        content: turn.prompt,
        previousInteractionId: interactionId,
        stoppedTurns: stoppedTurns.length ? stoppedTurns : undefined,
        listChanges: listChanges.length ? listChanges : undefined,
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
            setStreamingSaves(turn.parts.filter(isListSaved));
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

      // the model has now seen the stopped turns and the list changes as part
      // of this interaction
      updateConversation((current) => ({
        ...current,
        interactionId: newInteractionId,
        stoppedTurns: [],
        listChanges: current.listChanges.filter(
          (change) => !listChanges.includes(change),
        ),
      }));
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
        updateConversation((current) => ({
          ...current,
          interactionId: undefined,
          stoppedTurns: [],
        }));
      }
      // the rest of the answer is dropped, but its saves were made: they stay
      // with their Undo, and the next request tells the model, which never
      // saw this turn
      const saves = turn.parts.filter(isListSaved);
      if (saves.length) {
        updateConversation((current) => ({
          ...current,
          listChanges: addListChanges(current.listChanges, saves),
        }));
        setMessages((prev) =>
          capped([...prev, { id: nextId(), role: "assistant", parts: saves }]),
        );
      }
    }

    turnRef.current = null;
    clearStreaming();
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
      updateConversation((current) => ({
        ...current,
        stoppedTurns: [
          ...current.stoppedTurns,
          {
            prompt: turn.prompt,
            partialText: partsToText(parts).slice(0, MAX_STOPPED_TEXT_LENGTH),
          },
        ].slice(-MAX_STOPPED_TURNS),
      }));
      const message: ChatMessage = {
        id: nextId(),
        role: "assistant",
        parts,
        stopped: true,
      };
      setMessages((prev) => capped([...prev, message]));
      if (saveNow) {
        saveChatNow(capped([...messagesRef.current, message]));
      }
    }
    clearStreaming();
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
      // a newer save of the title, also one in the answer in flight, would be
      // overwritten
      const answers = [
        ...messagesRef.current.map((m) => m.parts),
        turnRef.current?.parts ?? [],
      ];
      if (!undoableSaves(answers).has(part)) {
        return false;
      }
      try {
        await undoRequest(part);
      } catch (error) {
        console.error("Couldn't undo the list save:", error);
        return false;
      }
      updateConversation((current) => ({
        ...current,
        listChanges: addListChanges(current.listChanges, [part]),
      }));
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
    [router, updateConversation],
  );

  // starts a fresh conversation
  function reset() {
    const turn = turnRef.current;
    turn?.controller.abort();
    turnRef.current = null;
    updateConversation(() => NEW_CONVERSATION);
    clearSavedChat();
    setMessages([]);
    clearStreaming();
    setStatus("idle");
    if (turn) {
      refreshIfSaved(turn);
    }
  }

  return {
    messages,
    streamingParts,
    streamingSaves,
    status,
    send,
    stop,
    reset,
    undoSave,
    startSignIn,
  };
}
