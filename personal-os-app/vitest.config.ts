import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Dummy connection string so modules that transitively import db.ts
    // (e.g. agent-context -> memory-vector-store -> db) can be imported.
    // No test actually connects; DB access is mocked or degrades gracefully.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://test:test@localhost:5432/test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
