// Dependency-free TMDB stand-in for E2E. Every scenario is chosen by the request
// input (query string / id), never by mutable server state, so Next's Data Cache
// can't hide a scenario (F12).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.TMDB_MOCK_PORT ?? 4010);
const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/tmdb",
);
const PAGE_SIZE = 20;
const ERROR_ID = "999999";

const fixture = (name) =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

/** @type {{ path: string; query: string; authorization: string | undefined }[]} */
let requests = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resultPage({ type, page, totalPages, label, idBase }) {
  const results = Array.from({ length: PAGE_SIZE }, (_, n) => {
    const i = n + 1;
    const title = `${label} ${type} p${page} #${i}`;
    const noImage = i === 6; // exercises NoImage
    return {
      adult: false,
      backdrop_path: noImage ? null : `/backdrop-${i}.jpg`,
      genre_ids: [18],
      id: idBase + i,
      original_language: "en",
      overview: `Overview of ${title}`,
      popularity: 100 - i,
      poster_path: noImage ? null : `/poster-${i}.jpg`,
      vote_average: 7.5,
      vote_count: 1000 + i,
      video: false,
      ...(type === "movie"
        ? { title, original_title: title, release_date: "2020-01-01" }
        : { name: title, original_name: title, first_air_date: "2020-01-01" }),
    };
  });
  return {
    page,
    results,
    total_pages: totalPages,
    total_results: totalPages * PAGE_SIZE,
  };
}

const EMPTY_PAGE = { page: 1, results: [], total_pages: 0, total_results: 0 };

async function route(pathname, params) {
  const page = Number(params.get("page") ?? 1) || 1;

  if (pathname === "/configuration/languages") {
    return [200, fixture("languages")];
  }

  let m = pathname.match(/^\/discover\/(movie|tv)$/);
  if (m) {
    const type = m[1];
    return [
      200,
      resultPage({
        type,
        page,
        totalPages: 800, // checks the 500 page cap
        label: "Trending",
        idBase: page * 100,
      }),
    ];
  }

  m = pathname.match(/^\/search\/(movie|tv)$/);
  if (m) {
    const type = m[1];
    const query = params.get("query") ?? "";
    if (query.includes("__slow__")) await sleep(2500);
    if (query.includes("__error__")) return [500, { status_message: "error" }];
    if (query.includes("__empty__")) return [200, EMPTY_PAGE];
    return [
      200,
      resultPage({
        type,
        page,
        totalPages: query.includes("__pages3__") ? 3 : 50,
        label: query.replaceAll("|", " "),
        idBase: page * 100,
      }),
    ];
  }

  m = pathname.match(/^\/(movie|tv)\/(\d+)(?:\/(videos|images|reviews))?$/);
  if (m) {
    const [, type, id, sub] = m;
    if (id === ERROR_ID) return [500, { status_message: "error" }];
    if (sub) return [200, { ...fixture(sub), id: Number(id) }];
    const details = fixture(type === "movie" ? "movie-550" : "tv-1399");
    return [200, { ...details, id: Number(id) }];
  }

  return [404, { status_message: `not mocked: ${pathname}` }];
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/__health") return send(200, { ok: true });
  if (url.pathname === "/__requests") {
    if (req.method === "DELETE") requests = [];
    return send(200, requests);
  }

  const pathname = url.pathname.replace(/^\/3(?=\/)/, "");
  requests.push({
    path: pathname,
    query: url.search,
    authorization: req.headers.authorization,
  });

  try {
    const [status, body] = await route(pathname, url.searchParams);
    send(status, body);
  } catch (error) {
    console.error("[tmdb-mock]", error);
    send(500, { status_message: String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[tmdb-mock] listening on http://127.0.0.1:${PORT}`);
});
