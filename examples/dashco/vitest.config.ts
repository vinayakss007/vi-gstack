import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The product must ship fully with AI disabled. Default test runs prove it.
    env: {
      AI_ENABLED: "false",
    },
    include: ["test/**/*.test.ts"],
    reporters: "default",
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
