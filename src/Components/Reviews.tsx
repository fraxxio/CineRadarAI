import { CircleUser, Star } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import Image from "next/image";
import React from "react";

type ProvidersProps = {
  results: [
    {
      author: string;
      author_details: {
        name: string;
        username: string;
        avatar_path: string;
        rating: number;
      };
      content: string;
      created_at: string;
      id: string;
      updated_at: string;
      url: string;
    },
  ];
};

async function fetchReviews(id: number, mediaType: "movie" | "tv") {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/${mediaType}/${id}/reviews?language=en-US&page=1`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch ${mediaType} reviews (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${mediaType} reviews:`, error);
    throw error;
  }
}

export default async function Reviews({
  id,
  mediaType,
}: {
  id: number;
  mediaType: "movie" | "tv";
}) {
  const { results }: ProvidersProps = await fetchReviews(id, mediaType);

  return (
    <section
      id="reviews"
      className="my-10 rounded-sm border border-border-clr bg-primary-bg px-16 py-4 max-[550px]:px-4"
    >
      <h1 className="pb-8 text-center text-3xl font-medium">Reviews</h1>
      {results.length < 1 && (
        <p className="text-center text-lg">No reviews were found.</p>
      )}
      {results.slice(0, 10).map((review) => {
        return (
          <div
            key={review.id}
            className="border-b border-border-clr p-4 last:border-none"
          >
            <div className="flex items-end gap-2 max-md:flex-col max-md:items-start">
              {review.author_details.avatar_path === null ? (
                <CircleUser size={70} strokeWidth={1} />
              ) : (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${review.author_details.avatar_path}`}
                  alt={review.author}
                  width={100}
                  height={100}
                  className="max-h-[5rem] w-auto object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              )}
              <div className="border-l-2 border-border-clr">
                <p className="pl-1 text-lg font-medium">{review.author}</p>
                <p className="flex items-end gap-2 border-t-2 border-border-clr pl-1 text-2xl max-md:text-xl max-sm:flex-col max-sm:items-start">
                  Rating:
                  <span className="flex items-center gap-1 text-[1.2rem] text-yellow-600">
                    <Star size={18} />
                    {review.author_details.rating}/10
                  </span>
                </p>
              </div>
            </div>
            <p
              className="max-h-[10rem] overflow-hidden pt-4 text-secondary-text duration-300 hover:max-h-[90rem] max-[550px]:max-h-[20rem]"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(review.content),
              }}
            ></p>
            {review.content.length > 860 && (
              <p className="pt-2 text-center text-sm text-secondary-text">
                Hover to reveal
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
