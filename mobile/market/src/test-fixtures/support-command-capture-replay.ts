import { z } from "zod";
import { createSupportTicketSchema, addSupportMessageSchema } from "../../../../packages/schemas/src/commercial";
import { supportTicketQuerySchema, supportTicketSummarySchema } from "../../../../packages/schemas/src/support-workflow";
import { createMarketOperationScope } from "../market-operation-scope";
import type { ReadScope, MobileReadState } from "../read-controller";
import { MarketHttpError } from "../market-transport";
import { createSupportCommandCaptureKernel, supportCommandCaptureKinds, submitSupportCapture, type SupportCommandCaptureKind, type SupportCaptureProof } from "./support-command-capture-kernel";

export type SupportCommandCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "command"; kind?: SupportCommandCaptureKind;
  parentPhase: MobileReadState["phase"] | "not-run"; operationPhase?: SupportCaptureProof["phase"]; operationIssue?: string;
  sourceResponseAccepted: boolean; unresolved: boolean; parentGetCalls: number; commandCalls: number; syntheticCapturedKeyReads: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY"; reviewProvenance: "SIMULATED_SOURCE_FORM_ONLY";
  nativeBindingPerformed: false; nativeKeyProviderAccessed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false; serverAccepted: false; effectProven: false;
  independentPostResponseReadPerformed: false; privateFileBytesAccessed: false; credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline support command capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError(); const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError(); return input as Record<string, unknown>;
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), snapshot: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) { const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); Object.defineProperty(snapshot, key, { value, enumerable: true }); } return Object.freeze(snapshot);
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T { try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* Fixed redacted report only. */ } throw new CaptureInputError(); }
function record(input: unknown, method: "GET" | "POST") {
  const raw = object(input, ["method", "path", "httpStatus", "body", ...(method === "POST" ? ["requestBody"] : [])]);
  const header = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || method === "POST" && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError(); return { raw, header };
}
function requestSnapshot(input: unknown, kind: SupportCommandCaptureKind) {
  const schema = kind === "support-create" ? createSupportTicketSchema : addSupportMessageSchema;
  const allowed = Object.keys(schema.shape).filter(field => field !== (kind === "support-create" ? "attachments" : "reopen")), raw = object(input, allowed), snapshot: Record<string, unknown> = {};
  for (const field of Object.keys(raw)) {
    let value = raw[field];
    if (field === "links" || field === "attachments") { if (!Array.isArray(value) || value.length !== 0 || Reflect.ownKeys(value).some(key => key !== "length")) throw new CaptureInputError(); value = Object.freeze([]); }
    else if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    Object.defineProperty(snapshot, field, { value, enumerable: true });
  }
  if (kind === "support-create" ? !Object.hasOwn(snapshot, "links") : snapshot.isInternal !== false || !Object.hasOwn(snapshot, "attachments")) throw new CaptureInputError();
  decode<unknown>(schema.strict(), snapshot); return Object.freeze(snapshot);
}
function matches(actual: Readonly<object>, saved: Readonly<Record<string, unknown>>) {
  const body = actual as Readonly<Record<string, unknown>>, keys = Object.keys(body).sort(), wanted = Object.keys(saved).sort();
  return keys.length === wanted.length && keys.every((field, index) => field === wanted[index] && (Object.is(body[field], saved[field]) || ["links", "attachments"].includes(field) && Array.isArray(body[field]) && body[field].length === 0 && Array.isArray(saved[field]) && saved[field].length === 0));
}
const binding = supportTicketSummarySchema.pick({ id: true, version: true }).strip();
const expectedSchema = z.object({ ticketId: supportTicketSummarySchema.shape.id, ticketVersion: supportTicketSummarySchema.shape.version }).strict();

/** Initial general support responses only, with original parent readers and command models; no optimistic ticket/message. */
export async function replaySupportCommandCapture(input: unknown): Promise<SupportCommandCaptureReport> {
  let stage: SupportCommandCaptureReport["stage"] = "input", kind: SupportCommandCaptureKind | undefined, parentPhase: SupportCommandCaptureReport["parentPhase"] = "not-run", operation: SupportCaptureProof | undefined, parentGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, kernel: ReturnType<typeof createSupportCommandCaptureKernel> | undefined;
  const report = (status: SupportCommandCaptureReport["status"]): SupportCommandCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, ...(operation ? { operationPhase: operation.phase, ...(operation.issue ? { operationIssue: operation.issue } : {}) } : {}), sourceResponseAccepted: operation?.phase === "success", unresolved: operation?.phase === "unknown" || operation?.phase === "invalid-result", parentGetCalls, commandCalls, syntheticCapturedKeyReads: kernel?.capturedKeyReads() ?? 0, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_FORM_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "query", "expected", "parent", "operation"]); if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(supportCommandCaptureKinds), envelope.kind);
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    let queryInput: z.input<typeof supportTicketQuerySchema> | undefined, expected: z.output<typeof expectedSchema> | undefined;
    if (kind === "support-create") { if (Object.hasOwn(envelope, "expected")) invalid(); const query = object(envelope.query, ["kind", "input"]); if (query.kind !== "support-tickets") invalid(); const raw = scalars(query.input, Object.keys(supportTicketQuerySchema.shape)); decode(supportTicketQuerySchema.strict(), raw); queryInput = raw; }
    else { if (Object.hasOwn(envelope, "query")) invalid(); expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape))); }
    stage = "capture"; const parent = record(envelope.parent, "GET"), savedOperation = record(envelope.operation, "POST");
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let snapshot: Readonly<Record<string, unknown>> | undefined;
    const request = () => { if (snapshot) return snapshot; try { snapshot = requestSnapshot(savedOperation.raw.requestBody, kind!); return snapshot; } catch { return invalid(); } };
    kernel = createSupportCommandCaptureKernel(scope, async path => {
      if (stage !== "parent" || parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; const body = response(parent);
      if (expected) { const root = binding.safeParse(body); if (!root.success || root.data.id !== expected.ticketId || root.data.version !== expected.ticketVersion) return null; } return body;
    }, async (path, body) => { if (stage !== "command" || commandCalls || path !== savedOperation.header.path || !matches(body, request())) return invalid(); commandCalls++; return response(savedOperation); }, () => { const key = request().idempotencyKey; if (typeof key !== "string") return invalid(); return key; });
    const controller = kernel.controller; stage = "parent";
    await controller.load(kind === "support-create" ? { kind: "support-tickets", input: queryInput! } : { kind: "support-ticket", ticketId: expected!.ticketId });
    const state = controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== (kind === "support-create" ? "support-tickets" : "support-ticket")) return report("CONSUMER_REJECTED");
    stage = "command"; const proof = await submitSupportCapture(controller, kind, request()); if (invalidCapture) return report("INPUT_INVALID"); if (!proof) return report("UNSUPPORTED_CONTEXT"); operation = proof;
    return report(commandCalls === 1 && operation.phase === "success" ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
