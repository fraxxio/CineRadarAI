"use client";

import { toast } from "sonner";

// * This component exists because sonner toast function
// * doesn't work in server components

export default function DeleteResult({ deleteAcc }: { deleteAcc: string }) {
  setTimeout(() => {
    if (deleteAcc !== undefined && deleteAcc === "success") {
      toast.success("Account deleted succesfully.", {
        style: { color: "green" },
      });
    } else if (deleteAcc !== undefined && deleteAcc === "fail") {
      toast.error("Failed to delete account.", { style: { color: "red" } });
    }
  });
  return <div></div>;
}
