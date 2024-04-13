"use client";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";

type AddToListBtnProps = {
  user:
    | {
        id: string;
        name: string;
        email: string;
        image: string;
      }
    | undefined;
  fullSize?: boolean;
  movieId: number;
  title: string;
  image: string;
};

async function hAddToList({ user, movieId, title, image }: AddToListBtnProps) {
  if (user === undefined) {
    toast.warning("Failed to add", {
      description: "You need to be logged in!",
      style: {
        color: "red",
      },
    });
    return null;
  }

  try {
    const response = await fetch("http://localhost:3000/api/add-to-list", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        userId: user.id.toString(),
        movieId: movieId.toString(),
        title: title,
        image: image,
      },
    });
    const data = await response.json();
    if (data.addToListResult === "success") {
      toast.success(`${title} was added to the list.`, {
        style: { color: "green" },
      });
    } else {
      toast.error("Something went wrong while adding to the list.", {
        style: { color: "red" },
      });
    }
  } catch (error) {
    console.error(error);
  }
}

export default function AddToListBtn({
  user,
  fullSize,
  movieId,
  title,
  image,
}: AddToListBtnProps) {
  return (
    <button
      onClick={() => hAddToList({ user, movieId, title, image })}
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
