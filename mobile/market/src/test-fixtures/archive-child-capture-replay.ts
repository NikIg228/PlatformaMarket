import { z } from "zod";
import { documentArchiveItemSchema } from "../../../../packages/schemas/src/core-api";
import type { ReadScope } from "../read-controller";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import { archiveChildCaptureKinds, createArchiveChildCaptureKernel, selectArchiveChildCapture, type ArchiveChildCaptureKind } from "./archive-child-capture-kernel";

type ReaderState = ReturnType<ReturnType<typeof createArchiveChildCaptureKernel>["reader"]["getState"]>;
export type ArchiveChildCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_METADATA" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "child"; kind?: ArchiveChildCaptureKind;
  parentPhase: ReaderState["phase"] | "not-run"; consumerPhase: ReaderState["phase"] | "not-run"; resultKind?: "archive-document" | "archive-history" | "archive-signatures" | "archive-participants";
  metadataRows?: number; syntheticGetCalls: number; responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY";
  selectionProvenance: "SOURCE_ISSUED_OPAQUE_TARGET"; fullSourceFixtureUsed: boolean;
  nativeMetadataLimitChanged: false; nativeBindingPerformed: false; productionAuthorizationVerified: false; serverAccepted: false;
  originalFileBytesAccessed: false; originalChecksumVerified: false; cryptographicSignatureVerified: false; currentDocumentVersionInferred: false;
  credentialStoreAccessed: false; keyProviderAccessed: false; networkRequests: 0; mutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline archive child metadata capture"); } }
function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CaptureInputError(); const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError(); return value as Record<string, unknown>;
}
function scalars(value: unknown, allowed: readonly string[]) {
  const raw = object(value, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) { const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); Object.defineProperty(result, key, { value, enumerable: true }); } return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T { try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* No caller data or getter errors in reports. */ } throw new CaptureInputError(); }
function record(value: unknown) {
  const raw = object(value, ["method", "path", "httpStatus", "body"]), header = decode(z.object({ method: z.literal("GET"), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body")) throw new CaptureInputError(); return { raw, header };
}
const expectedSchema = z.object({ documentId: documentArchiveItemSchema.shape.id, documentVersion: documentArchiveItemSchema.shape.version }).strict();
const rootBinding = documentArchiveItemSchema.pick({ id: true, version: true }).strip();

/** Existing private child metadata consumers only. No original delivery, hashing, cryptographic result or native-limit change. */
export async function replayArchiveChildCapture(input: unknown): Promise<ArchiveChildCaptureReport> {
  let stage: ArchiveChildCaptureReport["stage"] = "input", kind: ArchiveChildCaptureKind | undefined, parentPhase: ArchiveChildCaptureReport["parentPhase"] = "not-run", consumerPhase: ArchiveChildCaptureReport["consumerPhase"] = "not-run", resultKind: ArchiveChildCaptureReport["resultKind"], metadataRows: number | undefined, syntheticGetCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, kernel: ReturnType<typeof createArchiveChildCaptureKernel> | undefined;
  const report = (status: ArchiveChildCaptureReport["status"]): ArchiveChildCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, consumerPhase, ...(resultKind ? { resultKind } : {}), ...(metadataRows === undefined ? {} : { metadataRows }), syntheticGetCalls, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", selectionProvenance: "SOURCE_ISSUED_OPAQUE_TARGET", fullSourceFixtureUsed: kernel !== undefined, nativeMetadataLimitChanged: false, nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, currentDocumentVersionInferred: false, credentialStoreAccessed: false, keyProviderAccessed: false, networkRequests: 0, mutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "records"]); if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(archiveChildCaptureKinds), envelope.kind);
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape)));
    stage = "capture"; if (!Array.isArray(envelope.records) || envelope.records.length !== (kind === "archive-related" ? 4 : 2)) invalid(); const records = (envelope.records as unknown[]).map(record);
    kernel = createArchiveChildCaptureKernel(scope, async path => {
      const saved = records[syntheticGetCalls]; if (!saved || path !== saved.header.path || stage !== "parent" && stage !== "child") return invalid(); syntheticGetCalls++;
      let body: unknown; try { body = saved.raw.body; } catch { return invalid(); } if (saved.header.httpStatus >= 300) throw new MarketHttpError(saved.header.httpStatus, body);
      if (stage === "parent") { const root = rootBinding.safeParse(body); if (!root.success || root.data.id !== expected.documentId || root.data.version !== expected.documentVersion) return null; }
      return body;
    });
    if (!kernel.nativeMetadataLimitPreserved()) return invalid(); const reader = kernel.reader;
    stage = "parent"; await reader.load({ kind: "archive-document", documentId: expected.documentId }); let state = reader.getState(); parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "archive-document") return report("CONSUMER_REJECTED");
    const query = selectArchiveChildCapture(reader, kind); if (!query) return report("UNSUPPORTED_CONTEXT");
    stage = "child"; await reader.load(query); state = reader.getState(); consumerPhase = state.phase;
    if (invalidCapture || !kernel.nativeMetadataLimitPreserved()) return report("INPUT_INVALID");
    if (!("read" in state) || !["ready", "empty"].includes(state.phase)) return report("CONSUMER_REJECTED");
    if (state.read.kind === "archive-document") { resultKind = "archive-document"; metadataRows = 1; }
    else if (state.read.kind === "archive-history") { resultKind = "archive-history"; metadataRows = state.read.value.versions.length; }
    else if (state.read.kind === "archive-signatures") { resultKind = "archive-signatures"; metadataRows = state.read.value.signatures.length; }
    else if (state.read.kind === "archive-participants") { resultKind = "archive-participants"; metadataRows = state.read.value.participants.length; }
    else return report("CONSUMER_REJECTED");
    return report(syntheticGetCalls === records.length ? "CONSISTENT_METADATA" : "INPUT_INVALID");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
