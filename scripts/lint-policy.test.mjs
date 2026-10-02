import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

test("lint independently catches JavaScript and TypeScript correctness errors", async () => {
  const eslint = new ESLint();
  for (const [filePath, code, rule] of [
    ["scripts/lint-fixture.mjs", "const value = { enabled: true, enabled: false };", "no-dupe-keys"],
    ["apps/api/src/lint-fixture.ts", "enum Status { Pending = 1, Active = 1 }", "@typescript-eslint/no-duplicate-enum-values"],
    ["apps/web/app/lint-fixture.tsx", "const Widget = () => { try { return <div />; } finally { return null; } };", "no-unsafe-finally"],
  ]) {
    const [result] = await eslint.lintText(code, { filePath });
    assert.ok(result.messages.some(message => message.ruleId === rule), `${filePath}: ${rule} must be active`);
  }
});

test("source files are checked while generated build artifacts are ignored", async () => {
  const eslint = new ESLint();
  for (const path of ["apps/api/src/bootstrap.ts", "apps/web/app/page.tsx", "packages/schemas/src/index.ts", "apps/e2e/playwright.unified.config.ts"]) assert.equal(await eslint.isPathIgnored(path), false);
  for (const path of ["apps/api/dist/src/main.js", "apps/web/.next/server/app.js", "apps/web/generated/data.ts", "apps/web/next-env.d.ts"]) assert.equal(await eslint.isPathIgnored(path), true);
});
