"use client";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { FormEvent, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Modal";
import { toast } from "sonner";

type DeleteListBtnProps = {
  userId: string;
  movieId: number;
  title: string;
};

export default function DeleteListBtn({
  userId,
  movieId,
  title,
}: DeleteListBtnProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function hRemoveFromList(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (userId === undefined) {
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
      const response = await fetch(
        "http://localhost:3000/api/remove-from-list",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            userId: userId,
            movieId: movieId.toString(),
            redirect: "true",
          },
        },
      );
      const data = await response.json();
      if (data.addToListResult === "success") {
        toast.success(`${title} was removed.`, {
          style: { color: "green" },
        });
      } else {
        toast.error("Something went wrong while removing.", {
          style: { color: "red" },
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while removing.", {
        style: { color: "red" },
      });
    } finally {
      setLoading(false);
      setIsOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="h-10 w-10 rounded-md border border-border-clr bg-dark-bg px-3 py-2 font-medium duration-200 hover:bg-red-700 hover:text-dark-bg max-[840px]:h-7 max-[840px]:w-7 max-[840px]:p-1">
        <Trash2 size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="max-w-[85%] text-2xl">
            Remove from list
          </DialogTitle>
          <DialogDescription>
            <span className="text-base">
              Are you sure you want to remove <b>{title}</b> from your list?
            </span>
          </DialogDescription>
        </DialogHeader>
        <button
          onClick={hRemoveFromList}
          disabled={loading}
          className="mt-5 flex max-w-[15rem] items-center justify-center gap-2 rounded-sm bg-red-700 px-3 py-2 text-dark-bg duration-200 hover:bg-red-800 disabled:bg-red-800"
        >
          {loading ? (
            <p className="flex items-center justify-center gap-2">
              <span className="animate-spin">
                <LoaderCircle size={18} />
              </span>
              Removing...
            </p>
          ) : (
            <>
              <Trash2 />
              <p>Remove</p>
            </>
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
