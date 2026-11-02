import { jest } from "@jest/globals";
import { createScopedCoreReadQueries } from "./scoped-core-read-queries";
import { coreReadCaptureExample } from "./test-fixtures/core-read-capture-example";
import { listDraftPayload, listDraftId as uuid } from "./test-fixtures/list-draft";
import { bindMarketReads, MarketHttpError } from "./market-transport";
import { createReadController } from "./read-controller";
import type { MobileReadClient } from "../../../contracts/mobile-read/read-queries";
type Row = Record<string, unknown>;
function row(value: unknown) { return value as Row; }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function hidden(value: Row, key: string) { const getter = jest.fn(() => { throw Error("PRIVATE_SCOPED_CORE_FIELD"); }); Object.defineProperty(value, key, { get: getter }); return getter; }
const privateKinds = ["workflow", "cart", "checkout", "organization-profile", "support-tickets", "support-ticket", "workspace-orders", "workspace-carts"] as const;
it.each(privateKinds)("foreign%s is rejected before private DTO fields and without changing the response", async kind => {
  const sample = await coreReadCaptureExample(kind), body = row(sample.records[0]!.body), foreign = uuid(80001); let getter: ReturnType<typeof hidden>;
  if (kind === "workflow") { const order = row(body.order); order.buyerOrganizationId = order.supplierOrganizationId = foreign; getter = hidden(order, "orderNumber"); }
  else if (kind === "cart") { body.buyerOrganizationId = foreign; getter = hidden(body, "items"); }
  else if (kind === "checkout") { body.buyerOrganizationId = foreign; getter = hidden(body, "cart"); }
  else if (kind === "organization-profile") { body.organizationId = foreign; getter = hidden(body, "profile"); }
  else if (kind === "support-tickets") { const ticket = row((sample.records[0]!.body as unknown[])[0]); ticket.organizationId = foreign; getter = hidden(ticket, "subject"); }
  else if (kind === "support-ticket") { body.organizationId = foreign; getter = hidden(body, "messages"); }
  else if (kind === "workspace-orders") { const order = row((body.items as unknown[])[0]); row(order.buyer).id = row(order.supplier).id = foreign; getter = hidden(order, "orderNumber"); }
  else { const current = row(body.current); current.buyerOrganizationId = foreign; getter = hidden(current, "items"); }
  const read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue(sample.records[0]!.body), client = bindMarketReads(read, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  expect(await queries.load(sample.query)).toBe("applied"); expect(queries.getState().phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(1); queries.reset(sample.scope, client);
});
it("controller main reads actually use early metadata guard", async () => {
  const sample = await coreReadCaptureExample(), body = row(sample.records[0]!.body), order = row(body.order); order.buyerOrganizationId = order.supplierOrganizationId = uuid(80002); const getter = hidden(order, "orderNumber"), client = bindMarketReads(async () => body, sample.scope.organizationId), controller = createReadController({ scope: sample.scope, client });
  try { await controller.load(sample.query); expect(controller.getSnapshot().state.phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); }
  finally { controller.dispose(); }
});
it("preserves the source party predicate for an owned supplier-side read without granting any action", async () => {
  const sample = await coreReadCaptureExample(), body = row(sample.records[0]!.body), order = row(body.order), scope = { ...sample.scope, organizationId: order.supplierOrganizationId as string }, client = bindMarketReads(async () => body, scope.organizationId), queries = createScopedCoreReadQueries(scope, client);
  await queries.load(sample.query); expect(queries.getState().phase).toBe("ready"); expect(client).not.toHaveProperty("buyerWorkflowCommandFixture"); queries.reset(sample.scope, client);
});
it("all workspace headers are checked before even an owned row private label when another row is foreign", async () => {
  const sample = await coreReadCaptureExample("workspace-orders"), body = row(sample.records[0]!.body), items = body.items as Row[], foreign = { ...items[0], id: uuid(80004), buyer: { id: uuid(80005) }, supplier: { id: uuid(80006) } }; body.items = [items[0], foreign]; const getter = hidden(items[0]!, "orderNumber"), client = bindMarketReads(async () => body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load(sample.query); expect(queries.getState().phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});
it.each(["same scope", "new generation", "new organization"] as const)("reset to%s drops late success before every metadata getter", async mode => {
  const sample = await coreReadCaptureExample(), gate = deferred<unknown>(), client = bindMarketReads(async () => gate.promise, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client), pending = queries.load(sample.query), next = { ...sample.scope, ...(mode === "new generation" ? { generation: sample.scope.generation + 1 } : mode === "new organization" ? { organizationId: uuid(80007) } : {}) };
  queries.reset(next, client); const body = {}, getter = hidden(body, "order"); gate.resolve(body); expect(await pending).toBe("discarded"); expect(getter).not.toHaveBeenCalled(); expect(queries.getState().phase).toBe("idle");
});
it("new query drops prior private response before metadata even within the same scope", async () => {
  const sample = await coreReadCaptureExample(), gate = deferred<unknown>(), client = bindMarketReads(async path => path.includes("/workflow") ? gate.promise : listDraftPayload("catalog-empty"), sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client), first = queries.load(sample.query);
  await queries.load({ kind: "catalog", input: { q: "", offset: 0 } }); const body = {}, getter = hidden(body, "order"); gate.resolve(body); expect(await first).toBe("discarded"); expect(getter).not.toHaveBeenCalled(); expect(queries.getState().phase).toBe("empty"); queries.reset(sample.scope, client);
});
it("explicit refresh gets a new request lifetime and drops the older response before metadata", async () => {
  const sample = await coreReadCaptureExample(), gate = deferred<unknown>(), read = jest.fn<(path: string) => Promise<unknown>>().mockImplementationOnce(() => gate.promise).mockResolvedValue(sample.records[0]!.body), client = bindMarketReads(read, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client), first = queries.load(sample.query);
  expect(await queries.refresh()).toBe("applied"); const body = {}, getter = hidden(body, "order"); gate.resolve(body); expect(await first).toBe("discarded"); expect(getter).not.toHaveBeenCalled(); expect(read).toHaveBeenCalledTimes(2); expect(queries.getState().phase).toBe("ready"); queries.reset(sample.scope, client);
});
it("a new missing-port read also invalidates prior response metadata", async () => {
  const sample = await coreReadCaptureExample(), gate = deferred<unknown>(), client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => ({}), workspaceOrders: async () => ({}), getOrderWorkflow: async () => gate.promise }, queries = createScopedCoreReadQueries(sample.scope, client), pending = queries.load(sample.query);
  await queries.load({ kind: "cart", cartId: uuid(80008) }); const body = {}, getter = hidden(body, "order"); gate.resolve(body); expect(await pending).toBe("discarded"); expect(getter).not.toHaveBeenCalled(); expect(queries.getState().phase).toBe("error"); queries.reset(sample.scope, client);
});
it.each(["reset", "new query"] as const)("late rejected response after%s cannot inspect private error status/payload", async mode => {
  const sample = await coreReadCaptureExample(), gate = deferred<unknown>(), client = bindMarketReads(async path => path.includes("/workflow") ? gate.promise : listDraftPayload("catalog-empty"), sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client), pending = queries.load(sample.query);
  if (mode === "reset") queries.reset(sample.scope, client); else await queries.load({ kind: "catalog", input: {} }); const failure = {}, status = hidden(failure, "status"), payload = hidden(failure, "payload"); gate.reject(failure); expect(await pending).toBe("discarded"); expect(status).not.toHaveBeenCalled(); expect(payload).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});
it("scope reset from inside metadata cannot accept the old response or parse its labels", async () => {
  const sample = await coreReadCaptureExample(), body = row(sample.records[0]!.body), order = row(body.order), client = bindMarketReads(async () => body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client), getter = hidden(order, "orderNumber");
  Object.defineProperty(order, "buyerOrganizationId", { get: () => { queries.reset(sample.scope, client); return sample.scope.organizationId; } }); expect(await queries.load(sample.query)).toBe("discarded"); expect(getter).not.toHaveBeenCalled();
});
it("active original HTTP error retains actual classifier without retry", async () => {
  const sample = await coreReadCaptureExample(), read = jest.fn<(path: string) => Promise<unknown>>().mockRejectedValue(new MarketHttpError(403, listDraftPayload("error-denied"))), client = bindMarketReads(read, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client); await queries.load(sample.query); expect(queries.getState().phase).toBe("denied"); expect(read).toHaveBeenCalledTimes(1); queries.reset(sample.scope, client);
});
it("refresh before any query remains no-query and makes no request", async () => {
  const sample = await coreReadCaptureExample(), read = jest.fn<(path: string) => Promise<unknown>>(), client = bindMarketReads(read, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client); expect(await queries.refresh()).toBe("no-query"); expect(read).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});

it.each(["workflow root", "workflow order", "cart", "checkout", "checkout cart", "support-ticket", "comparison product", "comparison variant"] as const)("selected-object metadata rejects mismatched%s before private fields", async mode => {
  const kind = mode.startsWith("workflow") ? "workflow" : mode.startsWith("checkout") ? "checkout" : mode.startsWith("comparison") ? "comparison" : mode === "cart" ? "cart" : "support-ticket";
  const sample = await coreReadCaptureExample(kind), body = row(sample.records[0]!.body), other = uuid(81001); let getter: ReturnType<typeof hidden>;
  if (mode.startsWith("workflow")) { if (mode === "workflow root") body.orderId = other; else row(body.order).id = other; getter = hidden(row(body.order), "orderNumber"); }
  else if (mode === "cart") { body.id = other; getter = hidden(body, "items"); }
  else if (mode.startsWith("checkout")) { body[mode === "checkout cart" ? "cartId" : "id"] = other; getter = hidden(body, "cart"); }
  else if (mode === "support-ticket") { body.id = other; getter = hidden(body, "subject"); }
  else { if (mode === "comparison product") row(body.product).id = other; else body.selectedVariantId = other; getter = hidden(row(body.product), "name"); }
  const client = bindMarketReads(async () => body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load(sample.query); expect(queries.getState().phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});

it.each(["internal message", "foreign message", "foreign link"] as const)("public support metadata rejects%s before any message content", async mode => {
  const sample = await coreReadCaptureExample("support-ticket"), body = row(sample.records[0]!.body), messages = body.messages as Row[], first = messages[0]!;
  if (mode === "internal message") first.isInternal = true;
  else if (mode === "foreign message") first.ticketId = uuid(81002);
  else body.links = [{ id: uuid(81003), ticketId: uuid(81004), entityType: "order", entityId: uuid(81005), label: "private", createdAt: "2026-10-29" }];
  const getter = hidden(first, "body"), client = bindMarketReads(async () => body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load(sample.query); expect(queries.getState().phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});

it("comparison without an explicit variant retains the source selected variant semantics", async () => {
  const sample = await coreReadCaptureExample("comparison"); if (sample.query.kind !== "comparison") throw Error("fixture");
  const client = bindMarketReads(async () => sample.records[0]!.body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load({ kind: "comparison", input: { ...sample.query.input, variantId: undefined } }); expect(queries.getState().phase).toBe("ready"); queries.reset(sample.scope, client);
});

it("checkout refresh preserves the original cart selector after caller mutation", async () => {
  const sample = await coreReadCaptureExample("checkout"); if (sample.query.kind !== "checkout") throw Error("fixture");
  const query = { ...sample.query }, read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue(sample.records[0]!.body), client = bindMarketReads(read, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load(query); expect(queries.getState().phase).toBe("ready"); query.cartId = uuid(81006); query.checkoutId = uuid(81007);
  await queries.refresh(); expect(queries.getState().phase).toBe("ready"); expect(read).toHaveBeenCalledTimes(2); expect(read.mock.calls[0]).toEqual(read.mock.calls[1]); queries.reset(sample.scope, client);
});

it("a list read after a selected detail has no leftover object selector", async () => {
  const detail = await coreReadCaptureExample("support-ticket"), list = await coreReadCaptureExample("support-tickets"), read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValueOnce(detail.records[0]!.body).mockResolvedValueOnce(list.records[0]!.body), client = bindMarketReads(read, detail.scope.organizationId), queries = createScopedCoreReadQueries(detail.scope, client);
  await queries.load(detail.query); expect(queries.getState().phase).toBe("ready"); await queries.load(list.query); expect(queries.getState().phase).toBe("ready"); queries.reset(detail.scope, client);
});

it("all public support headers are checked before a valid first message body", async () => {
  const sample = await coreReadCaptureExample("support-ticket"), body = row(sample.records[0]!.body), first = (body.messages as Row[])[0]!, later = { ...first, id: uuid(81008), isInternal: true };
  body.messages = [first, later]; const getter = hidden(first, "body"), client = bindMarketReads(async () => body, sample.scope.organizationId), queries = createScopedCoreReadQueries(sample.scope, client);
  await queries.load(sample.query); expect(queries.getState().phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); queries.reset(sample.scope, client);
});

it("a controller selected-object mismatch cannot inspect the wrong object's private body", async () => {
  const sample = await coreReadCaptureExample("cart"), body = row(sample.records[0]!.body); body.id = uuid(81009); const getter = hidden(body, "items"), client = bindMarketReads(async () => body, sample.scope.organizationId), controller = createReadController({ scope: sample.scope, client });
  try { await controller.load(sample.query); expect(controller.getSnapshot().state.phase).toBe("contract-error"); expect(getter).not.toHaveBeenCalled(); }
  finally { controller.dispose(); }
});
