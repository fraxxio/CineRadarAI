import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it.each([
    ["the middleware's absolute URL", "http://localhost:3100/my-list", "/my-list"],
    ["a path", "/my-list", "/my-list"],
    ["query and hash", "/search?query=Fury#top", "/search?query=Fury#top"],
  ])("[B10] returns to %s", (_, callbackUrl, expected) => {
    expect(safeRedirect(callbackUrl)).toBe(expected);
  });

  it.each([
    ["a foreign origin", "https://evil.example/steal", "/steal"],
    ["a protocol-relative URL", "//evil.example", "/"],
    ["a protocol-relative path", "https://evil.example//evil.example", "/"],
    ["the sign-in page itself", "/signin?callbackUrl=/my-list", "/"],
    ["a repeated param", ["/a", "/b"], "/"],
    ["no value", undefined, "/"],
    ["a missing form field", null, "/"],
  ])("never leaves the site: %s", (_, callbackUrl, expected) => {
    expect(safeRedirect(callbackUrl)).toBe(expected);
  });
});
