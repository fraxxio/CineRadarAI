import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const FIXTURES = path.join(__dirname, "../fixtures/tmdb");

export const tmdbFixture = <T = any>(name: string): T =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

// a JSON body, a Response, or a handler for per-request answers (deferred,
// hanging until aborted, ...)
type TmdbRoute =
  | unknown
  | Response
  | ((url: URL, init?: RequestInit) => unknown | Promise<unknown>);

// routes a mocked fetch by URL pathname (e.g. "/3/movie/550"); unknown paths get a 404
export function mockTmdb(routes: Record<string, TmdbRoute>) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const route = routes[url.pathname];
      if (route === undefined) {
        return new Response("not mocked", { status: 404 });
      }
      const hit = typeof route === "function" ? await route(url, init) : route;
      return hit instanceof Response ? hit.clone() : Response.json(hit);
    });
}

// a request that never answers; rejects like fetch once its signal aborts
export const hangUntilAborted = (_url: URL, init?: RequestInit) =>
  new Promise((_, reject) => {
    const signal = init?.signal;
    if (!signal) throw new Error("hangUntilAborted needs a signal");
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason));
  });

// the URLs of the mocked requests to one pathname, in call order
export const tmdbUrls = (spy: ReturnType<typeof mockTmdb>, pathname: string) =>
  spy.mock.calls
    .map(([input]) =>
      input instanceof Request ? new URL(input.url) : new URL(String(input)),
    )
    .filter((url) => url.pathname === pathname);

export const lastTmdbUrl = (spy: ReturnType<typeof mockTmdb>) => {
  const input = spy.mock.lastCall![0];
  return new URL(input instanceof Request ? input.url : String(input));
};
