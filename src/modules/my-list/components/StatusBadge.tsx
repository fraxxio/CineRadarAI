import { CircleCheck, Eye, NotebookPen, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { isListStatus, type ListStatus } from "../entry";

const STATUS_STYLES: Record<ListStatus, { icon: LucideIcon; color: string }> = {
  Watching: {
    icon: Eye,
    color: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  "Planning to watch": {
    icon: NotebookPen,
    color: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  Completed: {
    icon: CircleCheck,
    color: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  },
};

// rows saved before the payload was validated can have other statuses
const OTHER_STYLE = {
  icon: NotebookPen,
  color: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

type StatusBadgeProps = {
  status: string;
};

// the icon and the text carry the status, the colour only helps scanning
export default function StatusBadge({ status }: StatusBadgeProps) {
  const { icon: Icon, color } = isListStatus(status)
    ? STATUS_STYLES[status]
    : OTHER_STYLE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        color,
      )}
    >
      <Icon size={14} className="shrink-0" aria-hidden />
      {status}
    </span>
  );
}
