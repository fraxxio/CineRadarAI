import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { signInWithProvider } from "@/modules/account/actions";
import { SignInButtons } from "@/shared/ui/SignInButtons";
import SignInPage from "@/app/signin/page";

type ButtonsProps = Parameters<typeof SignInButtons>[0];

// the page's provider buttons element, with the props it passes
function findButtons(node: ReactNode): ButtonsProps | undefined {
  if (!isValidElement(node)) return undefined;
  if (node.type === SignInButtons) return node.props as ButtonsProps;
  const { children } = node.props as { children?: ReactNode };
  for (const child of [children].flat()) {
    const props = findButtons(child);
    if (props) return props;
  }
}

const buttons = (callbackUrl?: string | string[]) =>
  findButtons(
    SignInPage({
      searchParams: callbackUrl === undefined ? {} : { callbackUrl },
    }),
  )!;

// the redirect rules themselves are covered by safeRedirect.test.ts
describe("sign-in page", () => {
  it("signs in through the shared provider action", () => {
    expect(buttons().action).toBe(signInWithProvider);
    expect(buttons().callbackUrl).toBe("/");
  });

  it.each([
    ["the middleware's absolute URL", "http://localhost:3100/my-list", "/my-list"],
    ["a foreign origin", "https://evil.example/steal", "/steal"],
    ["the sign-in page itself", "/signin?callbackUrl=/my-list", "/"],
    ["a repeated param", ["/a", "/b"], "/"],
  ])("[B10] returns to the site's path only: %s", (_, callbackUrl, expected) => {
    expect(buttons(callbackUrl).callbackUrl).toBe(expected);
  });
});
