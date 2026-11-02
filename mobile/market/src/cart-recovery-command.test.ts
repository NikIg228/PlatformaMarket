import { recoverCartSchema } from "../../../packages/schemas/src/index";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createCartWorkspaceCommands } from "./cart-workspace-command-fixture";
import type { CartCommandFixture, CartVersionInput } from "./cart-command-fixture";
import { cartCommandAuthorization, cartCommandError, cartCommandScope, createdCartResult, recoveryCartSource, recoveredCartResult, recoveryTargetId } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { supportId } from "./test-fixtures/support";

function setup() {
  const source = recoveryCartSource();
  let page: WorkspaceCartPage | null = savedPage(null, [source]), next: WorkspaceCartPage | undefined = page, otherLocked = false;
  // Use the actual decoded page object, not the pre-parse source reference.
  const original = page, selected = page.items[0]!;
  const recover = jest.fn(async (_scope: typeof cartCommandScope, _id: string, _input: CartVersionInput): Promise<unknown> => recoveredCartResult());
  const create = jest.fn(async (): Promise<unknown> => createdCartResult());
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), recoverCart: recover, createCart: create };
  const read = jest.fn(async () => { if (next) page = next; return next; });
  const model = createCartWorkspaceCommands(cartCommandScope, fixture, () => page, read, () => otherLocked);
  return { model, original, selected, fixture, recover, create, read, current: () => page, setPage: (value: WorkspaceCartPage | null) => { page = value; }, setNext: (value: WorkspaceCartPage | undefined) => { next = value; }, lockOther: (value: boolean) => { otherLocked = value; } };
}

it("sends only strict source expectedVersion to the original cart ID and preserves source/current state", async () => {
  const s = setup(), before = JSON.stringify(s.original);
  await s.model.startRecovery(s.original, s.selected);
  expect(s.recover.mock.calls[0]).toEqual([cartCommandScope, s.selected.id, recoverCartSchema.parse({ expectedVersion: 4 })]);
  const input = s.recover.mock.calls[0]![2]; expect(Object.isFrozen(input)).toBe(true); expect(Object.keys(input)).toEqual(["expectedVersion"]); expect(input).not.toHaveProperty("idempotencyKey");
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", operation: "recover", sourceCartId: s.selected.id, result: { id: recoveryTargetId, version: 1 } });
  expect(JSON.stringify(s.original)).toBe(before); expect(s.create).not.toHaveBeenCalled();
});

it("accepts an already edited/checked-out previous target without copying old items, prices or expectedVersion", async () => {
  const s = setup(), target = recoveredCartResult(91); target.status = "CHECKED_OUT"; target.checkout = { id: supportId(90), status: "COMPLETED" }; target.items[0]!.quantity = "99"; target.items[0]!.totalPriceMinor = "90071992547409939999";
  s.recover.mockResolvedValueOnce(target); await s.model.startRecovery(s.original, s.selected);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { version: 91, status: "CHECKED_OUT", items: [{ quantity: "99", totalPriceMinor: "90071992547409939999" }] } });
});

it("allows the source's empty ACTIVE current-cart case without retiring or editing it locally", async () => {
  const s = setup(), current = createdCartResult(); current.items = []; s.original.current = current;
  await s.model.startRecovery(s.original, s.selected); expect(s.recover).toHaveBeenCalledTimes(1); expect(s.original.current).toBe(current); expect(current.status).toBe("ACTIVE"); expect(current.version).toBe(7);
});

it.each(["items", "checkout", "future-status"] as const)("refuses new recovery when current cart has %s", async kind => {
  const s = setup(), current = createdCartResult();
  if (kind !== "items") current.items = []; if (kind === "checkout") current.checkout = { id: supportId(75) }; if (kind === "future-status") current.status = "FUTURE";
  s.original.current = current; expect(s.model.currentWorkBlocksRecovery(s.original)).toBe(true);
  await s.model.startRecovery(s.original, s.selected); expect(s.recover).not.toHaveBeenCalled();
});

