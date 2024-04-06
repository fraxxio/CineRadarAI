type TrailerProps = {
  id: number;
  results: [
    {
      iso_639_1: string;
      iso_3166_1: string;
      name: string;
      key: string;
      site: string;
      size: number;
      type: string;
      official: boolean;
      published_at: string;
      id: string;
    },
  ];
};

async function fetchVideos(id: number) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/movie/${id}/videos?language=en-US`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch movie trailer (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movie trailer:", error);
    throw error;
  }
}

export default async function Trailer({ id }: { id: number }) {
  const { results }: TrailerProps = await fetchVideos(id);
  const trailer = results.find((video) => video.type === "Trailer");
  return (
    <section
      id="trailer"
      className="relative mt-20 scroll-mt-20 rounded-sm border border-border-clr bg-primary-bg py-4"
    >
      <h1 className="pb-8 text-center text-3xl font-medium">Trailer</h1>
      <iframe
        src={`https://www.youtube.com/embed/${trailer?.key}`}
        className="mx-auto aspect-video px-4"
        allowFullScreen
        loading="lazy"
        title="Trailer"
        width="100%"
        height="100%"
      />
    </section>
  );
}
