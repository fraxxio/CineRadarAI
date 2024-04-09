"use client";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";

// TODO hit api route that handles adding movie or not and return result success or not and activate toast notif
type hAddToListProps = {
  id: number;
  isLoaded: boolean;
  userId: string | null | undefined;
  sessionId: string | null | undefined;
};

async function hAddToList({
  id,
  isLoaded,
  userId,
  sessionId,
}: hAddToListProps) {
  if (!isLoaded || !userId) {
    toast.warning("Failed to add", {
      description: "You need to be logged in!",
      style: {
        color: "red",
      },
    });
    return null;
  }

  const response = await fetch("http://localhost:3000/api/add-to-list", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      id: id.toString(),
    },
  });
}

export default function AddToListBtn({
  fullSize,
  id,
}: {
  fullSize?: boolean;
  id: number;
}) {
  return (
    <button
      // onClick={() => hAddToList({ id, isLoaded, userId, sessionId })}
      className={`${fullSize ? "mt-6 block py-1" : "absolute right-2 top-2 border border-border-clr bg-primary-bg p-2 hover:pl-24 [&_span]:pointer-events-none [&_span]:opacity-0 [&_span]:hover:opacity-100 [&_span]:hover:duration-200"} flex items-center gap-2 rounded-md duration-200 hover:bg-primary-text hover:text-primary-bg`}
    >
      <div
        className={`relative ${fullSize && "flex flex-row-reverse items-center gap-2"}`}
      >
        <span
          className={`${fullSize ? "pr-1" : "absolute right-6 top-0 w-[6rem] text-primary-bg"}`}
        >
          Add to list
        </span>
        <BookmarkPlus />
      </div>
    </button>
  );
}
