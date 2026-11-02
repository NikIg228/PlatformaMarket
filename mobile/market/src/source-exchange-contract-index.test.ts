import { jest } from "@jest/globals";
import { collectOwnedSourceExchangeHeaders, sourceExchangeContractIndex } from "./test-fixtures/source-exchange-contract-index";

afterEach(() => jest.restoreAllMocks());
it("indexes206 explicit captured headers in82 compatible cases and39 route/query shapes", async () => {
  const report = await sourceExchangeContractIndex();
  expect(report).toMatchObject({ formatVersion: 1, status: "OWNED_SOURCE_EXCHANGE_INDEX_READY", provenance: "SYNTHETIC_CAPTURE_HEADERS_ONLY", sourceBatchCases: 447, compatibleCaseCount: 82, sourceFamilyCount: 16, exchangeCount: 206, uniqueRouteAndQueryShapeCount: 39, casesWithoutExplicitHeaders: 0, methodCounts: { GET: 141, POST: 51, PATCH: 7, PUT: 0, DELETE: 7 }, sourceConsumersVerified: true, completeAPIContract: false, serverAccepted: false, productionAuthorizationVerified: false, effectProven: false, nativeBindingPerformed: false, keyProviderAccessed: false, credentialStoreAccessed: false, privateFileBytesAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  expect(Object.isFrozen(report)).toBe(true); expect(Object.isFrozen(report.cases)).toBe(true); expect(Object.isFrozen(report.routes)).toBe(true);
  for (const value of ["00000000-", "SYNTHETIC private", "SYNTHETIC user", "idempotencyKey", "requestBody", "market.example.invalid"]) expect(JSON.stringify(report)).not.toContain(value);
});
it("retains each original case/header position exactly once across grouped routes", async () => {
  const report = await sourceExchangeContractIndex(), references = new Set<string>();
  for (const route of report.routes) for (const reference of route.references) {
    const row = report.cases.find(row => row.sourceCaseIndex === reference.sourceCaseIndex)!, exchange = row.exchanges[reference.exchangeIndex]!;
    expect(exchange).toMatchObject({ method: route.method, pathPattern: route.pathPattern, queryKeys: route.queryKeys }); expect(route.capturedHttpStatuses).toContain(exchange.httpStatus);
    const key = `${reference.sourceCaseIndex}:${reference.exchangeIndex}`; expect(references.has(key)).toBe(false); references.add(key);
  }
  expect(references.size).toBe(206);
});
it("redacts UUID segments and query values before returning immutable header metadata", () => {
  const hidden = jest.fn(() => { throw Error("SENSITIVE_BODY"); }), record = { method: "GET", path: "/orders/00000000-0000-4000-8000-000000000123?offset=0&q=SENSITIVE&offset=99", httpStatus: 200 };
  Object.defineProperty(record, "body", { enumerable: true, get: hidden }); Object.defineProperty(record, "requestBody", { enumerable: true, get: hidden });
  const headers = collectOwnedSourceExchangeHeaders({ records: [record] }); expect(headers).toEqual([{ method: "GET", pathPattern: "/orders/{uuid}", queryKeys: ["offset", "q"], httpStatus: 200 }]); expect(hidden).not.toHaveBeenCalled(); expect(Object.isFrozen(headers[0])).toBe(true); expect(Object.isFrozen(headers[0]!.queryKeys)).toBe(true);
  expect(JSON.stringify(headers)).not.toContain("SENSITIVE"); expect(JSON.stringify(headers)).not.toContain("00000000-");
});
it("does not inspect scope, summaries, request metadata or nested saved bodies", () => {
  const hidden = jest.fn(() => { throw Error("SENSITIVE_METADATA"); }), input = { read: { method: "GET", path: "/orders", httpStatus: 200 } };
  for (const field of ["body", "requestBody", "request", "summary", "scope", "expected", "query", "comparisonQuery", "cartQuery"]) Object.defineProperty(input, field, { enumerable: true, get: hidden });
  expect(collectOwnedSourceExchangeHeaders(input)).toHaveLength(1); expect(hidden).not.toHaveBeenCalled();
});
it.each([
  { method: "TRACE", path: "/orders", httpStatus: 200 }, { method: "GET", path: "https://private.invalid/orders", httpStatus: 200 },
  { method: "GET", path: "//private.invalid/orders", httpStatus: 200 }, { method: "GET", path: "/orders#SENSITIVE", httpStatus: 200 },
  { method: "GET", path: "/orders?q=x?SENSITIVE=y", httpStatus: 200 }, { method: "GET", path: "/orders?%ZZ=value", httpStatus: 200 },
  { method: "GET", path: "/orders?bad+key=value", httpStatus: 200 }, { method: "GET", path: "/orders", httpStatus: 199 },
  { method: "GET", path: "/orders", httpStatus: 600 }, { method: "GET", path: "/orders", httpStatus: 200.5 },
  { method: "GET", path: "/orders" },
])("invalid owned header cannot become a misleading route: %p", record => { expect(() => collectOwnedSourceExchangeHeaders({ records: [record] })).toThrow("Invalid owned synthetic exchange headers"); });
it("bounded traversal refuses cycles and sparse source header lists", () => {
  const cyclic: { child?: unknown } = {}; cyclic.child = cyclic; const sparse: unknown[] = []; sparse.length = 2;
  expect(() => collectOwnedSourceExchangeHeaders(cyclic)).toThrow(); expect(() => collectOwnedSourceExchangeHeaders(sparse)).toThrow();
});
it("source generation and consumer verification avoid global fetch and remain deterministic", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected offline network")); const first = await sourceExchangeContractIndex();
  expect(await sourceExchangeContractIndex()).toEqual(first); expect(fetcher).not.toHaveBeenCalled();
});