it.each(["absent-port", "permission", "organizationId", "userId", "environment", "generation", "retained-page", "clone-row", "source-owner", "source-status", "checkout", "checkout-status", "recovered-pointer", "invalid-version", "other-mutation"] as const)("rejects invalid recovery admission: %s", async kind => {
  const s = setup(); let selected = s.selected;
  if (kind === "absent-port") delete s.fixture.recoverCart;
  if (kind === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  if (["organizationId", "userId", "environment", "generation"].includes(kind)) s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [kind]: kind === "generation" ? 99 : kind === "environment" ? "other" : supportId(99) } };
  if (kind === "retained-page") s.setPage(savedPage(null, [recoveryCartSource()])); if (kind === "clone-row") selected = { ...selected };
  if (kind === "source-owner") selected.buyerOrganizationId = supportId(99); if (kind === "source-status") selected.status = "ACTIVE"; if (kind === "checkout") selected.checkout = null; if (kind === "checkout-status") selected.checkout!.status = "COMPLETED";
  if (kind === "recovered-pointer") selected.recoveredCartId = recoveryTargetId; if (kind === "invalid-version") selected.version = 0; if (kind === "other-mutation") s.lockOther(true);
  await s.model.startRecovery(s.original, selected); expect(s.recover).not.toHaveBeenCalled();
});

it("locks all new recovery/create actions during pending and sends no duplicated recovery", async () => {
  const s = setup(); let finish!: (value: unknown) => void; s.recover.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const pending = s.model.startRecovery(s.original, s.selected); await s.model.startRecovery(s.original, s.selected); await s.model.start(s.original); await s.model.replayRecovery();
  expect(s.recover).toHaveBeenCalledTimes(1); expect(s.create).not.toHaveBeenCalled(); expect(s.model.blocksOtherMutations()).toBe(true);
  finish(recoveredCartResult()); await pending;
});

it("replays the immutable original after committed response loss, a newer source and a nonempty/checked-out target, executing recovery once", async () => {
  const s = setup(); let executions = 0, receipt: CartResponse | null = null;
  s.recover.mockImplementation(async (_scope, id, _input) => {
    expect(id).toBe(s.selected.id);
    if (receipt) return receipt;
    executions++; receipt = recoveredCartResult(); throw new Error("SYNTHETIC committed response lost");
  });
  await s.model.startRecovery(s.original, s.selected); const originalInput = s.recover.mock.calls[0]![2]; expect(s.model.hasUnresolvedRecovery()).toBe(true);
  const newer = recoveryCartSource(25); newer.recoveredCartId = recoveryTargetId; const current = recoveredCartResult(12); current.items[0]!.quantity = "90";
  const page = savedPage(current, [newer]); s.setPage(page);
  receipt = { ...current, status: "CHECKED_OUT", checkout: { id: supportId(86), status: "COMPLETED" } };
  expect(s.model.canReplayRecovery()).toBe(true); await s.model.replayRecovery();
  expect(s.recover.mock.calls[1]![2]).toBe(originalInput); expect(originalInput.expectedVersion).toBe(4); expect(executions).toBe(1);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { id: recoveryTargetId, status: "CHECKED_OUT", version: 12 } }); expect(s.model.hasUnresolvedRecovery()).toBe(false); expect(s.model.getSnapshot().priorUnknown).toBeFalsy();
});

it("keeps original replay input after preparing and cancelling a newer-version recovery", async () => {
  const s = setup(); s.recover.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await s.model.startRecovery(s.original, s.selected); const originalInput = s.recover.mock.calls[0]![2];
  s.setNext(savedPage(null, [recoveryCartSource(8)])); await s.model.readCurrent(); s.model.prepareNew(); expect(s.model.getSnapshot().input).toEqual({ expectedVersion: 8 });
  s.model.returnToReview(); expect(s.model.getSnapshot().input).toBe(originalInput); await s.model.replayRecovery();
  expect(s.recover.mock.calls[1]![2]).toBe(originalInput);
});

