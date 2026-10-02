import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, test, vi } from "vitest";
import { signIn } from "@/infra/auth/auth";
import SignInPage from "@/app/signin/page";

vi.mock("@/infra/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));

type Action = (formData: FormData) => Promise<void>;

// the inline server action is the form's `action` prop
function findAction(node: ReactNode): Action | undefined {
  if (!isValidElement(node)) return undefined;
  const props = node.props as { action?: Action; children?: ReactNode };
  if (node.type === "form") return props.action;
  for (const child of [props.children].flat()) {
    const action = findAction(child);
    if (action) return action;
  }
}

async function submit(callbackUrl?: string | string[], provider = "github") {
  const page = SignInPage({
    searchParams: callbackUrl === undefined ? {} : { callbackUrl },
  });
  const formData = new FormData();
  formData.set("provider", provider);
  await findAction(page)!(formData);
  return vi.mocked(signIn).mock.lastCall;
}

describe("sign-in page", () => {
  test("signs in with the chosen provider", async () => {
    expect(await submit(undefined, "google")).toEqual([
      "google",
      { redirectTo: "/" },
    ]);
  });

  it.each([
    [
      "the middleware's absolute URL",
      "http://localhost:3100/my-list",
      "/my-list",
    ],
    ["a path", "/my-list", "/my-list"],
    ["query and hash", "/search?query=Fury#top", "/search?query=Fury#top"],
  ])("[B10] returns to %s", async (_, callbackUrl, expected) => {
    expect((await submit(callbackUrl))![1]).toEqual({ redirectTo: expected });
  });

  it.each([
    ["a foreign origin", "https://evil.example/steal", "/steal"],
    ["a protocol-relative URL", "//evil.example", "/"],
    ["a protocol-relative path", "https://evil.example//evil.example", "/"],
    ["the sign-in page itself", "/signin?callbackUrl=/my-list", "/"],
    ["a repeated param", ["/a", "/b"], "/"],
  ])("never leaves the site: %s", async (_, callbackUrl, expected) => {
    expect((await submit(callbackUrl))![1]).toEqual({ redirectTo: expected });
  });
});
