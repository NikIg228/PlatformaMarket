import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it.each([["true", "/admin/login"], ["false", "/login"]])("revoking the current session uses the %s profile route", async (unified, target) => {
  vi.stubEnv("NEXT_PUBLIC_UNIFIED_APP", unified); vi.resetModules();
  const { workspacePath } = await import("../../../packages/api-client/src/frontend-routes");
  const file = ts.createSourceFile("identity-settings.tsx", readFileSync(new URL("./identity-settings.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "onCurrentRevoked" && node.initializer && ts.isJsxExpression(node.initializer)) expression = node.initializer.expression!.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  expect(expression).not.toBe("");
  const events: string[] = [];
  vm.runInNewContext(ts.transpileModule(`(${expression})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    workspacePath, clearAdminSession: () => events.push("clear"), window: { location: { assign: (url: string) => events.push(url) } },
  });
  expect(events).toEqual(["clear", target]);
});
