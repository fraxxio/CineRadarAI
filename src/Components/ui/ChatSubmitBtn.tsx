import { SendHorizontal, Square } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type ChatSubmitBtnProps = {
  isBusy: boolean;
  disabled: boolean;
  onStop: () => void;
};

const btnClassName =
  "flex h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200";
const hoverClassName =
  "hover:cursor-pointer hover:bg-primary-text hover:text-dark-bg";

export function ChatSubmitBtn({
  isBusy,
  disabled,
  onStop,
}: ChatSubmitBtnProps) {
  // separate keys: React must not turn the clicked Stop button into a submit
  // button before the click finishes, or the form would be submitted again
  return isBusy ? (
    <button
      key="stop"
      type="button"
      onClick={onStop}
      className={cn(btnClassName, hoverClassName)}
    >
      Stop
      <Square size={14} className="fill-current" />
    </button>
  ) : (
    <button
      key="submit"
      type="submit"
      disabled={disabled}
      className={cn(btnClassName, !disabled && hoverClassName)}
    >
      Submit
      <SendHorizontal size={16} />
    </button>
  );
}
