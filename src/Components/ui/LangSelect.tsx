import React from "react";

type Language = {
  iso_639_1: string;
  english_name: string;
  name: string;
};

async function getLanguages() {
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await fetch(`${process.env.TMDB_BASE_URL}/configuration/languages`, options);
    if (!response.ok) {
      throw new Error("Failed to fetch languages");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}

export default async function LangSelect() {
  const languages = await getLanguages();

  return (
    <select
      name='language'
      className='bg-dark-bg max-lg:w-[12rem] max-[480px]:w-full border border-border-clr p-2 rounded-sm focus:outline outline-primary-text outline-1 duration-200'
    >
      <option value='' className='bg-primary-text text-primary-bg last:rounded-md'>
        Choose language
      </option>
      {languages.map((language: Language) => {
        return (
          <option
            value={language.iso_639_1}
            className='bg-primary-text text-primary-bg last:rounded-md'
            key={language.iso_639_1}
          >
            {language.english_name}
          </option>
        );
      })}
    </select>
  );
}
