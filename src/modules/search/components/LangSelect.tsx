import React from "react";
import { getLanguages } from "@/infra/tmdb/server";

export default async function LangSelect(
  props: React.HTMLProps<HTMLSelectElement>,
) {
  const languages = await getLanguages();

  return (
    <select
      name="language"
      {...props}
      className="rounded-sm border border-border-clr bg-dark-bg p-2 outline-1 outline-primary-text duration-200 focus:outline max-lg:w-[12rem] max-[480px]:w-full"
    >
      <option
        value=""
        className="bg-primary-text text-primary-bg last:rounded-md"
      >
        Choose language
      </option>
      {languages.map((language) => {
        return (
          <option
            value={language.code}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={language.code}
          >
            {language.englishName}
          </option>
        );
      })}
    </select>
  );
}
