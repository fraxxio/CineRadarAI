import type { MediaType } from "@/infra/tmdb";
import { getTitleVideos } from "@/infra/tmdb/server";

export default async function Trailer({
  id,
  mediaType,
}: {
  id: number;
  mediaType: MediaType;
}) {
  const videos = await getTitleVideos(mediaType, id);
  // only YouTube keys can be embedded
  const trailer = videos.find(
    (video) => video.type === "Trailer" && video.site === "YouTube",
  );

  return (
    <section
      id="trailer"
      className="relative mt-20 scroll-mt-20 rounded-sm border border-border-clr bg-primary-bg py-4"
    >
      <h1 className="pb-8 text-center text-3xl font-medium">Trailer</h1>
      {trailer ? (
        <iframe
          src={`https://www.youtube.com/embed/${trailer?.key}`}
          className="mx-auto aspect-video px-4"
          allowFullScreen
          loading="lazy"
          title="Trailer"
          width="100%"
          height="100%"
        />
      ) : (
        <p className="text-center text-lg">No trailer.</p>
      )}
    </section>
  );
}
