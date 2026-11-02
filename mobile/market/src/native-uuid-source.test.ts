import { jest } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { createNativeUuidSource, NativeUuidSourceError, type NativeUuidProvider } from "./native-uuid-source";
import { createBuyerWorkflowTransport } from "./buyer-workflow-transport";
import { createOrderCancellationCommands } from "./order-cancellation-command";
import { createOrderCancellationDrafts } from "./order-cancellation-draft";
import type { BuyerWorkflowCommandFixture, CancelOrderInput } from "./order-workflow-command-fixture";
import { cancellationCommandScope, cancellationCommandAuthorization, cancellationCommandWorkflow, cancellationCommandResult } from "./test-fixtures/order-cancellation-command";
import { cancellationId as uuid } from "./test-fixtures/cancellation-draft";

const scope = Object.freeze({ ...cancellationCommandScope, environment: "https://market.example.invalid/api" }), key = uuid(65001);
function setup(provider?: NativeUuidProvider) {
  let live = true;
  const generate = jest.fn<() => unknown>().mockReturnValue(key), source = createNativeUuidSource(scope, provider ?? { randomUUID: generate }, () => live);
  return { source, generate, live: (value: boolean) => { live = value; } };
}
function errorCode(action: () => unknown, code: NativeUuidSourceError["code"]) {
  try { action(); throw Error("Expected UUID failure"); }
  catch (error) { expect(error).toBeInstanceOf(NativeUuidSourceError); expect((error as NativeUuidSourceError).code).toBe(code); expect((error as Error).message).not.toContain("SYNTHETIC private"); }
}
it("construction and capability reads consume no entropy and expose no keys, grants or source records", () => {
  const s = setup(); expect(s.source.canIssue(scope)).toBe(true); expect(s.source.canIssue(scope)).toBe(true); expect(s.generate).not.toHaveBeenCalled();
  expect(Object.keys(s.source).sort()).toEqual(["canIssue", "close", "next"]); expect(Object.isFrozen(s.source)).toBe(true); expect(s.source).not.toHaveProperty("authorization");
});
it("captures the native method with its receiver without invoking or later replacing it", () => {
  let calls = 0;
  const provider = { randomUUID() { expect(this).toBe(provider); calls++; return key; } }, source = createNativeUuidSource(scope, provider, () => true);
  provider.randomUUID = () => { throw Error("SYNTHETIC private replacement"); };
  expect(calls).toBe(0); expect(source.next(scope)).toBe(key); expect(calls).toBe(1);
});
it.each([undefined, {}, { randomUUID: undefined }, { randomUUID: "SYNTHETIC private" }, { randomUUID: null }])("missing or non-function native capability fails without fallback:%p", provider => {
  const source = createNativeUuidSource(scope, provider as NativeUuidProvider | undefined, () => true); expect(source.canIssue(scope)).toBe(false); errorCode(() => source.next(scope), "unavailable");
});
it("a throwing provider getter is unavailable and never leaks its private failure", () => {
  const hidden = jest.fn(() => { throw Error("SYNTHETIC private provider"); }), provider = {}; Object.defineProperty(provider, "randomUUID", { get: hidden });
  const source = createNativeUuidSource(scope, provider, () => true); expect(hidden).toHaveBeenCalledTimes(1); expect(source.canIssue(scope)).toBe(false); errorCode(() => source.next(scope), "unavailable"); expect(hidden).toHaveBeenCalledTimes(1);
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("foreign %s cannot consume entropy", field => {
  const s = setup(), candidate = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : field === "product" ? "other" : uuid(65002) };
  expect(s.source.canIssue(candidate as typeof scope)).toBe(false); errorCode(() => s.source.next(candidate as typeof scope), "scope"); expect(s.generate).not.toHaveBeenCalled();
});
it("invalid initial scope is rejected before provider access", () => {
  const hidden = jest.fn(() => { throw Error("SYNTHETIC private getter"); }), provider = {}; Object.defineProperty(provider, "randomUUID", { get: hidden });
  errorCode(() => createNativeUuidSource({ ...scope, generation: 0 }, provider, () => true), "scope"); expect(hidden).not.toHaveBeenCalled();
});
it("inactive context rejects caller scope getters before consuming entropy", () => {
  const s = setup(), candidate = { ...scope }, hidden = jest.fn(() => { throw Error("SYNTHETIC private scope"); }); Object.defineProperty(candidate, "organizationId", { get: hidden }); s.live(false);
  expect(s.source.canIssue(candidate)).toBe(false); errorCode(() => s.source.next(candidate), "scope"); expect(hidden).not.toHaveBeenCalled(); expect(s.generate).not.toHaveBeenCalled();
});
it("throwing liveness fails closed before entropy", () => {
  const generate = jest.fn(() => key), source = createNativeUuidSource(scope, { randomUUID: generate }, () => { throw Error("SYNTHETIC private liveness"); });
  expect(source.canIssue(scope)).toBe(false); errorCode(() => source.next(scope), "scope"); expect(generate).not.toHaveBeenCalled();
});
it("provider exceptions become fixed entropy failures with no automatic retry", () => {
  const s = setup(); s.generate.mockImplementation(() => { throw Error("SYNTHETIC private entropy"); }); errorCode(() => s.source.next(scope), "entropy"); expect(s.generate).toHaveBeenCalledTimes(1);
});
it.each(["returned", "thrown"] as const)("scope invalidated inside %s provider takes precedence over private results", outcome => {
  const s = setup(), raw = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private result"); }); Object.defineProperty(raw, "toString", { get: hidden });
  s.generate.mockImplementation(() => { s.live(false); if (outcome === "thrown") throw raw; return raw; }); errorCode(() => s.source.next(scope), "scope"); expect(hidden).not.toHaveBeenCalled(); expect(s.generate).toHaveBeenCalledTimes(1);
});
it.each(["", "SYNTHETIC private", "ABCDEF01-2345-4ABC-8ABC-ABCDEF012345", ` ${key}`, `${key}\n`, "00000000-0000-0000-0000-000000000000", "00000000-0000-1000-8000-000000000001", "00000000-0000-4000-7000-000000000001", null, 12, {}])("invalid native UUID is rejected unchanged without substitute:%p", value => {
  const s = setup(); s.generate.mockReturnValue(value); errorCode(() => s.source.next(scope), "invalid"); expect(s.generate).toHaveBeenCalledTimes(1);
});
it("non-string return does not inspect private coercion, thenable or property getters", () => {
  const s = setup(), raw = {}, hidden = jest.fn(() => { throw Error("SYNTHETIC private coercion"); }); for (const name of ["toString", "valueOf", "then", "id"]) Object.defineProperty(raw, name, { get: hidden });
  s.generate.mockReturnValue(raw); errorCode(() => s.source.next(scope), "invalid"); expect(hidden).not.toHaveBeenCalled();
});
it("duplicate UUID cannot be reused and causes no extra entropy attempt", () => {
  const s = setup(); expect(s.source.next(scope)).toBe(key); errorCode(() => s.source.next(scope), "duplicate"); expect(s.generate).toHaveBeenCalledTimes(2);
  s.generate.mockReturnValueOnce(uuid(65003)); expect(s.source.next(scope)).toBe(uuid(65003)); expect(s.generate).toHaveBeenCalledTimes(3);
});
it("reentrant generation cannot issue the same source twice", () => {
  const s = setup(); s.generate.mockImplementation(() => { expect(s.source.canIssue(scope)).toBe(false); errorCode(() => s.source.next(scope), "unavailable"); return key; });
  expect(s.source.next(scope)).toBe(key); expect(s.generate).toHaveBeenCalledTimes(1);
});
it("close during native generation drops the generated value and permanently disables the source", () => {
  const s = setup(); s.generate.mockImplementation(() => { s.source.close(); return key; }); errorCode(() => s.source.next(scope), "scope"); s.live(true);
  expect(s.source.canIssue(scope)).toBe(false); errorCode(() => s.source.next(scope), "scope"); expect(s.generate).toHaveBeenCalledTimes(1);
});
it("ordinary close cannot be reversed by a matching new generation object or live callback", () => {
  const s = setup(); expect(s.source.next(scope)).toBe(key); s.source.close(); s.live(true); expect(s.source.canIssue({ ...scope })).toBe(false); errorCode(() => s.source.next({ ...scope }), "scope"); expect(s.generate).toHaveBeenCalledTimes(1);
});
it("explicit Node test-only crypto provider works without claiming device availability", () => {
  const source = createNativeUuidSource(scope, { randomUUID }, () => true), first = source.next(scope), second = source.next(scope); expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); expect(second).not.toBe(first); source.close();
});
it("existing confirmed cancellation consumes one native-source UUID only on submit and retains it across explicit unknown replay", async () => {
  const s = setup(), workflow = cancellationCommandWorkflow(), drafts = createOrderCancellationDrafts(scope), post = jest.fn<(path: string, body: Readonly<object>) => Promise<unknown>>(), transport = createBuyerWorkflowTransport(scope, post, () => true);
  const fixture: BuyerWorkflowCommandFixture = { authorization: { ...cancellationCommandAuthorization(), scope }, nextWorkflowIdempotencyKey: () => s.source.next(scope), executeOrderWorkflow: transport.execute };
  const model = createOrderCancellationCommands(scope, fixture, drafts, id => id === workflow.orderId ? workflow : null, async () => workflow, () => true);
  drafts.syncWorkflow(workflow); const target = drafts.begin(workflow)!; drafts.setReason(target, "SYNTHETIC reviewed cancellation"); drafts.setDeclaration(target, true); drafts.review(target);
  expect(model.canSubmit(workflow, target)).toBe(true); expect(s.source.canIssue(scope)).toBe(true); expect(s.generate).not.toHaveBeenCalled();
  let receipt: ReturnType<typeof cancellationCommandResult> | null = null, effects = 0;
  post.mockImplementation(async (_path, body) => { if (receipt) return receipt; receipt = cancellationCommandResult(workflow.orderId, body as CancelOrderInput); effects++; throw Error("SYNTHETIC committed response lost"); });
  await model.submit(workflow, target); expect(model.stateFor(workflow.orderId).phase).toBe("unknown"); expect(s.generate).toHaveBeenCalledTimes(1); expect(post).toHaveBeenCalledTimes(1);
  await model.replay(workflow.orderId); expect(model.stateFor(workflow.orderId).phase).toBe("receipt"); expect(s.generate).toHaveBeenCalledTimes(1); expect(effects).toBe(1); expect(post.mock.calls[1]).toEqual(post.mock.calls[0]); expect(post.mock.calls[0]![1]).toMatchObject({ idempotencyKey: key }); model.dispose(); drafts.close(); transport.close(); s.source.close();
});
it("missing native capability produces existing model key-error and sends no cancellation", async () => {
  const source = createNativeUuidSource(scope, undefined, () => true), workflow = cancellationCommandWorkflow(), drafts = createOrderCancellationDrafts(scope), execute = jest.fn<BuyerWorkflowCommandFixture["executeOrderWorkflow"]>();
  const fixture: BuyerWorkflowCommandFixture = { authorization: { ...cancellationCommandAuthorization(), scope }, nextWorkflowIdempotencyKey: () => source.next(scope), executeOrderWorkflow: execute }, model = createOrderCancellationCommands(scope, fixture, drafts, () => workflow, async () => workflow, () => true);
  drafts.syncWorkflow(workflow); const target = drafts.begin(workflow)!; drafts.setReason(target, "SYNTHETIC cancellation"); drafts.setDeclaration(target, true); drafts.review(target); await model.submit(workflow, target);
  expect(model.stateFor(workflow.orderId).phase).toBe("key-error"); expect(execute).not.toHaveBeenCalled(); model.dispose(); drafts.close(); source.close();
});
