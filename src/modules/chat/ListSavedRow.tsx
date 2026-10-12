import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { ListSavedPart } from "./protocol";
import { SmallPoster } from "./SmallPoster";

type ListSavedRowProps = {
  part: ListSavedPart;
  // undefined while the answer streams: Undo waits until it's finished, and
  // only the streaming row is announced, not the restored history
  onUndo?: () => Promise<boolean>;
};

// "Added to your list · Planning to watch", "Moved to Completed (was
// Watching)" or "Already in your list · Watching"
function savedLine({ entry, previous }: ListSavedPart) {
  if (previous === null) {
    return `Added to your list · ${entry.status}`;
  }
  if (previous.status === entry.status) {
    return `Already in your list · ${entry.status}`;
  }
  return `Moved to ${entry.status} (was ${previous.status})`;
}

export function ListSavedRow({ part, onUndo }: ListSavedRowProps) {
  const [undoing, setUndoing] = useState(false);
  const { entry, previous, undone } = part;
  // nothing to undo when the save changed nothing
  const changed = previous === null || previous.status !== entry.status;

  async function handleUndo() {
    if (!onUndo) {
      return;
    }
    setUndoing(true);
    if (!(await onUndo())) {
      toast.error("Something went wrong while undoing.", {
        style: { color: "red" },
      });
    }
    setUndoing(false);
  }

  return (
    <div
      aria-live={onUndo ? undefined : "polite"}
      className="flex items-center gap-3 py-1"
    >
      <SmallPoster path={entry.posterPath || entry.image || null} />
      {/* the button wraps below the text when the chat is narrow (mobile) */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* min-w-0 and break-words keep long titles from widening the chat */}
        <div className="min-w-0 flex-shrink flex-grow basis-48">
          <p className="break-words font-medium">
            <Link href={`/search/${entry.type}/${entry.id}`}>
              {entry.title}
            </Link>
          </p>
          <p
            className={`flex items-center gap-1 text-sm text-secondary-text ${undone ? "line-through" : ""}`}
          >
            {changed && <Check size={14} className="shrink-0" aria-hidden />}
            {savedLine(part)}
          </p>
        </div>
        {undone ? (
          <span className="text-sm text-secondary-text">Undone</span>
        ) : (
          changed &&
          onUndo && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoing}
              aria-label={`Undo ${entry.title}`}
              className="shrink-0 rounded-md border border-border-clr bg-dark-bg px-3 py-1 text-sm font-medium duration-200 enabled:hover:bg-primary-text enabled:hover:text-dark-bg disabled:text-slate-500"
            >
              {undoing ? "Undoing..." : "Undo"}
            </button>
          )
        )}
      </div>
    </div>
  );
}
