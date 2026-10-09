import { Loader } from "lucide-react";
import { ElapsedTime } from "./ElapsedTime";
import { isToolRunning } from "./messageParts";
import type { ToolPart } from "./protocol";

type ToolCallLineProps = {
  part: ToolPart;
};

// e.g. "⟳ Checking title details... (3x) - 14s"; the spinner only while running
export function ToolCallLine({ part }: ToolCallLineProps) {
  const running = isToolRunning(part);
  const count = part.callIds.length;

  return (
    // a finished line is plain text, so role="status" finds live loaders only;
    // the line height doesn't change when the icon goes
    <p
      role={running ? "status" : undefined}
      className="flex items-center gap-2 leading-6 text-secondary-text"
    >
      {running && (
        <Loader
          size={16}
          className="shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      )}
      <span>
        {part.label}
        {count > 1 && ` (${count}x)`}
        <span aria-hidden> - </span>
        <ElapsedTime
          elapsedMs={part.elapsedMs}
          runningSince={part.runningSince}
        />
      </span>
    </p>
  );
}
