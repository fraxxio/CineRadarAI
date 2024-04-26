"use client";
import { LoaderCircle, Pencil } from "lucide-react";
import React, { FormEvent, useState } from "react";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type EditListBtnProps = {
  user:
    | {
        id: string;
        name: string;
        email: string;
        image: string;
      }
    | undefined;
  movieId: number;
  title: string;
  image: string;
  type: string;
};

export default function EditListBtn({
  user,
  movieId,
  title,
  image,
  type,
}: EditListBtnProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      const response = await fetch("api/add-to-list", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          userId: user.id.toString(),
          movieId: movieId.toString(),
          title: title,
          image: image,
          status: status,
          rating: rating,
          redirect: "true",
          type: type,
        },
      });
      const data = await response.json();
      if (data.addToListResult === "success") {
        toast.success(`${title} was updated.`, {
          style: { color: "green" },
        });
      } else {
        toast.error("Something went wrong while editing the list.", {
          style: { color: "red" },
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while editing the list.", {
        style: { color: "red" },
      });
    } finally {
      setLoading(false);
      setIsOpen(false);
      setStatus("");
      setRating("");
      router.refresh();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="h-10 w-10 rounded-md border border-border-clr bg-dark-bg px-3 py-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg max-[840px]:h-7 max-[840px]:w-7 max-[840px]:p-1">
        <Pencil size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="max-w-[85%] text-2xl">
            Edit the list
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
                Editing...
              </p>
            ) : (
              <p>Edit</p>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
