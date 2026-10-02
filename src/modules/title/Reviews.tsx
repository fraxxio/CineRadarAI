import { CircleUser, Star } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import Image from "next/image";
import React from "react";
import type { MediaType } from "@/infra/tmdb";
import { getTitleReviews } from "@/infra/tmdb/server";

export default async function Reviews({
  id,
  mediaType,
}: {
  id: number;
  mediaType: MediaType;
}) {
  const { results } = await getTitleReviews(mediaType, id);

  return (
    <section
      id="reviews"
      className="my-10 scroll-mt-20 rounded-sm border border-border-clr bg-primary-bg px-16 py-4 max-[550px]:px-4"
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
              {review.avatarPath === null ? (
                <CircleUser size={70} strokeWidth={1} />
              ) : (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${review.avatarPath}`}
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
                    {review.rating}/10
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
