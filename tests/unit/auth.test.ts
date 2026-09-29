import { describe, expect, it, test, vi } from "vitest";
import { authConfig } from "@/auth";

vi.mock("@/db", () => ({ db: {} }));
// DrizzleAdapter({}) would throw on the unknown DB type
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: vi.fn(() => ({})) }));

const authorized = (href: string, loggedIn: boolean) =>
  authConfig.callbacks.authorized({
    auth: loggedIn ? { user: { id: "u1" } } : null,
    request: { nextUrl: new URL(href) },
  } as any);

describe("authorized callback", () => {
  it.each([
    "http://localhost:3000/my-list",
    "http://localhost:3000/my-list?type=tv",
  ])("redirects a logged-out user on %s to sign-in", (href) => {
    const res = authorized(href, false);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(302);

    const location = new URL((res as Response).headers.get("location")!);
    expect(location.pathname).toBe("/api/auth/signin");
    expect(location.searchParams.get("callbackUrl")).toBe(href);
  });

  test("lets a logged-in user through on /my-list", () => {
    expect(authorized("http://localhost:3000/my-list", true)).toBe(true);
  });

  it.each(["/", "/search", "/about"])("allows %s for anyone", (path) => {
    expect(authorized(`http://localhost:3000${path}`, false)).toBe(true);
    expect(authorized(`http://localhost:3000${path}`, true)).toBe(true);
  });

  // pins current behaviour: the check is a prefix match (startsWith)
  test("also protects paths that merely start with /my-list", () => {
    expect(
      authorized("http://localhost:3000/my-listing", false),
    ).toBeInstanceOf(Response);
  });
});

describe("session callback", () => {
  test("copies user.id onto session.user.id", async () => {
    const session = await authConfig.callbacks.session({
      session: { user: {} },
      user: { id: "u1" },
    } as any);
    expect(session.user.id).toBe("u1");
  });
});
