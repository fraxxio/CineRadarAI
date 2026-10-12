import { ImageOff } from "lucide-react";
import Image from "next/image";
import { tmdbImageUrl } from "@/infra/tmdb";

type SmallPosterProps = {
  // a TMDB image path
  path: string | null;
};

// a thumbnail next to the title it shows, so screen readers skip it
export function SmallPoster({ path }: SmallPosterProps) {
  const poster = tmdbImageUrl(path, "w92");

  return poster === null ? (
    <div
      aria-hidden
      className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center border border-border-clr bg-slate-950"
    >
      <ImageOff size={16} />
    </div>
  ) : (
    <Image
      src={poster}
      alt=""
      width={48}
      height={72}
      className="aspect-[2/3] w-12 shrink-0 border border-border-clr object-cover"
    />
  );
}
