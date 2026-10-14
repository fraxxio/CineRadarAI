// keeps the chat for the browser-tab session: it survives refreshes,
// navigation and the OAuth round trip, and goes when the tab closes; every
// call fails soft (storage can be disabled, full or blocked), the chat then
// just isn't kept
import { isListStatus, type EntryKey } from "@/modules/my-list";
import type {
  ChatMessage,
  MessagePart,
  PendingSave,
  PreviousEntry,
  RecommendedTitle,
  SavedEntry,
  StoppedTurn,
} from "./protocol";

const STORAGE_KEY = "cineradar.chat.v1";
const VERSION = 1;
// Gemini keeps interactions for 1 day on the free tier, so a saved chat
// expires before its interaction does
export const MAX_SAVED_CHAT_AGE_MS = 20 * 60 * 60 * 1000;
// older saves aren't what the user just signed in for
export const PENDING_SAVE_MAX_AGE_MS = 15 * 60 * 1000;

// titles a signed-out user asked to save, kept from their click on a sign-in
// button until they're back signed in
export type PendingSaves = {
  saves: PendingSave[];
  // when the sign-in started
  since: number;
};

// new optional fields don't need a version bump, changing one does
export type SavedChat = {
  version: typeof VERSION;
  savedAt: number;
  messages: ChatMessage[];
  // last completed turn
  interactionId?: string;
  stoppedTurns: StoppedTurn[];
  // list entries changed outside the model since the last completed turn
  listChanges?: EntryKey[];
  pendingSaves?: PendingSaves;
};

export type ChatSnapshot = Omit<SavedChat, "version" | "savedAt">;

// null when nothing usable is saved; a broken, old or outdated blob is
// removed, and pending saves that are too old are left out
export function loadChat(): SavedChat | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Couldn't read the saved chat:", error);
    return null;
  }
  if (raw === null) {
    return null;
  }

  let chat: unknown;
  try {
    chat = JSON.parse(raw);
  } catch {
    chat = null;
  }
  if (!isSavedChat(chat) || Date.now() - chat.savedAt > MAX_SAVED_CHAT_AGE_MS) {
    clearSavedChat();
    return null;
  }
  if (
    chat.pendingSaves &&
    Date.now() - chat.pendingSaves.since > PENDING_SAVE_MAX_AGE_MS
  ) {
    return { ...chat, pendingSaves: undefined };
  }
  return chat;
}

export function saveChat(chat: ChatSnapshot) {
  const saved: SavedChat = { ...chat, version: VERSION, savedAt: Date.now() };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (error) {
    console.warn("Couldn't save the chat:", error);
  }
}

export function clearSavedChat() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Couldn't clear the saved chat:", error);
  }
}

// a hand-written check, client code doesn't ship zod; anything unexpected
// throws the whole blob away rather than repairing it, e.g. a card without
// genres would crash the render
function isSavedChat(value: unknown): value is SavedChat {
  return (
    isObject(value) &&
    value.version === VERSION &&
    typeof value.savedAt === "number" &&
    isArrayOf(value.messages, isMessage) &&
    (value.interactionId === undefined ||
      typeof value.interactionId === "string") &&
    isArrayOf(value.stoppedTurns, isStoppedTurn) &&
    (value.listChanges === undefined ||
      isArrayOf(value.listChanges, isEntryKey)) &&
    (value.pendingSaves === undefined || isPendingSaves(value.pendingSaves))
  );
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    isArrayOf(value.parts, isPart) &&
    (value.stopped === undefined || typeof value.stopped === "boolean")
  );
}

function isPart(value: unknown): value is MessagePart {
  if (!isObject(value)) {
    return false;
  }
  const part = value as Partial<MessagePart>;
  switch (part.type) {
    case "text":
      return typeof part.text === "string";
    // only finished lines are saved, a running one would never stop
    case "tool":
      return (
        typeof part.name === "string" &&
        typeof part.label === "string" &&
        isArrayOf(part.callIds, isString) &&
        Array.isArray(part.runningIds) &&
        part.runningIds.length === 0 &&
        typeof part.elapsedMs === "number" &&
        part.runningSince === undefined
      );
    case "cards":
      return isArrayOf(part.items, isCard);
    case "list_saved":
      return (
        isSavedEntry(part.entry) &&
        (part.previous === null || isPreviousEntry(part.previous)) &&
        (part.undone === undefined || typeof part.undone === "boolean")
      );
    case "sign_in":
      return isArrayOf(part.saves, isPendingSave);
    case undefined:
      return false;
    default:
      // a new part type needs a check here
      part satisfies never;
      return false;
  }
}

function isCard(value: unknown): value is RecommendedTitle {
  return (
    isObject(value) &&
    isMediaType(value.type) &&
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    isNumberOrNull(value.year) &&
    isNumberOrNull(value.rating) &&
    isArrayOf(value.genres, isString) &&
    isStringOrNull(value.posterPath) &&
    isStringOrNull(value.backdropPath) &&
    typeof value.reason === "string"
  );
}

function isSavedEntry(value: unknown): value is SavedEntry {
  return (
    isObject(value) &&
    isMediaType(value.type) &&
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    isStringOrNull(value.posterPath) &&
    typeof value.image === "string" &&
    isString(value.status) &&
    isListStatus(value.status)
  );
}

// the status can be a legacy one, see StoredEntry
function isPreviousEntry(value: unknown): value is PreviousEntry {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    typeof value.image === "string" &&
    typeof value.status === "string" &&
    typeof value.rating === "number"
  );
}

function isPendingSave(value: unknown): value is PendingSave {
  return (
    isObject(value) &&
    isMediaType(value.type) &&
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    isStringOrNull(value.posterPath) &&
    (value.status === null ||
      (isString(value.status) && isListStatus(value.status)))
  );
}

function isPendingSaves(value: unknown): value is PendingSaves {
  return (
    isObject(value) &&
    isArrayOf(value.saves, isPendingSave) &&
    typeof value.since === "number"
  );
}

function isEntryKey(value: unknown): value is EntryKey {
  return (
    isObject(value) &&
    typeof value.movieId === "number" &&
    isMediaType(value.type)
  );
}

function isStoppedTurn(value: unknown): value is StoppedTurn {
  return (
    isObject(value) &&
    typeof value.prompt === "string" &&
    typeof value.partialText === "string"
  );
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isArrayOf = <T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] => Array.isArray(value) && value.every(isItem);

const isString = (value: unknown): value is string => typeof value === "string";

const isMediaType = (value: unknown) => value === "movie" || value === "tv";

const isStringOrNull = (value: unknown) => value === null || isString(value);

const isNumberOrNull = (value: unknown) =>
  value === null || typeof value === "number";
