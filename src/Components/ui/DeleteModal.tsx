import { DeleteUser } from "@/app/actions";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./Modal";
import { useState } from "react";
import DeleteModalBtn from "./DeleteModalBtn";

export default function DeleteModal({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger className="mt-3 flex w-full items-center justify-center gap-1 rounded-md duration-300 hover:bg-red-700 hover:text-dark-bg">
          Delete my account
          <Trash2 size={18} />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">Are you sure?</DialogTitle>
            <DialogDescription>
              <span className="text-base">
                If you delete your account it will be deleted permamently and
                your movie/TV show list will be lost.
              </span>
            </DialogDescription>
          </DialogHeader>
          <form action={DeleteUser}>
            <label htmlFor="check">
              To permamently delete your account type "Delete account" and click
              Delete.
            </label>
            <input
              id="check"
              name="verifyInput"
              required
              className="mt-5 w-[80%] rounded-sm border border-border-clr bg-dark-bg p-1 placeholder-primary-text placeholder-opacity-45 outline-none focus:border-transparent focus:ring focus:ring-primary-text"
            />
            <input type="hidden" name="id" value={id} />
            <DeleteModalBtn setIsOpen={setIsOpen} />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
