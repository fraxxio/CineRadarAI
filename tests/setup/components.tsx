import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup()); // no `globals: true`, so RTL can't auto-register this

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
// plain <img>: next/image's default loader rewrites src to /_next/image?... outside Next
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ priority, fill, ...props }: Record<string, unknown>) => (
    <img {...props} />
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
vi.mock("@/app/actions", () => ({ SignOut: vi.fn(), DeleteUser: vi.fn() }));
vi.mock("react-google-recaptcha-v3", () => ({
  useGoogleReCaptcha: vi.fn(() => ({ executeRecaptcha: undefined })),
  GoogleReCaptchaProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
