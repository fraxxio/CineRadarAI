import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { makeSession } from "@test/helpers/factories";
import Home from "@/app/page";
import { getSession } from "@/infra/auth/session";
import { ChatAssistant } from "@/modules/chat";

// the real chat, with its props recorded
vi.mock("@/modules/chat", async (importOriginal) => {
  const chat = await importOriginal<typeof import("@/modules/chat")>();
  return { ...chat, ChatAssistant: vi.fn(chat.ChatAssistant) };
});

vi.mock("@/infra/recaptcha/RecaptchaWrapper", () => ({
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

// getSession resolves null (signed out) unless a test says otherwise
const renderHome = async () => render(await Home({ searchParams: {} as any }));
const chatProps = () => vi.mocked(ChatAssistant).mock.calls.at(-1)![0];

describe("Home page", () => {
  test("chat enabled with reCAPTCHA -> the chat inside the wrapper", async () => {
    stubChat(true, true);
    await renderHome();

    const wrapper = screen.getByTestId("recaptcha-wrapper");
    expect(
      within(wrapper).getByRole("heading", { name: "Chat with CineRadarAI" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/protected by reCAPTCHA/)).toBeInTheDocument();
    expect(screen.queryByText(/OUT OF ORDER/)).toBeNull();
  });

  test("chat enabled without reCAPTCHA -> the chat, no wrapper", async () => {
    stubChat(true, false);
    await renderHome();

    expect(screen.queryByTestId("recaptcha-wrapper")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Chat with CineRadarAI" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeEnabled();
    expect(screen.queryByText(/protected by reCAPTCHA/)).toBeNull();
    expect(screen.queryByText(/OUT OF ORDER/)).toBeNull();
  });

  test("chat disabled -> the out-of-order overlay", async () => {
    stubChat(false, true);
    await renderHome();

    expect(screen.getAllByText(/OUT OF ORDER/).length).toBeGreaterThan(0);
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    expect(screen.queryByTestId("recaptcha-wrapper")).toBeNull();
  });

  test("[B9] chat disabled -> the chat input is inert", async () => {
    stubChat(false, false);
    const { container } = await renderHome();

    const inert = container.querySelector("[inert]");
    expect(inert).not.toBeNull();
    expect(inert).toContainElement(screen.getByPlaceholderText(PLACEHOLDER));
  });

  // one case per ChatAssistant the page can render
  test.each([
    [true, true, true],
    [true, true, false],
    [true, false, true],
    [true, false, false],
    [false, false, true],
    [false, false, false],
  ])(
    "chat enabled: %s, reCAPTCHA: %s, signed in: %s -> passes signedIn to the chat",
    async (enabled, recaptcha, signedIn) => {
      stubChat(enabled, recaptcha);
      if (signedIn) {
        vi.mocked(getSession).mockResolvedValueOnce(makeSession());
      }

      await renderHome();

      expect(chatProps().signedIn).toBe(signedIn);
    },
  );
});
