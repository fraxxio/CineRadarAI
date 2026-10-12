// builds an assistant message from stream events; pure, never mutates its
// input (it feeds React state), `now` is the client clock in ms
import { isListStatus, type ListStatus } from "@/modules/my-list";
import type { MediaType } from "@/infra/tmdb";
import type {
  ListSavedPart,
  MessagePart,
  PendingSave,
  RecommendedTitle,
  ToolPart,
} from "./protocol";

type ToolStart = { id: string; name: string; text: string };

// adds to the last part if it's text, otherwise starts a new text part
export function appendText(parts: MessagePart[], text: string): MessagePart[] {
  const last = parts.at(-1);
  if (last?.type === "text") {
    return [...parts.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...parts, { type: "text", text }];
}

// each show_recommendations result is a part of its own
export function addCards(
  parts: MessagePart[],
  items: RecommendedTitle[],
): MessagePart[] {
  return [...parts, { type: "cards", items }];
}

// each save is a row of its own
export function addListSaved(
  parts: MessagePart[],
  { entry, previous }: Pick<ListSavedPart, "entry" | "previous">,
): MessagePart[] {
  return [...parts, { type: "list_saved", entry, previous }];
}

// one sign-in card per answer, wherever its first save arrived; a title
// already on it isn't added again
export function addSignIn(
  parts: MessagePart[],
  save: PendingSave,
): MessagePart[] {
  const index = parts.findIndex((part) => part.type === "sign_in");
  if (index === -1) {
    return [...parts, { type: "sign_in", saves: [save] }];
  }
  return parts.map((part, i) =>
    i === index &&
    part.type === "sign_in" &&
    !part.saves.some((s) => s.type === save.type && s.id === save.id)
      ? { ...part, saves: [...part.saves, save] }
      : part,
  );
}

// merges into the line of the same tool in the current tool block (the parts
// after the last text or cards part), otherwise adds a new line
export function startTool(
  parts: MessagePart[],
  { id, name, text }: ToolStart,
  now: number,
): MessagePart[] {
  const blockStart = parts.findLastIndex((part) => part.type !== "tool") + 1;
  const index = parts.findIndex(
    (part, i) => i >= blockStart && part.type === "tool" && part.name === name,
  );
  if (index === -1) {
    return [
      ...parts,
      {
        type: "tool",
        name,
        label: text,
        callIds: [id],
        runningIds: [id],
        elapsedMs: 0,
        runningSince: now,
      },
    ];
  }
  return updateTool(parts, index, (part) => ({
    ...part,
    callIds: [...part.callIds, id],
    runningIds: [...part.runningIds, id],
    runningSince: part.runningSince ?? now,
  }));
}

// the line pauses once all its calls have ended; an unknown id changes nothing
export function endTool(
  parts: MessagePart[],
  id: string,
  now: number,
): MessagePart[] {
  const index = parts.findIndex(
    (part) => part.type === "tool" && part.runningIds.includes(id),
  );
  if (index === -1) {
    return parts;
  }
  return updateTool(parts, index, (part) => {
    const runningIds = part.runningIds.filter((running) => running !== id);
    return runningIds.length > 0
      ? { ...part, runningIds }
      : { ...pause(part, now), runningIds };
  });
}

// the turn was stopped: running lines keep the time they have so far
export function stopTools(parts: MessagePart[], now: number): MessagePart[] {
  return parts.map((part) =>
    part.type === "tool" && isToolRunning(part)
      ? { ...pause(part, now), runningIds: [] }
      : part,
  );
}

// what the model sees of a stopped answer
export function partsToText(parts: MessagePart[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    switch (part.type) {
      case "text":
        texts.push(part.text);
        break;
      case "tool":
        break;
      // the reasons are left out: the note stays short and doesn't look like
      // a list the model might copy
      case "cards":
        texts.push(`[Shown as cards: ${part.items.map(cardNote).join("; ")}]`);
        break;
      case "list_saved":
        texts.push(
          `[Saved to list: ${titleNote(part.entry)} as ${part.entry.status}]` +
            (part.undone ? " (undone)" : ""),
        );
        break;
      case "sign_in":
        texts.push(
          `[Asked to sign in to save: ${part.saves.map(titleNote).join("; ")}]`,
        );
        break;
      default:
        part satisfies never;
    }
  }
  return texts.join("\n\n");
}

export const isToolRunning = (part: ToolPart) => part.runningIds.length > 0;

// nothing has arrived yet, or the tools are done (or their cards, saves or
// sign-in card are shown) and the model is working on its next round
export function isWaitingForModel(parts: MessagePart[]): boolean {
  const last = parts.at(-1);
  return (
    last === undefined ||
    last.type === "cards" ||
    last.type === "list_saved" ||
    last.type === "sign_in" ||
    (last.type === "tool" && !isToolRunning(last))
  );
}

// movie and TV ids can collide: "movie-228150"
export const listKey = (type: MediaType, id: number) => `${type}-${id}`;

export type ListStatuses = ReadonlyMap<string, ListStatus | null>;

// each title's list status after the chat's saves, by listKey, newest wins;
// null: not in the list (an add that was undone). Titles the chat didn't
// save, or whose status before an undone save is a legacy one, aren't in it
export function listStatuses(answers: MessagePart[][]): ListStatuses {
  const statuses = new Map<string, ListStatus | null>();
  for (const part of answers.flat()) {
    if (part.type !== "list_saved") {
      continue;
    }
    const key = listKey(part.entry.type, part.entry.id);
    if (!part.undone) {
      statuses.set(key, part.entry.status);
    } else if (part.previous === null) {
      statuses.set(key, null);
    } else if (isListStatus(part.previous.status)) {
      statuses.set(key, part.previous.status);
    } else {
      statuses.delete(key);
    }
  }
  return statuses;
}

// rounds down, so a time never shows a unit it hasn't reached ("9.9s", not
// "10.0s"): "2.4s", "14s", "1m 05s"
export function formatElapsed(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  if (tenths < 100) {
    return `${(tenths / 10).toFixed(1)}s`;
  }
  const seconds = Math.floor(tenths / 10);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const rest = String(seconds % 60).padStart(2, "0");
  return `${Math.floor(seconds / 60)}m ${rest}s`;
}

function updateTool(
  parts: MessagePart[],
  index: number,
  update: (part: ToolPart) => ToolPart,
): MessagePart[] {
  return parts.map((part, i) =>
    i === index && part.type === "tool" ? update(part) : part,
  );
}

// "1. Fury (movie 228150, 2014)"
const cardNote = ({ title, type, id, year }: RecommendedTitle, index: number) =>
  `${index + 1}. ${title} (${type} ${id}, ${year ?? "unknown year"})`;

// "Fury (movie 228150)"
const titleNote = ({
  title,
  type,
  id,
}: Pick<PendingSave, "title" | "type" | "id">) => `${title} (${type} ${id})`;

const pause = (part: ToolPart, now: number): ToolPart => ({
  ...part,
  elapsedMs: part.elapsedMs + now - (part.runningSince ?? now),
  runningSince: undefined,
});
