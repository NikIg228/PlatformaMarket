import { contractBatchCaptureExample } from "./contract-batch-capture-example";
import { replayContractBatch } from "./contract-batch-replay";

const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
type Method = typeof methods[number];
export type SourceExchangeHeader = Readonly<{ method: Method; pathPattern: string; queryKeys: readonly string[]; httpStatus: number }>;
const omitted = new Set(["body", "requestBody", "request", "summary", "scope", "expected", "query", "comparisonQuery", "cartQuery"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (): never => { throw Error("Invalid owned synthetic exchange headers"); };
function header(raw: Record<string, unknown>): SourceExchangeHeader {
  const method = raw.method, path = raw.path, status = raw.httpStatus;
  if (typeof method !== "string" || !methods.includes(method as Method) || typeof path !== "string" || path.length > 4096 || !path.startsWith("/") || path.startsWith("//") || path.includes("#") || typeof status !== "number" || !Number.isInteger(status) || status < 200 || status > 599) return invalid();
  const parts = path.split("?"); if (parts.length > 2) return invalid();
  const pathPattern = parts[0]!.split("/").map((part, index) => {
    if (!part && index === 0) return ""; if (uuid.test(part)) return "{uuid}";
    if (!/^[A-Za-z0-9_-]+$/.test(part)) return invalid(); return part;
  }).join("/");
  const queryKeys = new Set<string>();
  for (const field of (parts[1] ?? "").split("&")) {
    if (!field) continue;
    let key: string; try { key = decodeURIComponent(field.split("=", 1)[0]!.replace(/\+/g, " ")); } catch { return invalid(); }
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)) return invalid(); queryKeys.add(key);
  }
  return Object.freeze({ method: method as Method, pathPattern, queryKeys: Object.freeze([...queryKeys].sort()), httpStatus: status });
}
/** Metadata extraction for owned synthetic producers only; never traverses a saved body, request or scope. */
export function collectOwnedSourceExchangeHeaders(input: unknown): readonly SourceExchangeHeader[] {
  const result: SourceExchangeHeader[] = []; let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 4096 || depth > 32) return invalid();
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (let index = 0; index < value.length; index++) { if (!Object.hasOwn(value, index)) return invalid(); visit(value[index], depth + 1); } return; }
    const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) return invalid();
    const raw = value as Record<string, unknown>;
    if (["method", "path", "httpStatus"].some(field => Object.hasOwn(raw, field))) { if (result.length >= 512) return invalid(); result.push(header(raw)); return; }
    for (const key of Object.keys(raw)) if (!omitted.has(key)) visit(raw[key], depth + 1);
  };
  visit(input, 0); return Object.freeze(result);
}

/** Source exchange index, not an exhaustive or accepted server API specification. */
export async function sourceExchangeContractIndex() {
  const batch = await contractBatchCaptureExample(), compatible = new Set(["CONSISTENT_READ", "CONSISTENT_RESPONSE", "CONSISTENT_METADATA", "CONSISTENT_RECOVERY", "CONSISTENT_OBSERVATION"]);
  const selected = batch.cases.map((row, sourceCaseIndex) => ({ row, sourceCaseIndex })).filter(entry => compatible.has(entry.row.expected.status));
  const replay = await replayContractBatch({ formatVersion: 1, cases: selected.map(entry => entry.row) });
  if (replay.status !== "EXPECTATIONS_MATCHED" || replay.checkedCases !== selected.length) throw Error("Owned compatible source consumers did not match");
  const cases = selected.map(({ row, sourceCaseIndex }) => Object.freeze({ sourceCaseIndex, family: row.family, sourceStatus: row.expected.status, exchanges: collectOwnedSourceExchangeHeaders(row.input) }));
  type Reference = Readonly<{ sourceCaseIndex: number; exchangeIndex: number }>;
  const grouped = new Map<string, { header: SourceExchangeHeader; statuses: Set<number>; references: Reference[] }>();
  const methodCounts: Record<Method, number> = { GET: 0, POST: 0, PATCH: 0, PUT: 0, DELETE: 0 };
  for (const row of cases) for (const [exchangeIndex, exchange] of row.exchanges.entries()) {
    methodCounts[exchange.method]++;
    const key = JSON.stringify([exchange.method, exchange.pathPattern, exchange.queryKeys]);
    let route = grouped.get(key); if (!route) { route = { header: exchange, statuses: new Set(), references: [] }; grouped.set(key, route); }
    route.statuses.add(exchange.httpStatus); route.references.push(Object.freeze({ sourceCaseIndex: row.sourceCaseIndex, exchangeIndex }));
  }
  const routes = [...grouped.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, route]) => Object.freeze({ method: route.header.method, pathPattern: route.header.pathPattern, queryKeys: route.header.queryKeys, capturedHttpStatuses: Object.freeze([...route.statuses].sort((a, b) => a - b)), references: Object.freeze(route.references) }));
  return Object.freeze({ formatVersion: 1 as const, status: "OWNED_SOURCE_EXCHANGE_INDEX_READY" as const, provenance: "SYNTHETIC_CAPTURE_HEADERS_ONLY" as const, sourceBatchCases: batch.cases.length, compatibleCaseCount: cases.length, sourceFamilyCount: new Set(cases.map(row => row.family)).size, exchangeCount: cases.reduce((sum, row) => sum + row.exchanges.length, 0), uniqueRouteAndQueryShapeCount: routes.length, casesWithoutExplicitHeaders: cases.filter(row => !row.exchanges.length).length, methodCounts: Object.freeze(methodCounts), cases: Object.freeze(cases), routes: Object.freeze(routes), sourceConsumersVerified: true as const, completeAPIContract: false as const, serverAccepted: false as const, productionAuthorizationVerified: false as const, effectProven: false as const, nativeBindingPerformed: false as const, keyProviderAccessed: false as const, credentialStoreAccessed: false as const, privateFileBytesAccessed: false as const, realNetworkRequests: 0 as const, realServerMutations: 0 as const });
}
