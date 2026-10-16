// server-only: RECAPTCHA_SECRET_KEY is not exposed to the client
export function isRecaptchaEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY &&
      process.env.RECAPTCHA_SECRET_KEY,
  );
}

const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// asks Google whether the token passes; false when Google can't be reached
export async function verifyRecaptcha(
  token: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY ?? "",
        response: token,
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to verify. (Status: ${response.status})`);
    }
    const res = await response.json();
    return Boolean(res?.success && res.score > 0.5);
  } catch (error) {
    if (!signal?.aborted) {
      console.error("Recaptcha verify error:", error);
    }
    return false;
  }
}
