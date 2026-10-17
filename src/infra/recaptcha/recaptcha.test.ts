import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { isRecaptchaEnabled, verifyRecaptcha } from "./recaptcha";

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

describe("verifyRecaptcha", () => {
  const f = () => vi.mocked(globalThis.fetch);

  beforeEach(() => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "secret");
    vi.spyOn(globalThis, "fetch");
  });

  test("posts the secret and the token to Google siteverify", async () => {
    f().mockResolvedValue(Response.json({ success: true, score: 0.9 }));
    const signal = new AbortController().signal;

    await verifyRecaptcha("tok&x=1", signal);

    expect(f()).toHaveBeenCalledOnce();
    const [input, init] = f().mock.calls[0];
    expect(String(input)).toBe(
      "https://www.google.com/recaptcha/api/siteverify",
    );
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBe(signal);
    const body = init?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      secret: "secret",
      response: "tok&x=1",
    });
  });

  test("passes when Google accepts with a score above 0.5", async () => {
    f().mockResolvedValue(Response.json({ success: true, score: 0.9 }));
    expect(await verifyRecaptcha("tok")).toBe(true);
  });

  describe("failures", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each([
      [
        "score exactly 0.5",
        () =>
          f().mockResolvedValue(Response.json({ success: true, score: 0.5 })),
      ],
      [
        "low score",
        () =>
          f().mockResolvedValue(Response.json({ success: true, score: 0.1 })),
      ],
      [
        "success: false",
        () =>
          f().mockResolvedValue(Response.json({ success: false, score: 0.9 })),
      ],
      [
        "non-OK response",
        () => f().mockResolvedValue(new Response("", { status: 500 })),
      ],
      ["fetch throws", () => f().mockRejectedValue(new TypeError("network"))],
    ])("%s -> false", async (_, arrange) => {
      arrange();
      expect(await verifyRecaptcha("tok")).toBe(false);
    });

    test("an aborted request is false without an error log", async () => {
      const abort = new AbortController();
      abort.abort();
      f().mockRejectedValue(new DOMException("aborted", "AbortError"));

      expect(await verifyRecaptcha("tok", abort.signal)).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
