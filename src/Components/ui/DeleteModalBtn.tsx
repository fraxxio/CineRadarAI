import { LoaderCircle, Trash2 } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

type DeleteModalBtnProps = {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

export default function DeleteModalBtn({ setIsOpen }: DeleteModalBtnProps) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  // close once the action has finished, not on click: a blocked submit
  // (empty required input) never starts it
  useEffect(() => {
    if (wasPending.current && !pending) {
      setIsOpen(false);
    }
    wasPending.current = pending;
  }, [pending, setIsOpen]);

  return (
    <button
      type="submit"
      className="mt-4 flex items-center gap-1 rounded-sm bg-red-700 px-3 py-1 text-lg font-medium text-dark-bg duration-200 hover:bg-red-800 disabled:bg-red-900"
      disabled={pending}
    >
      {pending ? (
        <>
          Deleting... <LoaderCircle className="animate-spin" size={18} />
        </>
      ) : (
        <>
          Delete <Trash2 size={18} />
        </>
      )}
    </button>
  );
}
