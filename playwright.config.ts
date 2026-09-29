import { defineConfig, devices } from "@playwright/test";
import {
  BASE_URL,
  DB_PORT,
  DB_URL,
  LIBSQL_IMAGE,
  PORT,
  TMDB_PORT,
  TMDB_URL,
  VARIANT,
} from "./tests/e2e/env";

const isCI = !!process.env.CI;

const appEnv = {
  DATABASE_URL: DB_URL,
  DATABASE_AUTH_TOKEN: "",
  TMDB_BASE_URL: `${TMDB_URL}/3`,
  TMDB_ACCESS_TOKEN: "e2e-tmdb-token",
  AUTH_SECRET: "e2e-auth-secret-e2e-auth-secret-e2e",
  AUTH_URL: BASE_URL, // F9
  NEXTAUTH_URL: BASE_URL,
  AUTH_TRUST_HOST: "true",
  AUTH_GITHUB_ID: "e2e-github-id",
  AUTH_GITHUB_SECRET: "e2e",
  AUTH_GOOGLE_ID: "e2e-google-id",
  AUTH_GOOGLE_SECRET: "e2e",
  GEMINI_API_KEY: "e2e-not-a-real-key",
  GEMINI_MODEL: "e2e-model",
  AI_CHAT_ENABLED: VARIANT === "chat-disabled" ? "" : "true", // "" still overrides .env (F10)
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: VARIANT === "recaptcha" ? "e2e-site-key" : "",
  RECAPTCHA_SECRET_KEY: VARIANT === "recaptcha" ? "e2e-secret-key" : "",
  NEXT_DIST_DIR: `.next-e2e-${VARIANT}`,
};

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: VARIANT === "default" ? ["variants/**"] : undefined,
  testMatch:
    VARIANT === "default" ? undefined : [`variants/${VARIANT}.spec.ts`],
  fullyParallel: true, // safe: every test seeds its own user (4.6)
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // local `next dev` gets flaky above ~4 parallel pages (aborted navigations, lost
  // server-action redirects); more workers don't make it faster anyway
  workers: isCI ? 2 : 4,
  reporter: [
    ["html", { outputFolder: `playwright-report/${VARIANT}`, open: "never" }],
    ["list"],
  ],
  outputDir: `test-results/${VARIANT}`,
  globalSetup: "./tests/e2e/global-setup.ts",
  expect: { timeout: 10_000 }, // first compile in `next dev` is slow
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: `chromium-${VARIANT}`,
      use: {
        ...devices["Desktop Chrome"],
        // e.g. NixOS, where the downloaded Chromium can't find system libraries
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
  // Playwright starts these before globalSetup, so the DB is up when migrations run
  webServer: [
    ...(process.env.E2E_DATABASE_URL
      ? []
      : [
          {
            // outlives the run (Playwright kills only the docker CLI); reused next time.
            // CI provides the DB as a service container via E2E_DATABASE_URL instead.
            command: `docker run --rm --name cineradar-e2e-db -p ${DB_PORT}:8080 ${LIBSQL_IMAGE}`,
            url: `http://127.0.0.1:${DB_PORT}/health`,
            reuseExistingServer: !isCI,
            timeout: 120_000,
          },
        ]),
    {
      command: "node tests/e2e/mocks/tmdb-server.mjs",
      url: `${TMDB_URL}/__health`,
      reuseExistingServer: !isCI,
      env: { TMDB_MOCK_PORT: String(TMDB_PORT) },
    },
    {
      // CI: production build (no dev overlay, faster pages); local: dev server
      command: isCI
        ? `npx next build && npx next start -p ${PORT}`
        : `npx next dev -p ${PORT}`,
      url: `${BASE_URL}/about`,
      reuseExistingServer: !isCI,
      timeout: 300_000,
      env: appEnv, // merged over process.env by Playwright
    },
  ],
});
