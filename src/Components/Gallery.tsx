import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/Modal";

type GalleryProps = {
  backdrops: [
    {
      aspect_ratio: number;
      height: number;
      iso_639_1: string | null;
      file_path: string;
      vote_average: number;
      vote_count: number;
      width: number;
    },
  ];
};

async function fetchGallery(id: number) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/movie/${id}/images`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch movie images (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movie images:", error);
    throw error;
  }
}

export default async function Gallery({ id }: { id: number }) {
  const { backdrops }: GalleryProps = await fetchGallery(id);

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
            <Dialog key={image.file_path}>
              <DialogTrigger>
                <Image
                  src={`https://image.tmdb.org/t/p/w780${image.file_path}`}
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
                    {image.vote_count} people rated this picture:{" "}
                    {image.vote_average.toFixed(1)}
                  </DialogTitle>
                  <DialogDescription>
                    <Image
                      src={`https://image.tmdb.org/t/p/w1280${image.file_path}`}
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
