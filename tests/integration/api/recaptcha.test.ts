import {
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  type MockInstance,
} from "vitest";
import { POST } from "@/app/api/recaptcha/route";
import { jsonRequest } from "../../helpers/requests";

let f: MockInstance<typeof fetch>;

beforeEach(() => {
  vi.stubEnv("AI_CHAT_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_RECAPTCHA_SITE_KEY", "site");
  vi.stubEnv("RECAPTCHA_SECRET_KEY", "secret");
  f = vi.spyOn(globalThis, "fetch");
});

const post = (recaptchaToken = "tok") =>
  POST(jsonRequest("POST", "/api/recaptcha", { recaptchaToken }));

describe("POST /api/recaptcha", () => {
  test("returns 503 when AI chat is disabled", async () => {
    vi.stubEnv("AI_CHAT_ENABLED", "");
    const res = await post();
    expect(res.status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["the secret", "RECAPTCHA_SECRET_KEY"],
    ["the site key", "NEXT_PUBLIC_RECAPTCHA_SITE_KEY"],
  ])("returns 404 when %s is missing", async (_, name) => {
    vi.stubEnv(name, "");
    const res = await post();
    expect(res.status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });

  test("[B11] returns 400 for a malformed JSON body", async () => {
    const res = await POST(jsonRequest("POST", "/api/recaptcha", "{not json"));
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  test("calls Google siteverify with the secret and the token", async () => {
    f.mockResolvedValue(Response.json({ success: true, score: 0.9 }));

    await post("tok");

    expect(f).toHaveBeenCalledOnce();
    const [input, init] = f.mock.calls[0];
    const u = new URL(String(input));
    expect(u.origin + u.pathname).toBe(
      "https://www.google.com/recaptcha/api/siteverify",
    );
    expect(u.searchParams.get("secret")).toBe("secret");
    expect(u.searchParams.get("response")).toBe("tok");
    expect(init?.method).toBe("POST");
  });

  test("returns success and the score when Google accepts", async () => {
    f.mockResolvedValue(Response.json({ success: true, score: 0.9 }));
    const res = await post();
    expect(await res.json()).toEqual({ success: true, score: 0.9 });
  });

  describe("failures", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each([
      [
        "score exactly 0.5",
        () => f.mockResolvedValue(Response.json({ success: true, score: 0.5 })),
      ],
      [
        "low score",
        () => f.mockResolvedValue(Response.json({ success: true, score: 0.1 })),
      ],
      [
        "success: false",
        () =>
          f.mockResolvedValue(Response.json({ success: false, score: 0.9 })),
      ],
      [
        "non-OK response",
        () => f.mockResolvedValue(new Response("", { status: 500 })),
      ],
      ["fetch throws", () => f.mockRejectedValue(new TypeError("network"))],
    ])("%s -> { success: false }", async (_, arrange) => {
      arrange();
      const res = await post();
      expect(await res.json()).toEqual({ success: false });
    });
  });
});
