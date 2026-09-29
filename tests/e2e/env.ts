export type Variant = "default" | "chat-disabled" | "recaptcha";
export const VARIANT = (process.env.E2E_VARIANT ?? "default") as Variant;
export const PORT = { default: 3100, "chat-disabled": 3101, recaptcha: 3102 }[
  VARIANT
];
export const BASE_URL = `http://localhost:${PORT}`;
export const TMDB_PORT = 4010;
export const TMDB_URL = `http://127.0.0.1:${TMDB_PORT}`;
export const DB_PORT = 8089;
export const DB_URL =
  process.env.E2E_DATABASE_URL ?? `http://127.0.0.1:${DB_PORT}`;
export const LIBSQL_IMAGE = "ghcr.io/tursodatabase/libsql-server:v0.24.33";
