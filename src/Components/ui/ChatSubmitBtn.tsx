import { LoaderCircle, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatSubmitBtnProps = {
  isLoading: boolean;
  disabled: boolean;
};

export function ChatSubmitBtn({ isLoading, disabled }: ChatSubmitBtnProps) {
  return (
    <button
      disabled={isLoading || disabled}
      className={cn(
        "flex h-[40px] items-center gap-1 rounded-br-md rounded-tr-md border-b border-r border-t border-border-clr bg-dark-bg px-2 font-medium duration-200",
        !isLoading &&
          "hover:cursor-pointer hover:bg-primary-text hover:text-dark-bg",
      )}
    >
      {isLoading ? (
        <>
          <LoaderCircle size={16} className="animate-spin" />
          Generating...
        </>
      ) : (
        <>
          Submit
          <SendHorizontal size={16} />
        </>
      )}
    </button>
  );
}
