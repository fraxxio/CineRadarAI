import { describe, expect, test } from "vitest";
import { toDetails, toReview, toSummary, type RawDetails } from "./normalise";

// TMDB leaves fields out; these fallbacks decide what the pages show then

const bare = { id: 1, vote_average: 0, vote_count: 0 };
const bareDetails: RawDetails = {
  ...bare,
  status: "Released",
  overview: "",
  genres: [],
};

describe("toSummary", () => {
  test("movies read title / release_date, TV name / first_air_date", () => {
    const raw = {
      ...bare,
      title: "Movie",
      release_date: "1999-10-15",
      name: "Show",
      first_air_date: "2011-04-17",
    };
    expect(toSummary("movie", raw)).toMatchObject({
      title: "Movie",
      releaseDate: "1999-10-15",
    });
    expect(toSummary("tv", raw)).toMatchObject({
      title: "Show",
      releaseDate: "2011-04-17",
    });
  });

  test("missing title, date and images -> empty strings and null", () => {
    expect(toSummary("tv", bare)).toEqual({
      id: 1,
      title: "",
      releaseDate: "",
      posterPath: null,
      backdropPath: null,
      voteAverage: 0,
      voteCount: 0,
    });
  });
});

describe("toDetails", () => {
  test("a movie without runtime, budget or revenue -> 0", () => {
    expect(toDetails("movie", bareDetails)).toMatchObject({
      mediaType: "movie",
      title: "",
      runtime: 0,
      budget: 0,
      revenue: 0,
    });
  });

  test("a TV show without last air date, seasons or type -> empty values", () => {
    expect(toDetails("tv", bareDetails)).toMatchObject({
      mediaType: "tv",
      title: "",
      lastAirDate: "",
      numberOfSeasons: 0,
      showType: "",
    });
  });

  test("TV fields are read when present", () => {
    expect(
      toDetails("tv", {
        ...bareDetails,
        last_air_date: "2019-05-19",
        number_of_seasons: 8,
        type: "Scripted",
      }),
    ).toMatchObject({
      lastAirDate: "2019-05-19",
      numberOfSeasons: 8,
      showType: "Scripted",
    });
  });
});

describe("toReview", () => {
  test("missing avatar and rating -> null", () => {
    expect(
      toReview({ id: "r1", author: "A", author_details: {}, content: "Hi" }),
    ).toEqual({
      id: "r1",
      author: "A",
      avatarPath: null,
      rating: null,
      content: "Hi",
    });
  });

  test("avatar and rating are kept", () => {
    expect(
      toReview({
        id: "r1",
        author: "A",
        author_details: { avatar_path: "/a.jpg", rating: 7 },
        content: "Hi",
      }),
    ).toMatchObject({ avatarPath: "/a.jpg", rating: 7 });
  });
});
