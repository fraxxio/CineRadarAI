"use client";
import { LoaderCircle } from "lucide-react";
import React from "react";
import { useFormStatus } from "react-dom";

const SubmitBtn = () => {
  const { pending } = useFormStatus();
  return (
    <button
      type='submit'
      aria-disabled={pending}
      className='bg-primary-text rounded-sm w-fit text-primary-bg font-medium py-2 px-4 mx-auto border-2 border-primary-text hover:bg-primary-bg hover:text-primary-text duration-300'
    >
      {pending ? (
        <p className='flex items-center gap-2'>
          <span className='animate-spin'>
            <LoaderCircle size={18} />
          </span>
          Generating...
        </p>
      ) : (
        "Generate recommendations"
      )}
    </button>
  );
};

export default SubmitBtn;
