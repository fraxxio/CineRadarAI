import React from "react";

async function getLanguages() {
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await fetch(
      `${process.env.TMDB_BASE_URL}/configuration/languages`,
      options,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch languages");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}

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
      {languages.map((language: Language) => {
        return (
          <option
            value={language.iso_639_1}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={language.iso_639_1}
          >
            {language.english_name}
          </option>
        );
      })}
    </select>
  );
}
