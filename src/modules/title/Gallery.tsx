import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/Modal";
import { tmdbImageUrl, type MediaType } from "@/infra/tmdb";
import { getTitleImages } from "@/infra/tmdb/server";

export default async function Gallery({
  id,
  mediaType,
}: {
  id: number;
  mediaType: MediaType;
}) {
  const { backdrops } = await getTitleImages(mediaType, id);

  return (
    <section className="mt-20 rounded-sm border border-border-clr bg-primary-bg py-4">
      <h1
        id="gallery"
        className="scroll-mt-20 pb-8 text-center text-3xl font-medium"
      >
        Gallery
      </h1>
      {backdrops.length < 1 && (
        <p className="text-center text-lg">No images were found.</p>
      )}
      <div className="grid grid-cols-3 place-items-center gap-4 px-8 pb-4 max-[980px]:grid-cols-2 max-md:grid-cols-1 max-sm:px-2">
        {backdrops.slice(0, 9).map((image) => {
          return (
            <Dialog key={image.filePath}>
              <DialogTrigger>
                <Image
                  src={tmdbImageUrl(image.filePath, "w780")!}
                  alt="Gallery image"
                  width={650}
                  height={366}
                  className="w-auto object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {image.voteCount} people rated this picture:{" "}
                    {image.voteAverage.toFixed(1)}
                  </DialogTitle>
                  <DialogDescription>
                    <Image
                      src={tmdbImageUrl(image.filePath, "w1280")!}
                      alt="Gallery image"
                      width={1920}
                      height={1080}
                      className="w-full object-cover"
                      sizes="(max-width: 1920px) 100vw, 33vw"
                    />
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </section>
  );
}
