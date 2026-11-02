import { jest } from "@jest/globals";
import { replayCoreReadCapture } from "./test-fixtures/core-read-capture-replay";
import { coreReadCaptureExample } from "./test-fixtures/core-read-capture-example";
import { listDraftPayload, listDraftId as uuid } from "./test-fixtures/list-draft";
import { bindMarketReads, MarketHttpError } from "./market-transport";
import { createMobileReadQueries, type MobileReadQuery } from "../../../contracts/mobile-read/read-queries";

const kinds = ["catalog", "comparison", "workspace-orders", "organization-profile", "workflow", "cart", "checkout", "workspace-carts", "support-tickets", "support-ticket"] as const;
type Example = Awaited<ReturnType<typeof coreReadCaptureExample>>;
function flags(report: Awaited<ReturnType<typeof replayCoreReadCapture>>) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
}
function hiddenBody(example: Example) { const hidden = jest.fn(() => { throw Error("SENSITIVE_CAPTURE_BODY_GETTER"); }); Object.defineProperty(example.records[0]!, "body", { get: hidden }); return hidden; }
async function recapture(query: MobileReadQuery, body: unknown) {
  const example = await coreReadCaptureExample(), records: Example["records"] = [], client = bindMarketReads(async path => { records.push({ method: "GET", path, httpStatus: 200, body }); return body; }, example.scope.organizationId), queries = createMobileReadQueries(example.scope, client); await queries.load(query); queries.reset(example.scope, client); return { ...example, query, records };
}
afterEach(() => jest.restoreAllMocks());
it.each(kinds)("replays%s through actual native route binding/protected source decoder, without exposing raw fields", async kind => {
  const example = await coreReadCaptureExample(kind), before = JSON.stringify(example), report = await replayCoreReadCapture(example); expect(report).toMatchObject({ status: "CONSISTENT_READ", stage: "consumer", queryKind: kind, matchedRecords: 1 }); flags(report); expect(JSON.stringify(example)).toBe(before);
  for (const field of ["scope", "path", "body", "requestId", "userId", "organizationId", "response", "read", "payload"]) expect(report).not.toHaveProperty(field);
});
it.each(["catalog", "comparison", "workspace-orders", "workspace-carts", "support-tickets"] as const)("valid empty%s remains an explicit empty source read", async kind => {
  const example = await coreReadCaptureExample(kind);
  example.records[0]!.body = kind === "catalog" ? listDraftPayload("catalog-empty") : kind === "comparison" ? { ...(example.records[0]!.body as object), offers: [] } : kind === "workspace-orders" ? { items: [], nextCursor: null } : kind === "workspace-carts" ? { current: null, items: [], nextCursor: null } : [];
  const report = await replayCoreReadCapture(example); expect(report).toMatchObject({ status: "CONSISTENT_READ", consumerPhase: "empty" }); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, scope: {} }])("malformed root metadata produces a fixed report:%p", async input => { const report = await replayCoreReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid%s scope cannot inspect captured body", async field => {
  const example = await coreReadCaptureExample(), hidden = hiddenBody(example), scope = { ...example.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE_INVALID_SCOPE" };
  const report = await replayCoreReadCapture({ ...example, scope }); expect(report).toMatchObject({ status: "INPUT_INVALID", stage: "input", matchedRecords: 0 }); expect(hidden).not.toHaveBeenCalled(); flags(report);
});
it.each(["root token", "scope token", "query token", "record token", "record headers"])("extra%s is rejected without reading token or body getters", async field => {
  const example = await coreReadCaptureExample(), body = hiddenBody(example), hidden = jest.fn(() => { throw Error("SENSITIVE_CAPTURE_TOKEN"); });
  const target = field === "root token" ? example : field === "scope token" ? { ...example.scope } : field === "query token" ? example.query : example.records[0]!;
  Object.defineProperty(target, field === "record headers" ? "headers" : "accessToken", { get: hidden }); const input = field === "scope token" ? { ...example, scope: target } : example;
  const report = await replayCoreReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(hidden).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["POST", "full URL", "foreign path", "wrong query", "status low", "status high", "missing body", "extra record", "no record"])("invalid capture%s fails before body access", async field => {
  const example = await coreReadCaptureExample(), hidden = hiddenBody(example), record: Record<string, unknown> = example.records[0]!;
  if (field === "POST") record.method = "POST"; if (field === "full URL") record.path = `https://private.invalid${record.path}`; if (field === "foreign path") record.path = `/supplier-orders/${uuid(79001)}/workflow`; if (field === "wrong query") record.path = `${record.path}?injected=true`; if (field === "status low") record.httpStatus = 199; if (field === "status high") record.httpStatus = 600;
  const input = field === "missing body" ? { ...example, records: [{ method: record.method, path: record.path, httpStatus: record.httpStatus }] } : field === "extra record" ? { ...example, records: [record, record] } : field === "no record" ? { ...example, records: [] } : example;
  const report = await replayCoreReadCapture(input); expect(report).toMatchObject({ status: "INPUT_INVALID", matchedRecords: 0 }); expect(hidden).not.toHaveBeenCalled(); flags(report);
});
it.each(["workflow", "cart", "checkout", "support-ticket"] as const)("invalid%s selector stops before saved response body", async kind => {
  const example = await coreReadCaptureExample(kind), hidden = hiddenBody(example), query = { ...example.query, [kind === "workflow" ? "orderId" : kind === "cart" ? "cartId" : kind === "checkout" ? "checkoutId" : "ticketId"]: "../SENSITIVE_SELECTOR" };
  expect((await replayCoreReadCapture({ ...example, query })).status).toBe("INPUT_INVALID"); expect(hidden).not.toHaveBeenCalled();
});
it.each(["catalog", "comparison"] as const)("caller-supplied buyer organization cannot replace captured scope for%s", async kind => {
  const example = await coreReadCaptureExample(kind), hidden = hiddenBody(example), query = example.query as Extract<MobileReadQuery, { kind: "catalog" | "comparison" }>;
  const report = await replayCoreReadCapture({ ...example, query: { ...query, input: { ...query.input, buyerOrganizationId: uuid(79002) } } }); expect(report).toMatchObject({ status: "INPUT_INVALID", stage: "query" }); expect(hidden).not.toHaveBeenCalled();
});
it("preserves raw catalog scalar text and lets the actual native dispatcher encode it", async () => {
  const base = await coreReadCaptureExample("catalog"), query: MobileReadQuery = { kind: "catalog", input: { q: "  SYNTHETIC  ", inStock: "false", offset: "0002", minSalePriceMinor: "90071992547409931234", includeFilterOptions: "true" } }, example = await recapture(query, base.records[0]!.body), wire = example.records[0]!.path;
  expect(wire).toContain("offset=0002"); expect(wire).toContain("inStock=false"); expect(wire).toContain("minSalePriceMinor=90071992547409931234"); expect(wire).toContain("q=++SYNTHETIC++"); expect((await replayCoreReadCapture(example)).status).toBe("CONSISTENT_READ"); expect(example.records[0]!.path).toBe(wire);
});
it("preserves source comparison quantity text rather than serializing coerced numeric output", async () => {
  const example = await coreReadCaptureExample("comparison"); expect(example.records[0]!.path).toContain("quantity=1.000000"); expect((await replayCoreReadCapture(example)).status).toBe("CONSISTENT_READ");
});
it("does not leak decoded private labels or exact financial strings in the report", async () => {
  const example = await coreReadCaptureExample("cart"), body = example.records[0]!.body as { items: { unitPriceMinor: string }[] }; expect(body.items[0]!.unitPriceMinor).toBe("90071992547409931234"); const before = JSON.stringify(example), report = await replayCoreReadCapture(example), output = JSON.stringify(report);
  expect(report.status).toBe("CONSISTENT_READ"); expect(output).not.toContain("90071992547409931234"); expect(output).not.toContain("SYNTHETIC"); expect(output).not.toContain(example.scope.organizationId); expect(JSON.stringify(example)).toBe(before); flags(report);
});
it("foreign workflow is rejected by the protected source consumer before private order label", async () => {
  const example = await coreReadCaptureExample(), body = example.records[0]!.body as { order: { buyerOrganizationId: string; orderNumber: string } }, hidden = jest.fn(() => { throw Error("SENSITIVE_FOREIGN_ORDER"); }); body.order.buyerOrganizationId = uuid(79003); Object.defineProperty(body.order, "orderNumber", { get: hidden });
  const report = await replayCoreReadCapture(example); expect(report.status).toBe("CONSUMER_REJECTED"); expect(hidden).not.toHaveBeenCalled(); expect(JSON.stringify(report)).not.toContain("SENSITIVE"); flags(report);
});
it("source unsupported workflow remains explicitly unsupported without native action admission", async () => {
  const example = await coreReadCaptureExample(), body = example.records[0]!.body as { status: string; order: { status: string } }; body.status = body.order.status = "FUTURE_CAPTURE_STATUS";
  const report = await replayCoreReadCapture(example); expect(report).toMatchObject({ status: "UNSUPPORTED_READ", consumerPhase: "unsupported" }); expect(JSON.stringify(report)).not.toContain("FUTURE_CAPTURE_STATUS"); flags(report);
});
it.each([[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const)("actual HTTP%i classifier produces redacted%s with no private error prose/request id", async (status, phase) => {
  const example = await coreReadCaptureExample(); example.records[0]!.httpStatus = status; example.records[0]!.body = { statusCode: status, code: "SENSITIVE_ERROR_CODE", message: "SENSITIVE_ERROR_PROSE", requestId: "SENSITIVE_REQUEST_ID", path: example.records[0]!.path, timestamp: "2026-10-30T00:00:00.000Z" };
  const report = await replayCoreReadCapture(example); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: phase }); expect(JSON.stringify(report)).not.toContain("SENSITIVE"); flags(report);
});
it("mismatching HTTP payload status remains source contract-error", async () => {
  const example = await coreReadCaptureExample(); example.records[0]!.httpStatus = 403; example.records[0]!.body = listDraftPayload("error-throttled"); expect(await replayCoreReadCapture(example)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" });
});
it("a throwing own body getter cannot forge a server HTTP error", async () => {
  const example = await coreReadCaptureExample(); Object.defineProperty(example.records[0]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replayCoreReadCapture(example); expect(report.status).toBe("INPUT_INVALID"); expect(JSON.stringify(report)).not.toContain("SENSITIVE");
});
it("native success marker remains local for a captured non200 success; no wire/server acceptance claim", async () => {
  const example = await coreReadCaptureExample(); example.records[0]!.httpStatus = 201; const report = await replayCoreReadCapture(example); expect(report.status).toBe("CONSISTENT_READ"); expect(example.records[0]!.httpStatus).toBe(201); flags(report);
});
it("no global fetch or timer is used by saved core replay", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")), timer = jest.spyOn(globalThis, "setTimeout"), example = await coreReadCaptureExample(); const calls = timer.mock.calls.length;
  expect((await replayCoreReadCapture(example)).status).toBe("CONSISTENT_READ"); expect(fetcher).not.toHaveBeenCalled(); expect(timer).toHaveBeenCalledTimes(calls);
});
