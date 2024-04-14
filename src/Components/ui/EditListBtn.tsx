import { Pencil } from "lucide-react";
import React from "react";

export default function EditListBtn() {
  return (
    <button className="h-10 w-full rounded-md border border-border-clr bg-dark-bg px-3 py-2 font-medium duration-200 hover:bg-primary-text hover:text-dark-bg">
      <Pencil size={16} />
    </button>
  );
}
