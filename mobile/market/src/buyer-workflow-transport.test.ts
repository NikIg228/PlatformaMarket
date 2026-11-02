import { jest } from "@jest/globals";
import { createBuyerWorkflowTransport, BuyerWorkflowTransportError } from "./buyer-workflow-transport";
import { createMarketTransport, MarketHttpError, type FetchTransport } from "./market-transport";
import { createOrderCancellationCommands } from "./order-cancellation-command";
import { createOrderCancellationDrafts } from "./order-cancellation-draft";
import type { BuyerWorkflowCommandFixture, CancelOrderInput } from "./order-workflow-command-fixture";
import { cancellationCommandScope, cancellationCommandAuthorization, cancellationCommandWorkflow, cancellationCommandResult } from "./test-fixtures/order-cancellation-command";
import { cancellationId as uuid } from "./test-fixtures/cancellation-draft";
const scope = Object.freeze({ ...cancellationCommandScope, environment: "https://market.example.invalid/api" }), id = uuid(64001), key = uuid(64002), line = uuid(64003), reason = "SYNTHETIC reviewed reason";
const base = (action: string) => ({ action, expectedVersion: 5, idempotencyKey: key });
function setup() { let live = true; const post = jest.fn<(path: string, body: Readonly<object>) => Promise<unknown>>().mockResolvedValue({ untouched: true }), model = createBuyerWorkflowTransport(scope, post, () => live); return { post, model, live: (value: boolean) => { live = value; } }; }
const cases = [
  {...base("PROPOSE_PAYMENT_REDUCTION"),reason,items:[{itemId:line,acceptedQuantity:"0.500001"}]},
  {...base("DECIDE_PAYMENT_REDUCTION"),reductionId:line,accepted:true},
  {...base("DECIDE_PAYMENT_REDUCTION"),reductionId:line,accepted:false},
  { ...base("CANCEL"), reason, transferNotMade: true },
  { ...base("RECEIVE_SHIPMENT"), shipmentId: line, items: [{ shipmentItemId: line, deliveredQuantity: "999999999999.999999" }] },
  { ...base("REQUEST_RETURN"), kind: "GOODS", reason, items: [{ orderItemId: line, quantity: "0.500001", condition: "SYNTHETIC reviewed condition" }] },
  { ...base("REQUEST_RETURN"), kind: "CANCELLATION", reason, items: [] },
  { ...base("REQUEST_RETURN"), kind: "OVERPAYMENT", reason, items: [] },
  { ...base("SEND_RETURN_GOODS"), returnId: line },
  { ...base("RECEIVE_MANUAL_REFUND"), returnId: line },
  base("REORDER"), base("ACCEPT_COMPOSITION"), { ...base("OPEN_PAYMENT_DISPUTE"), claimId: line, reason },
];
it("candidate exposes only execute/close and no eligibility, permission, key or GET capability", () => {
  const s = setup(); expect(Object.keys(s.model).sort()).toEqual(["close", "execute"]); expect(Object.isFrozen(s.model)).toBe(true); expect(s.post).not.toHaveBeenCalled();
});
it.each(cases)("preserves selected actual source body for $action", async input => {
  const s = setup(), before = JSON.stringify(input), response = {}; s.post.mockResolvedValueOnce(response); expect(await s.model.execute(scope, id, input)).toBe(response);
  expect(s.post).toHaveBeenCalledWith(`/supplier-orders/${id}/workflow`, input); expect(JSON.stringify(input)).toBe(before); expect(Object.isFrozen(s.post.mock.calls[0]![1])).toBe(true);
});
it.each(["DECIDE_RETURN", "RECEIVE_RETURN_GOODS", "SEND_MANUAL_REFUND", "ISSUE_INVOICE", "REPORT_TRANSFER", "REQUEST_PAYMENT_DETAILS", "CONFIRM_TRANSFER", "RECORD_TRANSFER_CHECK"])("unsupported%s cannot inspect operator/financial body fields", action => {
  const s = setup(), input = base(action), hidden = jest.fn(() => { throw Error("unsupported command payload"); }); for (const field of ["reason", "items", "documentId", "amountMinor"]) Object.defineProperty(input, field, { get: hidden });
  expect(() => s.model.execute(scope, id, input)).toThrow(BuyerWorkflowTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ ...base("REORDER"), expectedVersion: 0 }, { ...base("REORDER"), idempotencyKey: "bad" }, { ...base("CANCEL"), reason, transferNotMade: false }, { ...base("CANCEL"), reason, transferNotMade: true, amountMinor: "100" }])("invalid common/selected source fields never dispatch:%p", input => {
  const s = setup(); expect(() => s.model.execute(scope, id, input)).toThrow(BuyerWorkflowTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each(["CANCEL", "REQUEST_RETURN", "OPEN_PAYMENT_DISPUTE"])("%s cannot silently trim a reviewed reason", action => {
  const s = setup(), input = action === "CANCEL" ? { ...base(action), reason: ` ${reason} `, transferNotMade: true } : action === "REQUEST_RETURN" ? { ...base(action), reason: ` ${reason} `, kind: "CANCELLATION", items: [] } : { ...base(action), reason: ` ${reason} `, claimId: line };
  expect(() => s.model.execute(scope, id, input)).toThrow(BuyerWorkflowTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each([{ kind: "GOODS", items: [] }, { kind: "CANCELLATION", items: [{ orderItemId: line, quantity: "1", condition: "SYNTHETIC" }] }, { kind: "OVERPAYMENT", items: [{ orderItemId: line, quantity: "1", condition: "SYNTHETIC" }] }, { kind: "GOODS" }])("return subset requires explicit source lines or exact empty money-return items:%p", value => {
  const s = setup(); expect(() => s.model.execute(scope, id, { ...base("REQUEST_RETURN"), reason, ...value })).toThrow(BuyerWorkflowTransportError); expect(s.post).not.toHaveBeenCalled();
});
it.each(["condition", "quantity", "extra-field"])("goods return rejects unreviewed/invalid%s without dispatch", field => {
  const s = setup(), selected: Record<string, unknown> = { orderItemId: line, quantity: "0.500001", condition: "SYNTHETIC reviewed condition" }; if (field === "condition") selected.condition = " padded "; if (field === "quantity") selected.quantity = "0"; if (field === "extra-field") selected.amountMinor = "100";
  expect(() => s.model.execute(scope, id, { ...base("REQUEST_RETURN"), reason, kind: "GOODS", items: [selected] })).toThrow(BuyerWorkflowTransportError); expect(s.post).not.toHaveBeenCalled();
});
it("nested source quantities remain exact immutable strings, independent of later caller edits", async () => {
  const s = setup(), input = { ...base("RECEIVE_SHIPMENT"), shipmentId: line, items: [{ shipmentItemId: line, deliveredQuantity: "999999999999.999999" }] }; await s.model.execute(scope, id, input);
  const body = s.post.mock.calls[0]![1] as typeof input; expect(Object.isFrozen(body.items)).toBe(true); expect(Object.isFrozen(body.items[0])).toBe(true); input.items[0]!.deliveredQuantity = "1"; expect(body.items[0]!.deliveredQuantity).toBe("999999999999.999999");
});
it("invalid order id stops before action/body getters", () => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("unbound order command"); }); Object.defineProperty(input, "action", { get: hidden }); expect(() => s.model.execute(scope, "../foreign", input)).toThrow(BuyerWorkflowTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it.each(["environment", "organizationId", "userId", "generation"] as const)("wrong%s scope cannot inspect workflow input", field => {
  const s = setup(), candidate = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : uuid(64004) }, input = {}, hidden = jest.fn(() => { throw Error("foreign workflow body"); }); Object.defineProperty(input, "action", { get: hidden }); expect(() => s.model.execute(candidate, id, input)).toThrow(BuyerWorkflowTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it.each(["fulfilled", "rejected"] as const)("late%s result after scope replacement is dropped before private fields", async outcome => {
  const s = setup(); let yes!: (value: unknown) => void, no!: (value: unknown) => void; s.post.mockImplementationOnce(() => new Promise((resolve, reject) => { yes = resolve; no = reject; })); const work = s.model.execute(scope, id, base("REORDER")); s.live(false);
  const raw = {}, hidden = jest.fn(() => { throw Error("late private workflow"); }); for (const field of ["orderId", "cartId", "version", "status", "payload"]) Object.defineProperty(raw, field, { get: hidden }); if (outcome === "fulfilled") yes(raw); else no(raw); await expect(work).rejects.toThrow(BuyerWorkflowTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).toHaveBeenCalledTimes(1);
});
it.each([401, 403, 409, "network"] as const)("active%s error retains identity without automatic retry", async status => {
  const s = setup(), failure = status === "network" ? Error("lost") : new MarketHttpError(status, { statusCode: status, message: "SYNTHETIC failure" }); s.post.mockRejectedValueOnce(failure); await expect(s.model.execute(scope, id, base("REORDER"))).rejects.toBe(failure); expect(s.post).toHaveBeenCalledTimes(1);
});
it("explicit retry keeps original version/key/body and never opens a returned cart", async () => {
  const s = setup(), input = base("REORDER"), raw = {}, hidden = jest.fn(() => { throw Error("unverified returned cart"); }); Object.defineProperty(raw, "cartId", { get: hidden }); s.post.mockRejectedValueOnce(Error("lost")).mockResolvedValueOnce(raw);
  await expect(s.model.execute(scope, id, input)).rejects.toThrow("lost"); expect(await s.model.execute(scope, id, input)).toBe(raw); expect(s.post.mock.calls[1]).toEqual(s.post.mock.calls[0]); expect(hidden).not.toHaveBeenCalled();
});
it("closed workflow candidate cannot revive or inspect a caller command", () => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("closed command"); }); Object.defineProperty(input, "action", { get: hidden }); s.model.close(); s.live(true); expect(() => s.model.execute(scope, id, input)).toThrow(BuyerWorkflowTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.post).not.toHaveBeenCalled();
});
it("existing native HTTP transport sends one bearer workflow POST with source body and private CSRF", async () => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => "{}" }), http = createMarketTransport(scope.environment, fetcher), raw = createBuyerWorkflowTransport(scope, (path, body) => http.request(path, { method: "POST", body, token: "SYNTHETIC-token", csrf: "SYNTHETIC-csrf" }), () => true), input = { ...base("CANCEL"), reason, transferNotMade: true };
  await raw.execute(scope, id, input); expect(fetcher).toHaveBeenCalledTimes(1); const [url, request] = fetcher.mock.calls[0]!; expect(url).toBe(`${scope.environment}/supplier-orders/${id}/workflow`); expect(request).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store", redirect: "error" }); expect(JSON.parse(request.body as string)).toEqual(input);
  const headers = request.headers as Record<string, string>; expect(headers.authorization).toBe("Bearer SYNTHETIC-token"); expect(headers["x-csrf-token"]).toBe("SYNTHETIC-csrf"); expect(headers["x-user-id"]).toBeUndefined(); raw.close();
});
it("existing cancellation model preserves raw reason and original unknown key through explicit native retry", async () => {
  const s = setup(), workflow = cancellationCommandWorkflow(), drafts = createOrderCancellationDrafts(scope), nextKey = jest.fn(() => key); drafts.syncWorkflow(workflow); const target = drafts.begin(workflow)!, text = "  SYNTHETIC original reason\nЕкінші жол  "; drafts.setReason(target, text); drafts.setDeclaration(target, true); drafts.review(target);
  const fixture: BuyerWorkflowCommandFixture = { authorization: { ...cancellationCommandAuthorization(), scope }, nextWorkflowIdempotencyKey: nextKey, executeOrderWorkflow: s.model.execute }, model = createOrderCancellationCommands(scope, fixture, drafts, selected => selected === workflow.orderId ? workflow : null, async () => workflow, () => true); let receipt: ReturnType<typeof cancellationCommandResult> | null = null, effects = 0;
  s.post.mockImplementation(async (_path, body) => { if (receipt) return receipt; effects++; receipt = cancellationCommandResult(workflow.orderId, body as CancelOrderInput); throw Error("SYNTHETIC committed response lost"); });
  expect(model.canSubmit(workflow, target)).toBe(true); await model.submit(workflow, target); expect(model.stateFor(workflow.orderId).phase).toBe("unknown"); expect(s.post).toHaveBeenCalledTimes(1); expect(drafts.entryForTarget(target)?.reason).toBe(text);
  await model.replay(workflow.orderId); expect(model.stateFor(workflow.orderId).phase).toBe("receipt"); expect(nextKey).toHaveBeenCalledTimes(1); expect(effects).toBe(1); expect(s.post.mock.calls[1]).toEqual(s.post.mock.calls[0]); expect(s.post.mock.calls[0]![1]).toMatchObject({ reason: text.trim(), expectedVersion: workflow.version, idempotencyKey: key, transferNotMade: true }); expect(s.model).not.toHaveProperty("authorization"); model.dispose(); drafts.close(); s.model.close();
});
