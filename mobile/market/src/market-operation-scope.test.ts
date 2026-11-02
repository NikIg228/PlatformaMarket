import { jest } from "@jest/globals";
import { createMarketOperationScope } from "./market-operation-scope";
import { createConversationReadTransport } from "./conversation-read-transport";
import { createConversationCommandTransport } from "./conversation-command-transport";
import { createCartCommandTransport } from "./cart-command-transport";
import { createBuyerWorkflowTransport } from "./buyer-workflow-transport";
import { createBuyerWorkspaceTransport } from "./buyer-workspace-transport";
import { createNativeUuidSource } from "./native-uuid-source";
import { cancellationCommandScope } from "./test-fixtures/order-cancellation-command";
import { cancellationId as uuid } from "./test-fixtures/cancellation-draft";
import type { ReadScope } from "./read-controller";

const scope = Object.freeze({ ...cancellationCommandScope, environment: "https://market.example.invalid/api" }), key = uuid(67001), id = uuid(67002);
const unavailable = () => Error("SYNTHETIC context unavailable");
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalidation by %s getter cannot pass the final lifetime assertion", field => {
  let live = true;
  const lifetime = createMarketOperationScope(scope, () => live, unavailable), candidate = { ...scope }, getter = jest.fn(() => { live = false; return scope[field]; }); Object.defineProperty(candidate, field, { get: getter });
  expect(() => lifetime.assert(candidate)).toThrow("SYNTHETIC context unavailable"); expect(getter).toHaveBeenCalledTimes(1);
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("close by %s getter cannot pass while returning matching metadata", field => {
  const lifetime = createMarketOperationScope(scope, () => true, unavailable), candidate = { ...scope }; Object.defineProperty(candidate, field, { get: () => { lifetime.close(); return scope[field]; } });
  expect(() => lifetime.assert(candidate)).toThrow("SYNTHETIC context unavailable"); expect(() => lifetime.assert(scope)).toThrow("SYNTHETIC context unavailable");
});
it("close inside a liveness callback returning true stops before candidate getters", () => {
  const lifetime = createMarketOperationScope(scope, () => { lifetime.close(); return true; }, unavailable), candidate = { ...scope }, hidden = jest.fn(() => scope.userId); Object.defineProperty(candidate, "userId", { get: hidden });
  expect(() => lifetime.assert(candidate)).toThrow("SYNTHETIC context unavailable"); expect(hidden).not.toHaveBeenCalled();
});
it("post-decode liveness callback cannot close while returning true", () => {
  let calls = 0;
  const lifetime = createMarketOperationScope(scope, () => { if (++calls === 2) lifetime.close(); return true; }, unavailable);
  expect(() => lifetime.assert(scope)).toThrow("SYNTHETIC context unavailable"); expect(calls).toBe(2);
});
it.each(["false", "throw"] as const)("post-decode liveness %s uses the fixed unavailable facade", outcome => {
  let calls = 0;
  const lifetime = createMarketOperationScope(scope, () => { if (++calls === 1) return true; if (outcome === "throw") throw Error("SYNTHETIC private state"); return false; }, unavailable);
  expect(() => lifetime.assert(scope)).toThrow("SYNTHETIC context unavailable"); expect(calls).toBe(2);
});
it("live matching metadata keeps the frozen selector and ignores private extra payload getters", () => {
  const lifetime = createMarketOperationScope(scope, () => true, unavailable), candidate = { ...scope }, hidden = jest.fn(() => { throw Error("SYNTHETIC private field"); }); Object.defineProperty(candidate, "privatePayload", { get: hidden });
  expect(() => lifetime.assert(candidate)).not.toThrow(); expect(lifetime.owner).toEqual(scope); expect(Object.isFrozen(lifetime.owner)).toBe(true); expect(hidden).not.toHaveBeenCalled();
});
it("already inactive context stops before all candidate metadata getters", () => {
  const lifetime = createMarketOperationScope(scope, () => false, unavailable), candidate = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private metadata"); }); for (const field of Object.keys(scope)) Object.defineProperty(candidate, field, { get: hidden });
  expect(() => lifetime.assert(candidate as ReadScope)).toThrow("SYNTHETIC context unavailable"); expect(hidden).not.toHaveBeenCalled();
});

