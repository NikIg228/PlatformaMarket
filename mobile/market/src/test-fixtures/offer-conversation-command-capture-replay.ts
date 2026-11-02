import { z } from "zod";
import { startConversationSchema, conversationMessageInputSchema, conversationReadSchema, conversationResolveSchema, conversationEscalationSchema } from "../../../../packages/schemas/src/conversations";
import { addSupportMessageSchema } from "../../../../packages/schemas/src/commercial";
import { comparedOfferSchema } from "../../../../packages/schemas/src/core-api";
import { compareOffersSchema } from "../../../../packages/schemas/src/index";
import type { MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import type { SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";
import type { ReadScope, MobileReadState } from "../read-controller";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import { createOfferConversationCommandCaptureKernel, offerConversationCaptureCases, runOfferConversationCaptureReview, type OfferConversationCaptureCase, type OfferConversationOperationProof } from "./offer-conversation-command-capture-kernel";

export type OfferConversationCommandCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "parent" | "conversation" | "support" | "command"; caseId?: OfferConversationCaptureCase;
  parentPhase: MobileReadState["phase"] | "not-run"; conversationPhase: MobileReadState["phase"] | "not-run"; supportPhase: MobileReadState["phase"] | "not-run";
  operationPhase?: OfferConversationOperationProof["phase"]; operationIssue?: OfferConversationOperationProof["issue"];
  sourceResponseAccepted: boolean; sourceReceived: boolean; unresolved: boolean;
  comparisonGetCalls: number; lookupGetCalls: number; detailGetCalls: number; supportGetCalls: number; commandCalls: number; syntheticCapturedKeyReads: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY"; reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY";
  nativeBindingPerformed: false; nativeKeyProviderAccessed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false;
  serverAccepted: false; effectProven: false; independentPostResponseReadPerformed: false; privateFileBytesAccessed: false; credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline offer conversation command capture"); } }
function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CaptureInputError(); const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError(); return value as Record<string, unknown>;
}
function scalars(value: unknown, allowed: readonly string[]) {
  const raw = object(value, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) { const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); Object.defineProperty(result, key, { value, enumerable: true }); } return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T { try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Fixed redacted input error only. */ } throw new CaptureInputError(); }
function record(value: unknown, method: "GET" | "POST") {
  const raw = object(value, ["method", "path", "httpStatus", "body", ...(method === "POST" ? ["requestBody"] : [])]);
  const header = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || method === "POST" && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError(); return { raw, header };
}
function commandSchema(caseId: OfferConversationCaptureCase): z.ZodObject {
  switch (caseId) {
    case "start": return startConversationSchema.strict();
    case "send": return conversationMessageInputSchema.strict();
    case "mark-read": return conversationReadSchema.strict();
    case "resolve": return conversationResolveSchema.pick({ expectedVersion: true }).strict();
    case "escalate": return conversationEscalationSchema.strict();
    case "support-reply": return addSupportMessageSchema.strict();
  }
}
function requestSnapshot(value: unknown, caseId: OfferConversationCaptureCase) {
  const schema = commandSchema(caseId), allowed = Object.keys(schema.shape).filter(key => (key !== "attachments" || caseId !== "start" && caseId !== "send") && (key !== "reopen" || caseId !== "support-reply")), raw = object(value, allowed), snapshot: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    let value = raw[key];
    if (key === "attachments") { if (!Array.isArray(value) || value.length !== 0 || Reflect.ownKeys(value).some(key => key !== "length")) throw new CaptureInputError(); value = Object.freeze([]); }
    else if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    Object.defineProperty(snapshot, key, { value, enumerable: true });
  }
  if (caseId === "support-reply" && (snapshot.isInternal !== false || !Object.hasOwn(snapshot, "attachments"))) throw new CaptureInputError();
  decode<unknown>(schema, snapshot); return Object.freeze(snapshot);
}
function matches(actual: Readonly<object>, saved: Readonly<Record<string, unknown>>) {
  const body = actual as Readonly<Record<string, unknown>>, keys = Object.keys(body).sort(), wanted = Object.keys(saved).sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index] && (Object.is(body[key], saved[key]) || key === "attachments" && Array.isArray(body[key]) && body[key].length === 0 && Array.isArray(saved[key]) && saved[key].length === 0));
}
const expectedSchema = z.object({ offerId: comparedOfferSchema.shape.offerId }).strict();

