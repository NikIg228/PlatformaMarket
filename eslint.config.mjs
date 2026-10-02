import tseslint from "typescript-eslint";

// Correctness checks complement tsc. Formatting/unused-code cleanup is separate.
export default [
  { ignores: ["**/node_modules/**", "**/.next*/**", "**/dist/**", "**/coverage/**", "**/.turbo/**", "**/test-results/**", "**/playwright-report/**", "**/blob-report/**", "**/generated/**", "outputs/**", "output/**", ".tmp/**", "tmp/**", "actual_docs/**", "**/next-env.d.ts"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: { parser: tseslint.parser, ecmaVersion: "latest", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@typescript-eslint": tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "constructor-super": "error",
      "no-async-promise-executor": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-constant-binary-expression": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-ex-assign": "error",
      "no-fallthrough": "error",
      "no-invalid-regexp": "error",
      "no-new-symbol": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-sparse-arrays": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
    },
  },
];
