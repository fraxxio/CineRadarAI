import { Trash2 } from "lucide-react";
import React from "react";

export default function DeleteListBtn() {
  return (
    <button className="h-10 rounded-md border border-border-clr bg-dark-bg px-3 py-2 font-medium duration-200 hover:bg-red-700 hover:text-dark-bg">
      <Trash2 size={16} />
    </button>
  );
}