it("after a definitive409 needs fresh read, explicit version review and submission, without auto-rebase", async () => {
  const s = setup(); s.recover.mockRejectedValueOnce(cartCommandError(409)); await s.model.startRecovery(s.original, s.selected); const old = s.recover.mock.calls[0]![2];
  expect(s.model.canReplayRecovery()).toBe(false); await s.model.startRecovery(s.original, s.selected); expect(s.recover).toHaveBeenCalledTimes(1);
  s.setNext(savedPage(null, [recoveryCartSource(8)])); await s.model.readCurrent(); expect(s.model.getSnapshot().input).toBe(old); s.model.prepareNew(); expect(s.recover).toHaveBeenCalledTimes(1);
  await s.model.submitPrepared(); expect(s.recover.mock.calls[1]![2]).toEqual({ expectedVersion: 8 }); expect(old.expectedVersion).toBe(4);
});

it.each([400, 401, 403, 404, 409] as const)("does not invent recovery success/replay after definite%s", async status => {
  const s = setup(); s.recover.mockRejectedValueOnce(cartCommandError(status)); await s.model.startRecovery(s.original, s.selected);
  expect(s.model.getSnapshot().phase).toBe("rejected"); expect(s.model.canReplayRecovery()).toBe(false); await s.model.replayRecovery(); expect(s.recover).toHaveBeenCalledTimes(1);
});

it.each(["5xx", "timeout", "malformed-error", "invalid-result"] as const)("keeps %s uncertain with only same-source replay", async kind => {
  const s = setup(); if (kind === "invalid-result") s.recover.mockResolvedValueOnce({}); else s.recover.mockRejectedValueOnce(kind === "5xx" ? cartCommandError(503) : kind === "timeout" ? new Error("SYNTHETIC timeout") : { status: 403, payload: { statusCode: 500 } });
  await s.model.startRecovery(s.original, s.selected); expect(s.model.getSnapshot().phase).toBe("unknown"); expect(s.model.canReplayRecovery()).toBe(true);
  await s.model.startRecovery(s.original, s.selected); await s.model.start(s.original); expect(s.recover).toHaveBeenCalledTimes(1); expect(s.create).not.toHaveBeenCalled();
});

it.each(["source-absent", "source-status", "source-checkout", "source-owner"] as const)("forbids replay without the same currently permitted failed source: %s", async kind => {
  const s = setup(); s.recover.mockRejectedValueOnce(new Error("SYNTHETIC lost response")); await s.model.startRecovery(s.original, s.selected);
  if (kind === "source-absent") s.setPage(savedPage(null, [])); if (kind === "source-status") s.selected.status = "ACTIVE"; if (kind === "source-checkout") s.selected.checkout!.status = "COMPLETED"; if (kind === "source-owner") s.selected.buyerOrganizationId = supportId(99);
  expect(s.model.canReplayRecovery()).toBe(false); await s.model.replayRecovery(); expect(s.recover).toHaveBeenCalledTimes(1);
});

it.each(["owner", "same-source-id", "known-target"] as const)("rejects wrong recovery result %s before reading item content", async kind => {
  const s = setup();
  // known-target is learned only on a separate read after an unknown attempt.
  if (kind === "known-target") { s.recover.mockRejectedValueOnce(new Error("SYNTHETIC timeout")); await s.model.startRecovery(s.original, s.selected); s.selected.recoveredCartId = recoveryTargetId; }
  const result = { id: kind === "same-source-id" ? s.selected.id : kind === "known-target" ? supportId(98) : recoveryTargetId, buyerOrganizationId: kind === "owner" ? supportId(99) : cartCommandScope.organizationId };
  const decoded = jest.fn(() => { throw new Error("Wrong recovery result items decoded"); }); Object.defineProperty(result, "items", { get: decoded }); s.recover.mockResolvedValueOnce(result);
  if (kind === "known-target") await s.model.replayRecovery(); else await s.model.startRecovery(s.original, s.selected);
  expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).toBe("unknown");
});

