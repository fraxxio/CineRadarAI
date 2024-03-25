"use server";

export async function fetchMovies(formData: FormData) {
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };
  const adult = formData.get("adult") === null ? false : true;
  const language = formData.get("language");
  const year = formData.get("year");
  const query = formData.get("query");

  const fetchURL = `${process.env.TMDB_BASE_URL}/search/${formData.get(
    "btn"
  )}?query=${query}&include_adult=${adult}&language=${language}&page=1&year=${year}`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      throw new Error("Failed to fetch languages");
    }
    console.log(response.json());
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}
