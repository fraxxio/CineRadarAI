import "server-only";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

type Params = Record<string, string | number | boolean | undefined>;

// `what` names the resource in errors and logs, e.g. "movie details"
export async function tmdbFetch<T>(
  path: string,
  params: Params,
  what: string,
): Promise<T> {
  // read env at call time: tests stub it per test
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  const url = `${process.env.TMDB_BASE_URL}${path}${query ? `?${query}` : ""}`;

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new TmdbError(
        `Failed to fetch ${what} (Status: ${response.status})`,
        response.status,
        path,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error fetching ${what}:`, error);
    throw error;
  }
}
