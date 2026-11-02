import { z } from "zod";
import { createOrderCommentSchema, updateOrderCommentSchema } from "../../../../packages/schemas/src/trust-commerce";
import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../../packages/schemas/src/core-api";
import { orderCommentRowBindingFixtureSchema } from "../order-comment-row-fixture";
import { createMarketOperationScope } from "../market-operation-scope";
import type { ReadScope, MobileReadState } from "../read-controller";
import { MarketHttpError } from "../market-transport";
import { createCommentMutationCaptureKernel, commentMutationCaptureKinds, type CommentMutationCaptureKind } from "./order-comment-mutation-capture-kernel";

type Controller = ReturnType<typeof createCommentMutationCaptureKernel>["controller"];
type CreateState = ReturnType<Controller["orderCommentCreateCommands"]["stateFor"]>;
type EditState = ReturnType<Controller["orderCommentEditCommands"]["stateFor"]>;
export type CommentMutationCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "comments" | "command"; kind?: CommentMutationCaptureKind;
  parentPhase: MobileReadState["phase"] | "not-run"; commentsPhase: MobileReadState["phase"] | "not-run";
  operationPhase?: CreateState["phase"] | EditState["phase"]; operationIssue?: CreateState["issue"] | EditState["issue"];
  receiptBodyMatchesReviewed?: boolean; unresolved: boolean; parentGetCalls: number; commentsGetCalls: number; commandCalls: number; syntheticCapturedKeyReads: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY";
  nativeBindingPerformed: false; nativeKeyProviderAccessed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false;
  serverAccepted: false; effectProven: false; credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline order-comment operation capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError(); return input as Record<string, unknown>;
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) { const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); Object.defineProperty(result, key, { value, enumerable: true }); } return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T { try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Never expose caller/getter errors. */ } throw new CaptureInputError(); }
function record(value: unknown, method: "GET" | "POST" | "PATCH") {
  const raw = object(value, ["method", "path", "httpStatus", "body", ...(method === "GET" ? [] : ["requestBody"])]);
  const header = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || method !== "GET" && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError(); return { raw, header };
}
const rootBinding = orderWorkflowResponseSchema.pick({ orderId: true, version: true }).strip();
const orderBinding = z.object({ order: supplierOrderResponseSchema.pick({ id: true, version: true, buyerOrganizationId: true }).strip() }).strip();
const rowBinding = orderCommentRowBindingFixtureSchema.pick({ id: true, supplierOrderId: true, authorOrganizationId: true, version: true }).strip();
const expectedCreate = z.object({ orderId: z.uuid(), orderVersion: orderWorkflowResponseSchema.shape.version }).strict();
const expectedEdit = expectedCreate.extend({ commentId: rowBinding.shape.id, commentVersion: rowBinding.shape.version }).strict();

