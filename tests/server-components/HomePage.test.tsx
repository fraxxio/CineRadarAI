import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Home from "@/app/page";

vi.mock("@/Components/RecaptchaWrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recaptcha-wrapper">{children}</div>
  ),
}));

const PLACEHOLDER = /Suggest me movies/;

function stubChat(enabled: boolean, recaptcha: boolean) {
  vi.stubEnv("AI_CHAT_ENABLED", enabled ? "true" : "");
  vi.stubEnv("NEXT_PUBLIC_RECAPTCHA_SITE_KEY", recaptcha ? "site-key" : "");
  vi.stubEnv("RECAPTCHA_SECRET_KEY", recaptcha ? "secret-key" : "");
}

const renderHome = () => render(Home({ searchParams: {} as any }));

describe("Home page", () => {
  test("chat enabled with reCAPTCHA -> the chat inside the wrapper", () => {
    stubChat(true, true);
    renderHome();

    const wrapper = screen.getByTestId("recaptcha-wrapper");
    expect(
      within(wrapper).getByRole("heading", { name: "Chat with CineRadarAI" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/protected by reCAPTCHA/)).toBeInTheDocument();
    expect(screen.queryByText(/OUT OF ORDER/)).toBeNull();
  });

  test("chat enabled without reCAPTCHA -> the chat, no wrapper", () => {
    stubChat(true, false);
    renderHome();

    expect(screen.queryByTestId("recaptcha-wrapper")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Chat with CineRadarAI" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeEnabled();
    expect(screen.queryByText(/protected by reCAPTCHA/)).toBeNull();
    expect(screen.queryByText(/OUT OF ORDER/)).toBeNull();
  });

  test("chat disabled -> the out-of-order overlay", () => {
    stubChat(false, true);
    renderHome();

    expect(screen.getAllByText(/OUT OF ORDER/).length).toBeGreaterThan(0);
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    expect(screen.queryByTestId("recaptcha-wrapper")).toBeNull();
  });

  test.fails("[B9] chat disabled -> the chat input is inert", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // React's inert warning
    stubChat(false, false);
    const { container } = renderHome();

    const inert = container.querySelector("[inert]");
    expect(inert).not.toBeNull();
    expect(inert).toContainElement(screen.getByPlaceholderText(PLACEHOLDER));
  });
});
