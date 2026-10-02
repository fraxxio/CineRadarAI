"use client";
import { usePathname } from "next/navigation";
import { DetailsPageSkeleton } from "@/modules/title";
import { SearchPageSkeleton } from "@/modules/search";

// Also shown when navigating into /search/movie|tv/[id] from outside /search
export default function Loading() {
  const pathname = usePathname();

  return pathname.startsWith("/search/") ? (
    <DetailsPageSkeleton />
  ) : (
    <SearchPageSkeleton />
  );
}
