import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()], // F11: tsconfig has jsx: "preserve"
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@test": fileURLToPath(new URL("./tests", import.meta.url)),
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
        "src/types/**",
        "src/Components/skeletons/**",
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
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts", "src/**/*.int.test.ts"],
          setupFiles: ["./tests/setup/integration.ts"],
          globalSetup: ["./tests/setup/integration.global.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: [
            "tests/components/**/*.test.tsx",
            "tests/server-components/**/*.test.tsx",
            "src/**/*.test.tsx",
          ],
          setupFiles: ["./tests/setup/components.tsx"],
        },
      },
    ],
  },
});
