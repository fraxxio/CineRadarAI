"use client";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type BtnProps = {
  searchTarget: string;
  children: React.ReactNode;
};

const SubmitBtn = (
  { searchTarget, children }: BtnProps,
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) => {
  const { pending } = useFormStatus();

  return (
    <button
      name="btn"
      value={searchTarget}
      type="submit"
      disabled={pending}
      {...props}
      className="w-full rounded-sm border-2 border-primary-text bg-primary-text p-2 text-sm font-medium text-primary-bg duration-300 hover:bg-primary-bg hover:text-primary-text disabled:bg-slate-700"
    >
      {pending ? (
        <p className="flex items-center justify-center gap-2">
          <span className="animate-spin">
            <LoaderCircle size={18} />
          </span>
          Generating...
        </p>
      ) : (
        children
      )}
    </button>
  );
};

export default SubmitBtn;
