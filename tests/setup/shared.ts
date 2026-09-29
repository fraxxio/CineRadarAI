import { vi } from "vitest";

// Vitest resolves stable React 18.2; Next runs the App Router on its bundled canary,
// which has react.cache and react-dom.useFormStatus. Shim the gap.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("react") & { cache?: unknown }
  >();
  return { ...actual, cache: actual.cache ?? (<T>(fn: T) => fn) };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: vi.fn(() => ({
      pending: false,
      data: null,
      method: null,
      action: null,
    })),
  };
});

// getSession() -> auth() needs a Next request context; tests control it directly
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => null) }));
