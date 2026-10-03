"use client";
import { usePathname } from "next/navigation";
import { DetailsPageSkeleton } from "@/modules/title";
import { SearchPageSkeleton } from "./SearchPageSkeleton";

// the /search loading UI. Next also shows it when navigating into
// /search/movie|tv/[id] from outside /search, so it picks the details skeleton there
export function SearchLoading() {
  const pathname = usePathname();

  return pathname.startsWith("/search/") ? (
    <DetailsPageSkeleton />
  ) : (
    <SearchPageSkeleton />
  );
}
