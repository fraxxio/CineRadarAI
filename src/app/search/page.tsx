import Filters from "@/Components/Filters";
import React from "react";

export default function page() {
  return (
    <main className='container flex flex-col justify-between gap-20 py-20'>
      <Filters />
    </main>
  );
}
