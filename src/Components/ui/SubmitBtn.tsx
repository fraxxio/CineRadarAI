"use client";
import { LoaderCircle } from "lucide-react";
import React from "react";
import { useFormStatus } from "react-dom";

type BtnProps = {
  text: string;
  searchTarget: string;
};

const SubmitBtn = ({ text, searchTarget }: BtnProps) => {
  const { pending } = useFormStatus();
  return (
    <button
      name='btn'
      value={searchTarget}
      type='submit'
      aria-disabled={pending}
      className='bg-primary-text rounded-sm w-fit text-primary-bg font-medium p-2 border-2 border-primary-text hover:bg-primary-bg hover:text-primary-text duration-300 text-sm'
    >
      {pending ? (
        <p className='flex items-center gap-2'>
          <span className='animate-spin'>
            <LoaderCircle size={18} />
          </span>
          Generating...
        </p>
      ) : (
        text
      )}
    </button>
  );
};

export default SubmitBtn;
