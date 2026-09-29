// The redirect mock must throw, like the real one. Otherwise DeleteUser's
// failure path would carry on to the success redirect.
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
// usage in a test file:
// vi.mock("next/navigation", async () => {
//   const { RedirectError } = await import("../helpers/next");
//   return { redirect: vi.fn((url: string) => { throw new RedirectError(url); }) };
// });
