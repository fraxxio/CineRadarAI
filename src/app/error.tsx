"use client";

import { TriangleAlert } from "lucide-react";

export default function error() {
  return (
    <main className="container mt-40 w-fit rounded-sm border border-border-clr bg-primary-bg p-12 text-center text-red-700">
      <TriangleAlert size={40} className="mx-auto" />
      <h1 className="text-4xl font-semibold">Error</h1>
      <p>An unexpected error occured.</p>
    </main>
  );
}
