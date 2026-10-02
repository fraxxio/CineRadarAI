import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()], // F11: tsconfig has jsx: "preserve"
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@test": fileURLToPath(new URL("./tests", import.meta.url)),
      // tests aren't run under the react-server condition, so use its no-op build
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ["./tests/setup/shared.ts"],
    server: { deps: { inline: ["next-auth"] } }, // F6
    // Vitest does not load .env, so real secrets never reach tests
    env: {
      TMDB_BASE_URL: "https://tmdb.test/3",
      TMDB_ACCESS_TOKEN: "test-tmdb-token",
      AUTH_SECRET: "test-auth-secret",
      GEMINI_API_KEY: "test-gemini-key",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/skeletons/**",
        "src/**/*.test.*",
        "src/**/testing/**",
        "src/**/loading.tsx",
        "src/app/layout.tsx",
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/setup/smoke/*.test.ts"],
          exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts", "tests/setup/smoke/*.int.test.ts"],
          setupFiles: ["./tests/setup/integration.ts"],
          globalSetup: ["./tests/setup/integration.global.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "tests/setup/smoke/*.test.tsx"],
          setupFiles: ["./tests/setup/components.tsx"],
        },
      },
    ],
  },
});
