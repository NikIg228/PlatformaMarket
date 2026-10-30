import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { expect, it } from "vitest";

// Execute the actual callback, without replacing it with a second implementation.
function callback(name: string, context: Record<string, unknown>) {
  const file = ts.createSourceFile("component.tsx", readFileSync(new URL("./use-integration-reads.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer && ts.isCallExpression(node.initializer)) expression = node.initializer.arguments[0].getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!expression) throw new Error(`Missing callback ${name}`);
  vm.runInNewContext(ts.transpileModule(`globalThis.callback = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.callback as (supplier: string, connection?: string) => Promise<void>;
}

function harness() {
  const pending: { url: string; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
  const state: Record<string, unknown> = {};
  const context: Record<string, unknown> = { Promise, AbortController, mounted: { current: true }, supplierRead: { current: null }, detailRead: { current: null },
    request: (url: string) => new Promise((resolve, reject) => pending.push({ url, resolve, reject })), loadDetails: async () => {},
  };
  for (const field of ["Connections", "Warehouses", "Offers", "ConnectionId", "Jobs", "Reconciliation", "Loading", "DetailsLoading", "Message", "MessageTone"]) context[`set${field}`] = (value: unknown) => { state[field] = value; };
  return { pending, state, context };
}

it("a late supplier response cannot overwrite the current supplier", async () => {
  const h = harness(), load = callback("loadSupplier", h.context);
  const a = load("A"), b = load("B");
  h.pending.filter(p => p.url.includes("/B/")).forEach(p => p.resolve([{ id: "B" }])); await b;
  h.pending.filter(p => p.url.includes("/A/")).forEach(p => p.resolve([{ id: "A" }])); await a;
  expect(h.state.ConnectionId).toBe("B");
  expect(h.state.Connections).toEqual([{ id: "B" }]);
});

it("a late connection response cannot overwrite current job history", async () => {
  const h = harness(), load = callback("loadDetails", h.context);
  const a = load("supplier", "A"), b = load("supplier", "B");
  h.pending.filter(p => p.url.includes("/B/")).forEach(p => p.resolve([{ id: "B" }])); await b;
  h.pending.filter(p => p.url.includes("/A/")).forEach(p => p.resolve([{ id: "A" }])); await a;
  expect(h.state.Jobs).toEqual([{ id: "B" }]);
});

it("a stale rejection does not overwrite the new context's error/loading state", async () => {
  const h = harness(), load = callback("loadSupplier", h.context);
  const a = load("A"), b = load("B");
  h.pending.filter(p => p.url.includes("/A/")).forEach(p => p.reject(new Error("old failure"))); await a;
  expect(h.state.Loading).toBe(true);
  expect(h.state.Message).toBeUndefined();
  h.pending.filter(p => p.url.includes("/B/")).forEach(p => p.resolve([{ id: "B" }])); await b;
  expect(h.state.Loading).toBe(false);
});

it("current failures remain actionable and a subsequent retry recovers", async () => {
  const h = harness(), load = callback("loadSupplier", h.context);
  const failed = load("A");
  h.pending.forEach(p => p.reject(new Error("offline")));
  await expect(failed).rejects.toThrow("offline");
  expect(h.state.MessageTone).toBe("danger");
  expect(h.state.Loading).toBe(false);
  const count = h.pending.length, retry = load("A");
  h.pending.slice(count).forEach(p => p.resolve([{ id: "recovered" }])); await retry;
  expect(h.state.ConnectionId).toBe("recovered");
});

it("unmounted callbacks cannot commit response state", async () => {
  const h = harness(), load = callback("loadSupplier", h.context);
  const pending = load("A");
  (h.context.mounted as { current: boolean }).current = false;
  h.pending.forEach(p => p.resolve([{ id: "late" }])); await pending;
  expect(h.state.Connections).toEqual([]);
});
