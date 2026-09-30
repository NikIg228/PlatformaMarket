import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      deps: {
        // Fluent's ESM imports Tabster by name. Transform this dependency chain
        // so Vite handles CJS interop instead of Node's static named exports.
        inline: [/@fluentui\//, "tabster"],
      },
    },
  },
});
