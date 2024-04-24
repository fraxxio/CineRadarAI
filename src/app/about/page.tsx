import React from "react";

export default function page() {
  return (
    <main className="container my-auto">
      <section className="my-2 border border-border-clr bg-primary-bg px-4 pb-8 pt-4 max-sm:text-sm">
        <h1 className="text-center text-3xl font-medium max-sm:text-xl">
          About
        </h1>
        <p className="mx-auto max-w-[90%] text-balance pt-4 ">
          <b>CineRadar: Your Personalized Movie and TV Show AI Companion.</b> It
          provides tailored movie and TV show recommendations powered by AI.
          Simply input your preferences, including genre, style, and actors, and
          let our AI generate a curated list of suggestions just for you. Need
          more control? Use our manual search feature to explore the extensive
          TMDB movie database. You can also log in using Google or GitHub
          authentication, and create a custom list to track your viewing
          journey. Mark movies as planning to watch, completed, or watching, and
          even rate them on a scale of 1 to 10.
        </p>
        <h2 className="pb-2 pt-8 text-center text-xl font-medium max-sm:text-base">
          Data source
        </h2>
        <p className="mx-auto max-w-[90%] text-balance pt-2">
          Movie or TV show suggestions are generated by{" "}
          <a
            target="_blank"
            rel="noreferrer noopener"
            href="https://openai.com/"
            className="underline"
          >
            Open AI
          </a>{" "}
          <code className="rounded border border-border-clr bg-dark-bg p-1">
            gpt-3.5-turbo-16k
          </code>{" "}
          model.
        </p>
        <p className="mx-auto max-w-[90%] text-balance pt-2">
          Movies from manual search page are provided by{" "}
          <a
            target="_blank"
            rel="noreferrer noopener"
            href="https://www.themoviedb.org"
            className="underline"
          >
            TMDB
          </a>{" "}
          API.
        </p>
        <h2 className="pb-4 pt-8 text-center text-xl font-medium max-sm:text-base">
          Legal notice
        </h2>
        <p className="mx-auto max-w-[90%] text-balance pt-2 ">
          CineRadar operates solely as a platform utilizing the TMDB API to
          provide access to movie and TV show information. We do not claim
          ownership of any media content featured on our website. All content is
          sourced from the TMDB database, and any copyrights or ownership rights
          remain with the respective owners. <br /> <br /> Furthermore, while
          our AI model strives to provide accurate recommendations, it may
          occasionally generate suggestions that do not align with user
          preferences or expectations. Users are encouraged to exercise their
          own judgment when utilizing our recommendation services. By accessing
          and using CineRadar, users acknowledge and accept these terms
          regarding content ownership and acknowledge the possibility of
          occasional inaccuracies in AI-generated suggestions.
        </p>
      </section>
    </main>
  );
}
