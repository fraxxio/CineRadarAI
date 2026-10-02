"use client";
import { BookmarkPlus, LoaderCircle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/Modal";
import StatusSelect from "./StatusSelect";
import RatingSelect from "./RatingSelect";
import type { ListStatus } from "../entry";
import type { MediaType } from "@/infra/tmdb";
import { FormEvent, useState } from "react";

const COPY = {
  add: {
    title: "Choose options to add to the list.",
    submit: "Add to list",
    loading: "Adding...",
    success: (title: string) => `${title} was added to the list.`,
    error: "Something went wrong while adding to the list.",
  },
  edit: {
    title: "Edit the list",
    submit: "Edit",
    loading: "Editing...",
    success: (title: string) => `${title} was updated.`,
    error: "Something went wrong while editing the list.",
  },
};

type ListEntryDialogProps = {
  // add: from search results and details pages; edit: from the list itself
  mode: "add" | "edit";
  signedIn: boolean;
  // add mode only: a full-width trigger instead of the card corner button
  fullSize?: boolean;
  movieId: number;
  title: string;
  image: string;
  type: MediaType;
};

export default function ListEntryDialog({
  mode,
  signedIn,
  fullSize,
  movieId,
  title,
  image,
  type,
}: ListEntryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ListStatus | "">("");
  const [rating, setRating] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const copy = COPY[mode];

  async function hSaveEntry(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (!signedIn) {
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
        },
        body: JSON.stringify({
          movieId: movieId.toString(),
          title: title,
          image: image,
          status: status,
          rating: rating,
          type: type,
        }),
      });
      const data = await response.json();
      if (data.addToListResult === "success") {
        toast.success(copy.success(title), {
          style: { color: "green" },
        });
      } else {
        toast.error(copy.error, {
          style: { color: "red" },
        });
      }
    } catch (error) {
      console.error("/api/add-to-list ERROR:", error);
      toast.error(copy.error, {
        style: { color: "red" },
      });
    } finally {
      setLoading(false);
      setIsOpen(false);
      setStatus("");
      setRating("");
      // the list page shows the entry, so it needs the new data
      if (mode === "edit") {
        router.refresh();
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {mode === "add" ? (
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
      ) : (
        <DialogTrigger
          aria-label="Edit list entry"
          className="h-10 w-10 rounded-md border border-border-clr bg-dark-bg px-3 py-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg max-[840px]:h-7 max-[840px]:w-7 max-[840px]:p-1"
        >
          <Pencil size={16} />
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="max-w-[85%] text-2xl">
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            <span className="text-base">
              Select the status and add rating if you wish.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-8" onSubmit={hSaveEntry}>
          <div className="flex flex-col">
            <label htmlFor="status">Status:</label>
            <StatusSelect status={status} setStatus={setStatus} />
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
                {copy.loading}
              </p>
            ) : (
              <p>{copy.submit}</p>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
