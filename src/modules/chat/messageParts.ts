// builds an assistant message from stream events; pure, never mutates its
// input (it feeds React state), `now` is the client clock in ms
import type { MessagePart, ToolPart } from "./protocol";

type ToolStart = { id: string; name: string; text: string };

// adds to the last part if it's text, otherwise starts a new text part
export function appendText(parts: MessagePart[], text: string): MessagePart[] {
  const last = parts.at(-1);
  if (last?.type === "text") {
    return [...parts.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...parts, { type: "text", text }];
}

// merges into the line of the same tool in the current tool block (the parts
// after the last text part), otherwise adds a new line
export function startTool(
  parts: MessagePart[],
  { id, name, text }: ToolStart,
  now: number,
): MessagePart[] {
  const blockStart = parts.findLastIndex((part) => part.type === "text") + 1;
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
      default:
        part satisfies never;
    }
  }
  return texts.join("\n\n");
}

export const isToolRunning = (part: ToolPart) => part.runningIds.length > 0;

// the tools are done and the model is reading their results
export function lastPartIsFinishedTool(parts: MessagePart[]): boolean {
  const last = parts.at(-1);
  return last?.type === "tool" && !isToolRunning(last);
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

const pause = (part: ToolPart, now: number): ToolPart => ({
  ...part,
  elapsedMs: part.elapsedMs + now - (part.runningSince ?? now),
  runningSince: undefined,
});
