// server-only: RECAPTCHA_SECRET_KEY is not exposed to the client
export function isRecaptchaEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY &&
      process.env.RECAPTCHA_SECRET_KEY,
  );
}
