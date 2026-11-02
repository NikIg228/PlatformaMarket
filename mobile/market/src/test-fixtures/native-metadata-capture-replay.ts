import { z } from "zod";
import { documentArchiveItemSchema } from "../../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../../contracts/mobile-read/read-adapter";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { createMarketOperationScope } from "../market-operation-scope";
import { createDocumentArchiveFixtureRead, parseArchiveInput, type ArchiveFixtureQuery } from "../document-archive-fixture-read";
import { createPublicCitiesFixtureRead } from "../public-cities-fixture-read";

const kinds = ["document-archive", "archive-document", "public-cities"] as const;
type Kind = typeof kinds[number];
type MetadataQuery = Extract<ArchiveFixtureQuery, { kind: "document-archive" | "archive-document" }> | { kind: "public-cities" };
type Archive = ReturnType<typeof createDocumentArchiveFixtureRead>;
type Cities = ReturnType<typeof createPublicCitiesFixtureRead>;
type Phase = ReturnType<Archive["getState"]>["phase"] | ReturnType<Cities["getState"]>["phase"] | "not-run";
type Issue = "relation-unverified" | "contract-error" | "visibility-unverified" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error";
export type NativeMetadataCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_READ" | "LIMITED_READ" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "consumer";
  queryKind?: Kind; consumerPhase: Phase; matchedRecords: number;
  summaryIssue: Issue | null; pagination: "provided" | "unconfirmed" | null;
  archiveMetadataOnly: true; serverAccepted: false; productionAuthorizationVerified: false;
  networkRequests: 0; mutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline metadata capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key))) throw new CaptureInputError();
  return input as Record<string, unknown>;
}
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const value = schema.safeParse(input); if (value.success) return value.data; } catch { /* No private exception output. */ }
  throw new CaptureInputError();
}
function scalars(input: unknown, keys: readonly string[]) {
  const source = object(input, keys), result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(source) as string[]) {
    const value = source[key];
    if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    result[key] = value;
  }
  return Object.freeze(result);
}
function queryFor(input: unknown): MetadataQuery {
  const kind = parse(z.object({ kind: z.enum(kinds) }), input).kind;
  const raw = object(input, kind === "document-archive" ? ["kind", "input"] : kind === "archive-document" ? ["kind", "documentId"] : ["kind"]);
  if (kind === "public-cities") return Object.freeze({ kind });
  if (kind === "archive-document") return Object.freeze({ kind, documentId: parse(documentArchiveItemSchema.shape.id, raw.documentId) });
  const fields = scalars(raw.input, ["q", "view", "category", "kind", "status", "accountingStatus", "dateFrom", "dateTo", "cursor", "limit"]);
  const value = parseArchiveInput(fields); if (!value) throw new CaptureInputError();
  return Object.freeze({ kind, input: value });
}

/** Saved JSON through the existing native metadata-only consumers. Never network/auth/file acceptance. */
export async function replayNativeMetadataCapture(input: unknown): Promise<NativeMetadataCaptureReport> {
  let stage: NativeMetadataCaptureReport["stage"] = "input", kind: Kind | undefined, matched = 0, invalid = false;
  let summaryIssue: Issue | null = null, pagination: NativeMetadataCaptureReport["pagination"] = null;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, archive: Archive | undefined, cities: Cities | undefined;
  const report = (status: NativeMetadataCaptureReport["status"], consumerPhase: Phase = "not-run"): NativeMetadataCaptureReport => Object.freeze({ status, stage, ...(kind ? { queryKind: kind } : {}), consumerPhase, matchedRecords: matched, summaryIssue, pagination, archiveMetadataOnly: true, serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
  try {
    const envelope = object(input, ["formatVersion", "scope", "query", "records"]);
    if (envelope.formatVersion !== 1) throw new CaptureInputError();
    const scopeInput = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(scopeInput as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    stage = "query"; const query = queryFor(envelope.query); kind = query.kind;
    stage = "capture"; const records = envelope.records;
    if (!Array.isArray(records) || records.length !== (kind === "document-archive" ? 2 : 1)) throw new CaptureInputError();
    const headers = records.map(value => {
      const record = object(value, ["method", "path", "httpStatus", "body"]);
      const header = parse(z.object({ method: z.literal("GET"), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: record.method, path: record.path, httpStatus: record.httpStatus });
      if (!Object.hasOwn(record, "body")) throw new CaptureInputError();
      return { record, header };
    });
    if (new Set(headers.map(value => value.header.path)).size !== headers.length) throw new CaptureInputError();
    const used = new Set<number>(), client = bindMarketReads(async path => {
      try {
        lifetime!.assert(scope);
        const index = headers.findIndex(value => value.header.path === path);
        if (index < 0 || used.has(index)) throw new CaptureInputError();
        used.add(index); matched++;
        const saved = headers[index]!; let body: unknown;
        try { body = saved.record.body; } catch { throw new CaptureInputError(); }
        if (saved.header.httpStatus < 300) return body;
        throw new MarketHttpError(saved.header.httpStatus, body);
      } catch (error) { if (!(error instanceof MarketHttpError)) { invalid = true; throw new CaptureInputError(); } throw error; }
    }, scope.organizationId);
    stage = "consumer";
    if (query.kind === "public-cities") { cities = createPublicCitiesFixtureRead(scope, client.publicCitiesFixture); await cities.load(); }
    else { archive = createDocumentArchiveFixtureRead(scope, client); await archive.load(query); }
    const state = archive ? archive.getState() : cities!.getState();
    if (invalid || matched !== headers.length) { stage = "capture"; return report("INPUT_INVALID"); }
    if ("read" in state && state.read.kind === "document-archive") { summaryIssue = state.read.value.summaryIssue; pagination = state.read.value.pagination; }
    const consistent = state.phase === "ready" || state.phase === "empty";
    return report(consistent ? summaryIssue || pagination === "unconfirmed" ? "LIMITED_READ" : "CONSISTENT_READ" : "CONSUMER_REJECTED", state.phase);
  } catch { return report(stage === "consumer" ? "CONSUMER_REJECTED" : "INPUT_INVALID", stage === "consumer" ? "error" : "not-run"); }
  finally { lifetime?.close(); archive?.reset(); cities?.reset(); }
}
