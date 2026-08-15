import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
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
