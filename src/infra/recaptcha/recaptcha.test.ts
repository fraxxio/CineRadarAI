import { describe, expect, it, vi } from "vitest";
import { isRecaptchaEnabled } from "./recaptcha";

describe("isRecaptchaEnabled", () => {
  it.each([
    ["k", "k", true],
    ["k", "", false],
    ["", "k", false],
    ["", "", false],
  ])("site key %j, secret %j -> %s", (siteKey, secret, expected) => {
    vi.stubEnv("NEXT_PUBLIC_RECAPTCHA_SITE_KEY", siteKey);
    vi.stubEnv("RECAPTCHA_SECRET_KEY", secret);
    expect(isRecaptchaEnabled()).toBe(expected);
  });
});
