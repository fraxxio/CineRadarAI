import React, { Dispatch, SetStateAction } from "react";

type RatingSelectProps = {
  props?: React.HTMLProps<HTMLSelectElement>;
  rating: string;
  setRating: Dispatch<SetStateAction<string>>;
};

export default function RatingSelect({
  props,
  rating,
  setRating,
}: RatingSelectProps) {
  const ratings = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  return (
    <select
      id="rating"
      name="rating"
      {...props}
      value={rating}
      onChange={(e) => setRating(e.target.value)}
      className="rounded-sm border border-border-clr bg-dark-bg p-2 outline-1 outline-primary-text duration-200 focus:outline max-lg:w-[12rem] max-[480px]:w-full"
    >
      <option
        value=""
        className="bg-primary-text text-primary-bg last:rounded-md"
      >
        Add rating
      </option>
      {ratings.map((rating: string) => {
        return (
          <option
            value={rating}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={rating}
          >
            {rating}
          </option>
        );
      })}
    </select>
  );
}
