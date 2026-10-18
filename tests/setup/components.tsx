import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// no `globals: true`, so RTL can't auto-register cleanup; storage is cleared
// after it, since unmounting the chat can save to it
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: () => router, // same object every call: tests read it via useRouter()
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
  };
});
// plain <img>: next/image's default loader rewrites src to /_next/image?... outside Next;
// lazy unless `priority`, like next/image
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ priority, fill, ...props }: Record<string, unknown>) => (
    <img loading={priority ? undefined : "lazy"} {...props} />
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
  Toaster: () => null,
}));
// server actions pull in next-auth and the DB
vi.mock("@/modules/account/actions", () => ({
  SignOut: vi.fn(),
  DeleteUser: vi.fn(),
  signInWithProvider: vi.fn(),
}));
vi.mock("react-google-recaptcha-v3", () => ({
  useGoogleReCaptcha: vi.fn(() => ({ executeRecaptcha: undefined })),
  GoogleReCaptchaProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
