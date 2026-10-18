"use client";
import { useState } from "react";
import { toast } from "sonner";
import { updateEntryRating, updateEntryStatus } from "../actions";
import { LIST_STATUSES, isListStatus, type EntryKey } from "../entry";
import type { ListStatusFilter } from "../view";

type RowEditorProps = {
  entryKey: EntryKey;
  title: string;
  status: string;
  rating: number; // 0 = not rated
  // the open tab: a status change on a status tab moves the row out of it
  tab: ListStatusFilter;
};

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ERROR_TEXT = "Something went wrong while saving.";

const selectClass =
  "h-10 rounded-md border border-border-clr bg-dark-bg px-2 text-sm outline-1 outline-primary-text duration-200 focus:outline disabled:opacity-60";
const optionClass = "bg-primary-text text-primary-bg";

const slugOf = (status: string) =>
  LIST_STATUSES.find(({ value }) => value === status)?.slug ?? "other";

export default function RowEditor({
  entryKey,
  title,
  status,
  rating,
  tab,
}: RowEditorProps) {
  // shown values: they change on select and roll back on failure. The saved
  // props replace them when the revalidated page arrives
  const [shown, setShown] = useState({ status, rating });
  const [saved, setSaved] = useState({ status, rating });
  if (saved.status !== status || saved.rating !== rating) {
    setSaved({ status, rating });
    setShown({ status, rating });
  }
  // plain state, not useTransition: React 18.2 (tests, types) can't keep a
  // transition pending across an await
  const [pending, setPending] = useState(false);

  async function save(
    changes: { status: string } | { rating: number },
    action: () => Promise<{ ok: boolean }>,
    success: string,
  ) {
    const previous = shown;
    setShown({ ...shown, ...changes });
    setPending(true);
    let ok = false;
    try {
      ({ ok } = await action());
    } catch (error) {
      console.error(error);
    }
    if (ok) {
      toast.success(success, { style: { color: "green" } });
    } else {
      setShown(previous);
      toast.error(ERROR_TEXT, { style: { color: "red" } });
    }
    setPending(false);
  }

  function hStatusChange(next: string) {
    // the "All" tab keeps the row, on another shelf
    const moves = tab !== "all" && slugOf(next) !== tab;
    save(
      { status: next },
      () => updateEntryStatus(entryKey, next),
      moves ? `Moved to ${next}` : "Saved",
    );
  }

  function hRatingChange(next: number) {
    save({ rating: next }, () => updateEntryRating(entryKey, next), "Saved");
  }

  return (
    <>
      <select
        aria-label={`Status for ${title}`}
        value={shown.status}
        disabled={pending}
        onChange={(e) => hStatusChange(e.target.value)}
        className={`${selectClass} w-40 max-[480px]:w-full`}
      >
        {/* a legacy status can't be picked again, but the select still shows it */}
        {!isListStatus(shown.status) && (
          <option value={shown.status} disabled className={optionClass}>
            {shown.status}
          </option>
        )}
        {LIST_STATUSES.map(({ value }) => (
          <option key={value} value={value} className={optionClass}>
            {value}
          </option>
        ))}
      </select>
      <select
        aria-label={`Rating for ${title}`}
        value={shown.rating}
        disabled={pending}
        onChange={(e) => hRatingChange(Number(e.target.value))}
        className={`${selectClass} w-28 max-[480px]:min-w-0 max-[480px]:flex-1`}
      >
        <option value={0} className={optionClass}>
          Not rated
        </option>
        {RATINGS.map((value) => (
          <option key={value} value={value} className={optionClass}>
            {value}
          </option>
        ))}
      </select>
    </>
  );
}
