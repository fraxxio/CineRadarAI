const fs = require("node:fs");
const path = require("node:path");

const modules = fs
  .readdirSync(path.join(__dirname, "src/modules"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const onlyLlmTalksToGemini = {
  name: "@google/genai",
  message:
    "Only src/modules/chat/llm/ may talk to Gemini, use llmService instead.",
};

module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    "no-restricted-imports": ["error", { paths: [onlyLlmTalksToGemini] }],
    // Checks the file an import resolves to, so `@/` and relative imports are
    // both caught. `except` globs match absolute paths, hence the `**/`.
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          ...modules.map((m) => ({
            target: [
              "./src/*",
              `./src/!(modules)/**/*`,
              `./src/modules/!(${m})/**/*`,
            ],
            from: `./src/modules/${m}/**/*`,
            except: [`**/src/modules/${m}/{index,server,actions}.{ts,tsx}`],
            message:
              "Import a module through its public entry: @/modules/<m>, /server or /actions. Inside a module, use relative imports.",
          })),
          {
            target: [
              "./src/*",
              "./src/!(infra)/**/*",
              "./src/infra/!(tmdb)/**/*",
            ],
            from: "./src/infra/tmdb/**/*",
            except: ["**/src/infra/tmdb/{index,server}.ts"],
            message:
              "Import infra/tmdb through @/infra/tmdb or @/infra/tmdb/server.",
          },
          {
            target: "./src/infra",
            from: "./src/modules",
            message: "infra/ must not depend on feature modules.",
          },
          {
            target: "./src/shared",
            from: ["./src/modules", "./src/infra"],
            message: "shared/ must not depend on feature modules or infra/.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // the live schema check sends the chat's real request
      files: ["src/modules/chat/llm/**", "scripts/check-chat-tools.ts"],
      rules: { "no-restricted-imports": "off" },
    },
  ],
};
