"use client";
import { usePathname } from "next/navigation";
import { DetailsPageSkeleton } from "@/Components/skeletons/DetailsPageSkeleton";
import { SearchPageSkeleton } from "@/Components/skeletons/SearchPageSkeleton";

// Also shown when navigating into /search/movie|tv/[id] from outside /search
export default function Loading() {
  const pathname = usePathname();

  return pathname.startsWith("/search/") ? (
    <DetailsPageSkeleton />
  ) : (
    <SearchPageSkeleton />
  );
}