type Port = Readonly<{ run: (candidate: ReadScope) => unknown; close: () => void }>;
const ports: { name: string; build: (call: () => Promise<unknown>, live: () => boolean) => Port }[] = [
  { name: "conversation GET", build(call, live) { const model = createConversationReadTransport(scope, call, live); return { run: candidate => model.list(candidate), close: model.close }; } },
  { name: "conversation POST", build(call, live) { const model = createConversationCommandTransport(scope, call, live); return { run: candidate => model.send(candidate, id, { body: "SYNTHETIC reviewed", idempotencyKey: key }), close: model.close }; } },
  { name: "cart POST", build(call, live) { const model = createCartCommandTransport(scope, call, live); return { run: candidate => model.checkout(candidate, id, { expectedVersion: 2, idempotencyKey: key }), close: model.close }; } },
  { name: "workflow POST", build(call, live) { const model = createBuyerWorkflowTransport(scope, call, live); return { run: candidate => model.execute(candidate, id, { action: "REORDER", expectedVersion: 2, idempotencyKey: key }), close: model.close }; } },
  { name: "workspace GET", build(call, live) { const model = createBuyerWorkspaceTransport(scope, call, call, live); return { run: candidate => model.savedLists(candidate), close: model.close }; } },
  { name: "workspace POST", build(call, live) { const model = createBuyerWorkspaceTransport(scope, call, call, live); return { run: candidate => model.createSavedList(candidate, { name: "SYNTHETIC reviewed", isDefault: false }), close: model.close }; } },
];
it.each(ports)("$name cannot dispatch after caller metadata invalidates scope", async port => {
  let live = true;
  const call = jest.fn<() => Promise<unknown>>().mockResolvedValue({}), model = port.build(call, () => live), candidate = { ...scope }; Object.defineProperty(candidate, "generation", { get: () => { live = false; return scope.generation; } });
  await expect(Promise.resolve().then(() => model.run(candidate))).rejects.toThrow(); expect(call).not.toHaveBeenCalled(); model.close();
});
it.each(ports)("$name cannot dispatch if invalidation occurs in the last pre-dispatch scope check", async port => {
  let live = true, reads = 0;
  const call = jest.fn<() => Promise<unknown>>().mockResolvedValue({}), model = port.build(call, () => live), candidate = { ...scope }; Object.defineProperty(candidate, "generation", { get: () => { if (++reads === 2) live = false; return scope.generation; } });
  await expect(Promise.resolve().then(() => model.run(candidate))).rejects.toThrow(); expect(call).not.toHaveBeenCalled(); expect(reads).toBe(2); model.close();
});
it.each(ports)("$name rejects a result when caller scope expires during the post-response metadata read", async port => {
  let live = true, reads = 0, yes!: (value: unknown) => void;
  const call = jest.fn<() => Promise<unknown>>().mockImplementation(() => new Promise(resolve => { yes = resolve; })), model = port.build(call, () => live), candidate = { ...scope };
  Object.defineProperty(candidate, "generation", { get: () => { if (++reads === 3) live = false; return scope.generation; } }); const work = model.run(candidate), raw = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private result"); }); Object.defineProperty(raw, "body", { get: hidden }); yes(raw);
  await expect(work).rejects.toThrow(); expect(call).toHaveBeenCalledTimes(1); expect(hidden).not.toHaveBeenCalled(); model.close();
});
it("native entropy cannot be consumed after matching scope getter invalidates lifetime", () => {
  let live = true;
  const generate = jest.fn(() => key), source = createNativeUuidSource(scope, { randomUUID: generate }, () => live), candidate = { ...scope }; Object.defineProperty(candidate, "generation", { get: () => { live = false; return scope.generation; } });
  expect(() => source.next(candidate)).toThrow(); expect(generate).not.toHaveBeenCalled(); source.close();
});