/** One initial source receipt. No optimistic insertion/edit, order-version inference, automatic GET/replay or real command. */
export async function replayCommentMutationCapture(input: unknown): Promise<CommentMutationCaptureReport> {
  let stage: CommentMutationCaptureReport["stage"] = "input", kind: CommentMutationCaptureKind | undefined, parentPhase: CommentMutationCaptureReport["parentPhase"] = "not-run", commentsPhase: CommentMutationCaptureReport["commentsPhase"] = "not-run";
  let operationPhase: CommentMutationCaptureReport["operationPhase"], operationIssue: CommentMutationCaptureReport["operationIssue"], receiptBodyMatchesReviewed: boolean | undefined, unresolved = false, parentGetCalls = 0, commentsGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, kernel: ReturnType<typeof createCommentMutationCaptureKernel> | undefined;
  const report = (status: CommentMutationCaptureReport["status"]): CommentMutationCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, commentsPhase, ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), ...(receiptBodyMatchesReviewed === undefined ? {} : { receiptBodyMatchesReviewed }), unresolved, parentGetCalls, commentsGetCalls, commandCalls, syntheticCapturedKeyReads: kernel?.capturedKeyReads() ?? 0, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "parent", "comments", "operation"]); if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(commentMutationCaptureKinds), envelope.kind);
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const schema = kind === "comment-create" ? expectedCreate : expectedEdit, expected = decode<z.output<typeof expectedCreate> | z.output<typeof expectedEdit>>(schema, scalars(envelope.expected, Object.keys(schema.shape)));
    stage = "capture"; const parent = record(envelope.parent, "GET"), comments = record(envelope.comments, "GET"), operation = record(envelope.operation, kind === "comment-create" ? "POST" : "PATCH");
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let requestSnapshot: Readonly<Record<string, unknown>> | undefined;
    const request = () => {
      if (requestSnapshot) return requestSnapshot;
      try { const schema = kind === "comment-create" ? createOrderCommentSchema : updateOrderCommentSchema, raw = scalars(operation.raw.requestBody, Object.keys(schema.shape)); decode<unknown>(schema.strict(), raw); requestSnapshot = raw; return raw; } catch { return invalid(); }
    };
    kernel = createCommentMutationCaptureKernel(scope, kind, async path => {
      if (stage !== "parent" || parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; const body = response(parent), root = rootBinding.safeParse(body);
      if (!root.success || root.data.orderId !== expected.orderId || root.data.version !== expected.orderVersion) return null;
      const bound = orderBinding.safeParse(body); if (!bound.success || bound.data.order.id !== expected.orderId || bound.data.order.version !== expected.orderVersion || bound.data.order.buyerOrganizationId !== scope.organizationId) return null; return body;
    }, async path => {
      if (stage !== "comments" || commentsGetCalls || path !== comments.header.path) return invalid(); commentsGetCalls++; const body = response(comments);
      if (kind === "comment-edit" && "commentId" in expected) { const roots = rowBinding.array().safeParse(body); if (!roots.success) return null; const row = roots.data.find(row => row.id === expected.commentId); if (row && row.version !== expected.commentVersion) return null; }
      return body;
    }, async (method, path, body) => {
      if (stage !== "command" || commandCalls || method !== operation.header.method || path !== operation.header.path || !body) return invalid();
      const saved = request(), actual = body as Readonly<Record<string, unknown>>, keys = Object.keys(actual).sort(), wanted = Object.keys(saved).sort();
      if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index] || !Object.is(actual[key], saved[key]))) return invalid(); commandCalls++; return response(operation);
    }, () => { const key = request().idempotencyKey; if (typeof key !== "string") return invalid(); return key; });
    const controller = kernel.controller;
    stage = "parent"; await controller.load({ kind: "workflow", orderId: expected.orderId }); let state = controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "workflow") return report("CONSUMER_REJECTED");
    const target = controller.selectOrderComments(); if (!target) return report("UNSUPPORTED_CONTEXT");
    stage = "comments"; await controller.load({ kind: "order-comments", target }); state = controller.getSnapshot().state; commentsPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "order-comments") return report("CONSUMER_REJECTED"); const window = state.read.value;
    stage = "command";
    if (kind === "comment-create") {
      const model = controller.orderCommentCreateCommands; if (!model.start(window)) return report("UNSUPPORTED_CONTEXT");
      const body = request().body; if (typeof body !== "string") return invalid(); const key = model.stateFor(expected.orderId).formKey; if (!key) return report("UNSUPPORTED_CONTEXT"); model.setBody(expected.orderId, key, body);
      if (!model.prepare(window)) return report("UNSUPPORTED_CONTEXT"); const review = model.stateFor(expected.orderId).review; if (!review) return report("UNSUPPORTED_CONTEXT"); await model.confirm(expected.orderId, review);
      const current = model.stateFor(expected.orderId); operationPhase = current.phase; operationIssue = current.issue; receiptBodyMatchesReviewed = current.sameBody; unresolved = current.unresolved === true;
    } else {
      if (!("commentId" in expected)) return invalid(); const row = window.comments.find(row => row.id === expected.commentId), model = controller.orderCommentEditCommands;
      if (!row || !model.begin(window, row)) return report("UNSUPPORTED_CONTEXT");
      const body = request().body; if (typeof body !== "string") return invalid(); const token = model.stateFor(row.id).editToken; if (!token) return report("UNSUPPORTED_CONTEXT"); model.setBody(row.id, token, body);
      if (!model.prepare(row.id)) return report("UNSUPPORTED_CONTEXT"); const review = model.stateFor(row.id).review; if (!review) return report("UNSUPPORTED_CONTEXT"); await model.confirm(row.id, review);
      const current = model.stateFor(row.id); operationPhase = current.phase; operationIssue = current.issue; receiptBodyMatchesReviewed = current.sameBody; unresolved = current.unresolved === true;
    }
    if (invalidCapture) return report("INPUT_INVALID");
    return report(commandCalls === 1 && operationPhase === (kind === "comment-create" ? "receipt" : "result") ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
