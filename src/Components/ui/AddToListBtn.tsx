"use client";
import { BookmarkPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Modal";
import ListTypeSelect from "./ListTypeSelect";
import RatingSelect from "./RatingSelect";
import { FormEvent, useState } from "react";

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
  type: "movie" | "tv";
};

export default function AddToListBtn({
  user,
  fullSize,
  movieId,
  title,
  image,
  type,
}: AddToListBtnProps) {
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function hAddToList(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (user === undefined) {
      toast.warning("Failed to add", {
        description: "You need to be logged in!",
        style: {
          color: "red",
        },
      });
      setLoading(false);
      setIsOpen(false);
      return null;
    }

    try {
      const response = await fetch("/api/add-to-list", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          userId: user.id.toString(),
          movieId: movieId.toString(),
          title: title,
          image: image,
          status: status,
          rating: rating,
          type: type,
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
      toast.error("Something went wrong while adding to the list.", {
        style: { color: "red" },
      });
    } finally {
      setLoading(false);
      setIsOpen(false);
      setStatus("");
      setRating("");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
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
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="max-w-[85%] text-2xl">
            Choose options to add to the list.
          </DialogTitle>
          <DialogDescription>
            <span className="text-base">
              Select the status and add rating if you wish.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-8" onSubmit={hAddToList}>
          <div className="flex flex-col">
            <label htmlFor="status">Status:</label>
            <ListTypeSelect status={status} setStatus={setStatus} />
          </div>
          <div className="flex flex-col">
            <label htmlFor="rating">Rating (optional):</label>
            <RatingSelect rating={rating} setRating={setRating} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-sm bg-primary-text px-3 py-2 text-dark-bg duration-200 hover:bg-secondary-text disabled:bg-secondary-text"
          >
            {loading ? (
              <p className="flex items-center justify-center gap-2">
                <span className="animate-spin">
                  <LoaderCircle size={18} />
                </span>
                Adding...
              </p>
            ) : (
              <p>Add to list</p>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