/** Initial OFFER/public linked-ticket response compatibility; unbound candidates stay unresolved and private. */
export async function replayOfferConversationCommandCapture(input: unknown): Promise<OfferConversationCommandCaptureReport> {
  let stage: OfferConversationCommandCaptureReport["stage"] = "input", caseId: OfferConversationCaptureCase | undefined, parentPhase: OfferConversationCommandCaptureReport["parentPhase"] = "not-run", conversationPhase: OfferConversationCommandCaptureReport["conversationPhase"] = "not-run", supportPhase: OfferConversationCommandCaptureReport["supportPhase"] = "not-run";
  let operation: OfferConversationOperationProof | undefined, comparisonGetCalls = 0, lookupGetCalls = 0, detailGetCalls = 0, supportGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let kernel: ReturnType<typeof createOfferConversationCommandCaptureKernel> | undefined, lifetime: ReturnType<typeof createMarketOperationScope> | undefined;
  const report = (status: OfferConversationCommandCaptureReport["status"]): OfferConversationCommandCaptureReport => Object.freeze({ status, stage, ...(caseId ? { caseId } : {}), parentPhase, conversationPhase, supportPhase, ...(operation ? { operationPhase: operation.phase, ...(operation.issue ? { operationIssue: operation.issue } : {}) } : {}), sourceResponseAccepted: operation?.sourceResponseAccepted ?? false, sourceReceived: operation?.sourceReceived ?? false, unresolved: operation?.unresolved ?? false, comparisonGetCalls, lookupGetCalls, detailGetCalls, supportGetCalls, commandCalls, syntheticCapturedKeyReads: kernel?.capturedKeyReads() ?? 0, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "caseId", "scope", "expected", "comparisonQuery", "parent", "lookup", "detail", "support", "operation"]); if (envelope.formatVersion !== 1 || envelope.kind !== "offer-conversation-command") invalid(); caseId = decode(z.enum(offerConversationCaptureCases), envelope.caseId);
    if (caseId !== "support-reply" && Object.hasOwn(envelope, "support")) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape)));
    stage = "query"; const queryRoot = object(envelope.comparisonQuery, ["kind", "input"]); if (queryRoot.kind !== "comparison") invalid();
    const queryInput = scalars(queryRoot.input, Object.keys(compareOffersSchema.shape).filter(key => key !== "buyerOrganizationId")); decode<unknown>(compareOffersSchema.strict(), { ...queryInput, buyerOrganizationId: scope.organizationId });
    const comparisonQuery = { kind: "comparison", input: queryInput } as MobileReadQuery;
    stage = "capture"; const parent = record(envelope.parent, "GET"), lookup = record(envelope.lookup, "GET"), detail = caseId !== "start" || Object.hasOwn(envelope, "detail") ? record(envelope.detail, "GET") : undefined, support = caseId === "support-reply" ? record(envelope.support, "GET") : undefined, savedOperation = record(envelope.operation, "POST");
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let snapshot: Readonly<Record<string, unknown>> | undefined;
    const request = () => { if (snapshot) return snapshot; try { snapshot = requestSnapshot(savedOperation.raw.requestBody, caseId!); return snapshot; } catch { return invalid(); } };
    kernel = createOfferConversationCommandCaptureKernel(scope, async path => {
      if (stage === "support") { if (!support || supportGetCalls || path !== support.header.path) return invalid(); supportGetCalls++; return response(support); }
      if (stage !== "parent" || comparisonGetCalls || path !== parent.header.path) return invalid(); comparisonGetCalls++; return response(parent);
    }, async path => {
      if (stage !== "conversation") return invalid(); if (!lookupGetCalls) { if (path !== lookup.header.path) return invalid(); lookupGetCalls++; return response(lookup); }
      if (!detail || detailGetCalls || path !== detail.header.path) return invalid(); detailGetCalls++; return response(detail);
    }, async (path, body) => {
      if (stage !== "command" || commandCalls || path !== savedOperation.header.path || !matches(body, request())) return invalid(); commandCalls++; return response(savedOperation);
    }, () => { const key = request().idempotencyKey; if (typeof key !== "string") return invalid(); return key; });
    const controller = kernel.controller; stage = "parent"; await controller.load(comparisonQuery); let state = controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "comparison") return report("CONSUMER_REJECTED"); const comparison = state.read.value;
    const target = comparison.selectedVariantId ? controller.selectOfferConversation(comparison.product.id, comparison.selectedVariantId, expected.offerId) : null; if (!target) return report("UNSUPPORTED_CONTEXT");
    stage = "conversation"; await controller.load({ kind: "offer-conversation", target }); state = controller.getSnapshot().state; conversationPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "offer-conversation") return report("CONSUMER_REJECTED"); const window = state.read.value; let ticket: SupportTicketDetail | undefined;
    if (caseId === "support-reply") {
      const selection = controller.offerConversationSupportLinks.select(window), origin = selection ? controller.offerConversationSupportLinks.take(selection) : null; if (!origin) return report("UNSUPPORTED_CONTEXT");
      stage = "support"; await controller.load({ kind: "offer-conversation-support-ticket", origin }); state = controller.getSnapshot().state; supportPhase = state.phase;
      if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "support-ticket") return report("CONSUMER_REJECTED"); ticket = state.read.value;
    }
    stage = "command"; const result = await runOfferConversationCaptureReview(controller, caseId, window, request(), ticket); if (result) operation = result;
    if (invalidCapture) return report("INPUT_INVALID"); if (!result) return report("UNSUPPORTED_CONTEXT");
    return report(commandCalls === 1 && result.sourceResponseAccepted ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "query" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
