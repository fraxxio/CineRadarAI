export { auth as middleware } from "./auth";

// runs on every page so the session cookie expiry keeps rolling
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
