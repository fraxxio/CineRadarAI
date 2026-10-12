// keep only the path, so the redirect can never leave the site; takes a
// search param or a form field as is, anything but one string goes home
export function safeRedirect(callbackUrl: unknown) {
  if (typeof callbackUrl !== "string") return "/";
  try {
    const { pathname, search, hash } = new URL(callbackUrl, "http://n");
    const path = `${pathname}${search}${hash}`;
    return path.startsWith("//") || path.startsWith("/signin") ? "/" : path;
  } catch {
    return "/";
  }
}
