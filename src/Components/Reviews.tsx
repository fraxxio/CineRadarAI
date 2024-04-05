import { CircleUser, Star } from "lucide-react";
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

async function fetchReviews(id: number) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/movie/${id}/reviews?language=en-US&page=1`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch movie reviews (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movie reviews:", error);
    throw error;
  }
}

export default async function Reviews({ id }: { id: number }) {
  const { results }: ProvidersProps = await fetchReviews(id);

  return (
    <section className="mt-10 rounded-sm border border-border-clr bg-primary-bg px-16 py-4">
      <h1 className="pb-8 text-center text-3xl font-medium">Reviews</h1>
      {results.slice(0, 10).map((review) => {
        return (
          <div
            key={review.id}
            className="border-b border-border-clr p-4 last:border-none"
          >
            <div className="flex items-end gap-2">
              {review.author_details.avatar_path === null ? (
                <CircleUser size={70} strokeWidth={1} />
              ) : (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${review.author_details.avatar_path}`}
                  alt={review.author}
                  width={100}
                  height={100}
                  className="max-h-[5rem] object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              )}
              <div>
                <p className="text-lg font-medium">{review.author}</p>
                <p className="flex items-center gap-2 text-2xl">
                  Rating:
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Star size={22} />
                    {review.author_details.rating} / 10
                  </span>
                </p>
              </div>
            </div>
            <p className="pt-4 text-secondary-text">{review.content}</p>
          </div>
        );
      })}
    </section>
  );
}
