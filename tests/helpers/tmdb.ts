import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const FIXTURES = path.join(__dirname, "../fixtures/tmdb");

export const tmdbFixture = <T = any>(name: string): T =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

// routes a mocked fetch by URL pathname (e.g. "/3/movie/550"); unknown paths get a 404
export function mockTmdb(routes: Record<string, unknown | Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const hit = routes[url.pathname];
    if (hit === undefined) return new Response("not mocked", { status: 404 });
    return hit instanceof Response ? hit.clone() : Response.json(hit);
  });
}

export const lastTmdbUrl = (spy: ReturnType<typeof mockTmdb>) => {
  const input = spy.mock.lastCall![0];
  return new URL(input instanceof Request ? input.url : String(input));
};
