"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import SubmitBtn from "./SubmitBtn";
import { buildSearchURL } from "../buildSearchURL";

export default function FiltersForm({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name === "btn") {
      formData.set("btn", submitter.value);
    }
    const url = buildSearchURL(Object.fromEntries(formData.entries()));
    startTransition(() => router.push(url));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 max-lg:items-center"
    >
      {children}
      <div className="flex flex-col items-center gap-2 pt-4 max-[480px]:w-full">
        <SubmitBtn searchTarget="movie" pending={isPending}>
          Search movies
        </SubmitBtn>
        <p className="text-lg font-medium">or</p>
        <SubmitBtn searchTarget="tv" pending={isPending}>
          Search TV shows
        </SubmitBtn>
      </div>
    </form>
  );
}
