import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // e2e/ holds Playwright specs — run those via `npm run e2e`, not Vitest.
    exclude: ["node_modules/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@medscope/triage-shared": new URL(
        "../../packages/triage-shared/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
