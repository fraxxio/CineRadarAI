"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// * This component exists because sonner toast function
// * doesn't work in server components

export default function DeleteResult({ deleteAcc }: { deleteAcc: string }) {
  // an effect, not render: re-renders (and StrictMode) must not repeat the toast
  useEffect(() => {
    // deferred so the Toaster has subscribed first
    const timer = setTimeout(() => {
      if (deleteAcc === "success") {
        toast.success("Account deleted succesfully.", {
          style: { color: "green" },
        });
      } else if (deleteAcc === "fail") {
        toast.error("Failed to delete account.", { style: { color: "red" } });
      }
    });
    return () => clearTimeout(timer);
  }, [deleteAcc]);

  return <div></div>;
}
