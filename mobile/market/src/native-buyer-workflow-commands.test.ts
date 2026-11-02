import { createNativeBuyerWorkflowCommands, nativeBuyerWorkflowAvailable } from "./native-buyer-workflow-commands";
import { createBuyerWorkflowKeys, type BuyerWorkflowInput } from "./order-workflow-command-fixture";
import { createMarketSession } from "./market-session";
import type { ReadScope } from "./read-controller";
import { api, response, server, deferred } from "./test-fixtures/market-session";
import { listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { commandEnvelope } from "./test-fixtures/support-commands";
const scope: ReadScope = { ...listDraftScope, environment: api }, orderId = id(125001), key = id(125002);
const inputs: readonly BuyerWorkflowInput[] = [
  { action: "CANCEL", expectedVersion: 3, idempotencyKey: key, reason: "SYNTHETIC cancellation", transferNotMade: true },
  { action: "RECEIVE_SHIPMENT", expectedVersion: 3, idempotencyKey: key, shipmentId: id(125003), items: [{ shipmentItemId: id(125004), deliveredQuantity: "0.500001" }] },
  { action: "REQUEST_RETURN", expectedVersion: 3, idempotencyKey: key, kind: "GOODS", reason: "SYNTHETIC return", items: [{ orderItemId: id(125005), quantity: "0.500001", condition: "SYNTHETIC damaged" }] },
  { action: "SEND_RETURN_GOODS", expectedVersion: 3, idempotencyKey: key, returnId: id(125006) },
  { action: "RECEIVE_MANUAL_REFUND", expectedVersion: 3, idempotencyKey: key, returnId: id(125006) },
  { action: "REORDER", expectedVersion: 3, idempotencyKey: key },
  { action: "ACCEPT_COMPOSITION", expectedVersion: 3, idempotencyKey: key },
  { action: "OPEN_PAYMENT_DISPUTE", expectedVersion: 3, idempotencyKey: key, claimId: id(125007), reason: "SYNTHETIC dispute" },
];
function setup(entropy = true) { const post = jest.fn(async (_path: string, _body: Readonly<object>): Promise<unknown> => ({})), uuid = jest.fn(() => key), binding = createNativeBuyerWorkflowCommands(scope, post, entropy ? { randomUUID: uuid } : {}, () => true); return { post, uuid, binding, port: binding.port }; }
it.each(inputs)("sends only canonical reviewed native source workflow $action on the fixed route", async input => {
  const s = setup(); expect(s.post).not.toHaveBeenCalled(); expect(s.uuid).not.toHaveBeenCalled(); expect(nativeBuyerWorkflowAvailable(s.port, scope)).toBe(true); expect(s.port.nextWorkflowIdempotencyKey()).toBe(key); await s.port.executeOrderWorkflow(scope, orderId, input); expect(s.post.mock.calls).toEqual([[`/supplier-orders/${orderId}/workflow`, input]]); expect("authorization" in s.port).toBe(false); expect(s.uuid).toHaveBeenCalledTimes(1); s.binding.close();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("blocks changed workflow %s before request", async field => {
  const s = setup(), wrong = { ...scope, [field]: field === "generation" ? 2 : "SYNTHETIC_OTHER" } as ReadScope; expect(nativeBuyerWorkflowAvailable(s.port, wrong)).toBe(false); await expect(s.port.executeOrderWorkflow(wrong, orderId, inputs[0]!)).rejects.toMatchObject({ code: "scope" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it("shares native SDK issuance and event identity checks without synthesizing BUYER grants", () => {
  const s = setup(), pool = createBuyerWorkflowKeys(scope, undefined, s.port); expect(pool.next("REORDER")).toBe(key); expect(pool.acceptEvent(orderId, id(125008), key)).toBe(true); expect(pool.acceptEvent(id(125009), id(125008), key)).toBe(false); pool.denyAuthority("denied"); expect(pool.next()).toBeNull(); expect(pool.authorityIssue()).toBe("denied"); pool.close(); s.binding.close();
});
it("keeps workflow commands unavailable when native UUID is missing or the key was not issued", async () => {
  const s = setup(false); expect(nativeBuyerWorkflowAvailable(s.port, scope)).toBe(false); expect(() => s.port.nextWorkflowIdempotencyKey()).toThrow(); await expect(s.port.executeOrderWorkflow(scope, orderId, inputs[0]!)).rejects.toMatchObject({ code: "key" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it("rejects unsupported supplier actions, raw text, extra fields and path injection before POST", async () => {
  const s = setup(); s.port.nextWorkflowIdempotencyKey();
  await expect(s.port.executeOrderWorkflow(scope, orderId, { action: "ISSUE_INVOICE", expectedVersion: 3, idempotencyKey: key } as unknown as BuyerWorkflowInput)).rejects.toMatchObject({ code: "input" });
  await expect(s.port.executeOrderWorkflow(scope, orderId, { ...inputs[0], reason: " SYNTHETIC raw " } as BuyerWorkflowInput)).rejects.toMatchObject({ code: "input" });
  await expect(s.port.executeOrderWorkflow(scope, orderId, { ...inputs[5], currency: "KZT" } as unknown as BuyerWorkflowInput)).rejects.toMatchObject({ code: "input" });
  await expect(s.port.executeOrderWorkflow(scope, orderId, { ...inputs[2], items: [{ orderItemId: id(125005), quantity: "0.500001", condition: "SYNTHETIC damaged", unsupportedPrice: "100" }] } as unknown as BuyerWorkflowInput)).rejects.toMatchObject({ code: "input" });
  await expect(s.port.executeOrderWorkflow(scope, "../order", inputs[0]!)).rejects.toMatchObject({ code: "input" }); expect(s.post).not.toHaveBeenCalled(); s.binding.close();
});
it("pins original order/action/version/body/key after unknown; only explicit identical replay reaches POST", async () => {
  const s = setup(), input = inputs[0]!; s.port.nextWorkflowIdempotencyKey(); s.post.mockRejectedValueOnce(commandEnvelope(500)); await expect(s.port.executeOrderWorkflow(scope, orderId, input)).rejects.toMatchObject({ status: 500 }); expect(s.post).toHaveBeenCalledTimes(1);
  await expect(s.port.executeOrderWorkflow(scope, orderId, { ...input, expectedVersion: 4 })).rejects.toMatchObject({ code: "input" }); await expect(s.port.executeOrderWorkflow(scope, id(125009), input)).rejects.toMatchObject({ code: "input" }); await expect(s.port.executeOrderWorkflow(scope, orderId, inputs[5]!)).rejects.toMatchObject({ code: "input" }); await s.port.executeOrderWorkflow(scope, orderId, input); expect(s.post.mock.calls[1]).toEqual(s.post.mock.calls[0]); expect(s.uuid).toHaveBeenCalledTimes(1); s.binding.close();
});
it("discards late workflow response data after closing the captured session scope", async () => {
  const s = setup(), pending = deferred<unknown>(); s.port.nextWorkflowIdempotencyKey(); s.post.mockImplementationOnce(() => pending.promise); const work = s.port.executeOrderWorkflow(scope, orderId, inputs[0]!); s.binding.close(); pending.resolve({ private: "SYNTHETIC late order" }); await expect(work).rejects.toMatchObject({ code: "scope" }); expect(nativeBuyerWorkflowAvailable(s.port, scope)).toBe(false); expect(() => s.port.nextWorkflowIdempotencyKey()).toThrow();
});
it.each(["CANCEL", "REORDER"] as const)("does not refresh or replay native%s after business401", async action => {
  const path = `/supplier-orders/${orderId}/workflow`, fetcher = server(route => route === path ? response(commandEnvelope(401).payload, 401) : undefined), manager = createMarketSession(api, fetcher, Date.now, { randomUUID: () => key }); await manager.start(); const session = manager.getSnapshot().session!, port = session.client.nativeBuyerWorkflowCommands!, input = inputs.find(row => row.action === action)!; port.nextWorkflowIdempotencyKey(); await expect(port.executeOrderWorkflow(session.scope, orderId, input)).rejects.toBeDefined(); expect(fetcher.mock.calls.filter(([url]) => url.endsWith(path))).toHaveLength(1); expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); expect(manager.getSnapshot().phase).toBe("signed-out");
});
it("pins the new native counterpart reduction decision to its original bool/row/order/key while retaining the historical fixture actions",async()=>{const s=setup(),input={action:"DECIDE_PAYMENT_REDUCTION" as const,expectedVersion:3,idempotencyKey:key,reductionId:id(125070),accepted:false};s.port.nextWorkflowIdempotencyKey();await s.port.executeOrderWorkflow(scope,orderId,input);await s.port.executeOrderWorkflow(scope,orderId,input);expect(s.post.mock.calls).toEqual([[`/supplier-orders/${orderId}/workflow`,input],[`/supplier-orders/${orderId}/workflow`,input]]);await expect(s.port.executeOrderWorkflow(scope,orderId,{...input,accepted:true})).rejects.toMatchObject({code:"input"});await expect(s.port.executeOrderWorkflow(scope,id(125071),input)).rejects.toMatchObject({code:"input"});expect(s.post).toHaveBeenCalledTimes(2);expect(s.uuid).toHaveBeenCalledTimes(1);s.binding.close();});
it("pins a native all-line reduction proposal to its exact quantities/reason/order/key without widening the legacy fixture actions",async()=>{const s=setup(),input={action:"PROPOSE_PAYMENT_REDUCTION" as const,expectedVersion:3,idempotencyKey:key,reason:"SYNTHETIC reduce composition",items:[{itemId:id(125080),acceptedQuantity:"01.250000"},{itemId:id(125081),acceptedQuantity:"0"}]};s.port.nextWorkflowIdempotencyKey();await s.port.executeOrderWorkflow(scope,orderId,input);await s.port.executeOrderWorkflow(scope,orderId,input);expect(s.post.mock.calls).toEqual([[`/supplier-orders/${orderId}/workflow`,input],[`/supplier-orders/${orderId}/workflow`,input]]);await expect(s.port.executeOrderWorkflow(scope,orderId,{...input,items:[{...input.items[0]!,acceptedQuantity:"1.25"},input.items[1]!]})).rejects.toMatchObject({code:"input"});await expect(s.port.executeOrderWorkflow(scope,orderId,{...input,reason:input.reason+" changed"})).rejects.toMatchObject({code:"input"});expect(s.post).toHaveBeenCalledTimes(2);expect(s.uuid).toHaveBeenCalledTimes(1);s.binding.close();});