it.each(["line-binding", "duplicate-item"] as const)("rejects unbound recovered cart content: %s", async kind => {
  const s = setup(), target = recoveredCartResult(); if (kind === "line-binding") target.items[0]!.cartId = s.selected.id; else target.items.push({ ...target.items[0]! });
  s.recover.mockResolvedValueOnce(target); await s.model.startRecovery(s.original, s.selected); expect(s.model.getSnapshot().phase).toBe("unknown");
});

it.each(["dispose", "deny", "grant", "port", "page", "source-id", "source-version", "source-checkout", "source-status", "source-owner", "source-pointer"] as const)("does not decode late recovery content after %s changes", async kind => {
  const s = setup(); let finish!: (value: unknown) => void; s.recover.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.startRecovery(s.original, s.selected);
  if (kind === "dispose") s.model.dispose(); if (kind === "deny") s.model.denyAll(); if (kind === "grant") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; if (kind === "port") delete s.fixture.recoverCart;
  if (kind === "page") s.setPage(savedPage(null, [recoveryCartSource()])); if (kind === "source-id") s.selected.id = supportId(99); if (kind === "source-version") s.selected.version++;
  if (kind === "source-checkout") s.selected.checkout!.id = supportId(99); if (kind === "source-status") s.selected.status = "ACTIVE"; if (kind === "source-owner") s.selected.buyerOrganizationId = supportId(99); if (kind === "source-pointer") s.selected.recoveredCartId = recoveryTargetId;
  const decoded = jest.fn(() => { throw new Error("Late recovery decoded"); }), result = {}; Object.defineProperty(result, "id", { get: decoded }); finish(result); await pending;
  expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).not.toBe("result");
});

it("does not confuse an unrelated prior create unknown with this recovery's definite rejection or resolved receipt", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC earlier create lost reply")); await s.model.start(s.original); await s.model.readCurrent(); s.model.acknowledge();
  expect(s.model.getSnapshot().priorUnknown).toBe(true); s.recover.mockRejectedValueOnce(cartCommandError(403)); await s.model.startRecovery(s.original, s.selected); await s.model.readCurrent();
  expect(s.model.canReplayRecovery()).toBe(false); expect(s.model.hasUnresolvedRecovery()).toBe(false);
  s.model.prepareNew(); await s.model.submitPrepared(); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", priorUnknown: true });
});

it("does not infer recovery receipt from a later supplied pointer/current cart; acknowledgement only observes those facts", async () => {
  const s = setup(); s.recover.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await s.model.startRecovery(s.original, s.selected);
  const source = recoveryCartSource(9); source.recoveredCartId = recoveryTargetId; s.setNext(savedPage(recoveredCartResult(), [source])); await s.model.readCurrent();
  expect(s.model.getSnapshot().phase).toBe("review"); expect(s.model.getSnapshot().result).toBeUndefined(); expect(s.model.canPrepare()).toBe(false); expect(s.model.canReplayRecovery()).toBe(true);
  s.model.acknowledge(); expect(s.model.getSnapshot()).toEqual({ phase: "observed", priorUnknown: true }); expect(s.model.canReplayRecovery()).toBe(false);
});

it("can reread a prepared recovery while restoring the last sent immutable version", async () => {
  const s = setup(); s.recover.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await s.model.startRecovery(s.original, s.selected); const original = s.recover.mock.calls[0]![2];
  s.setNext(savedPage(null, [recoveryCartSource(8)])); await s.model.readCurrent(); s.model.prepareNew(); expect(s.model.getSnapshot().input).toEqual({ expectedVersion: 8 });
  s.setNext(savedPage(null, [recoveryCartSource(9)])); expect(s.model.canRead()).toBe(true); await s.model.readCurrent(); expect(s.model.getSnapshot().phase).toBe("review"); expect(s.model.getSnapshot().input).toBe(original); expect(s.model.canReplayRecovery()).toBe(true);
});
