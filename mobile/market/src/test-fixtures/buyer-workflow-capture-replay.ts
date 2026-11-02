import { z } from "zod";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import type { ReadScope, MobileReadState } from "../read-controller";
import type { BuyerWorkflowInput } from "../order-workflow-command-fixture";
import { buyerCaptureActions, buyerCaptureState, createBuyerWorkflowCaptureKernel, runBuyerCaptureReview, type BuyerCaptureAction } from "./buyer-workflow-capture-kernel";

type State = ReturnType<typeof buyerCaptureState>;
export type BuyerWorkflowCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "workspace" | "command"; action?: BuyerCaptureAction;
  parentPhase: MobileReadState["phase"] | "not-run"; operationPhase?: State["phase"]; operationIssue?: State["issue"];
  unresolved: boolean; parentGetCalls: number; workspaceGetCalls: number; commandCalls: number; syntheticCapturedKeyReads: number;
  modelAuthorization: "SYNTHETIC_ONLY"; reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY";
  nativeBindingPerformed: false; nativeKeyProviderAccessed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false;
  serverAccepted: false; effectProven: false; credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline buyer workflow capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError(); return input as Record<string, unknown>;
}
function scalar(value: unknown) { if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); return value; }
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) Object.defineProperty(result, key, { value: scalar(raw[key]), enumerable: true }); return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T { try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* No caller details. */ } throw new CaptureInputError(); }
function record(value: unknown, method: "GET" | "POST") {
  const raw = object(value, ["method", "path", "httpStatus", "body", ...(method === "POST" ? ["requestBody"] : [])]);
  const header = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || method === "POST" && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError(); return { raw, header };
}
function itemSchema(schema: z.ZodType): z.ZodObject {
  while (schema instanceof z.ZodDefault || schema instanceof z.ZodOptional) schema = schema.unwrap() as z.ZodType;
  if (!(schema instanceof z.ZodArray) || !(schema.element instanceof z.ZodObject)) throw new CaptureInputError(); return schema.element;
}
function requestSnapshot(input: unknown, branch: z.ZodObject) {
  const raw = object(input, Object.keys(branch.shape)), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    let value: unknown;
    if (key === "items") {
      const rows = raw[key]; if (!Array.isArray(rows) || rows.length > 500) throw new CaptureInputError(); const schema = itemSchema(branch.shape[key]);
      value = Object.freeze(rows.map(row => { const snapshot = scalars(row, Object.keys(schema.shape)); decode<unknown>(schema.strict(), snapshot); return snapshot; }));
    } else value = scalar(raw[key]);
    Object.defineProperty(result, key, { value, enumerable: true });
  }
  return Object.freeze(result);
}
function equalJson(actual: unknown, saved: unknown): boolean {
  if (Object.is(actual, saved)) return true;
  if (Array.isArray(actual) || Array.isArray(saved)) return Array.isArray(actual) && Array.isArray(saved) && actual.length === saved.length && actual.every((value, index) => equalJson(value, saved[index]));
  if (!actual || !saved || typeof actual !== "object" || typeof saved !== "object") return false;
  const a = actual as Record<string, unknown>, b = saved as Record<string, unknown>, keys = Object.keys(a).sort(), wanted = Object.keys(b).sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index] && equalJson(a[key], b[key]));
}
const expectedSchema = z.object({ orderId: orderWorkflowResponseSchema.shape.orderId, orderVersion: orderWorkflowResponseSchema.shape.version }).strict();
const workflowRoot = orderWorkflowResponseSchema.pick({ orderId: true, version: true }).strip();
const orderRoot = z.object({ order: supplierOrderResponseSchema.pick({ id: true, version: true, buyerOrganizationId: true }).strip() }).strip();

/** Original initial source reviews only. No operation effect, permission, monetary calculation or native admission is inferred. */
export async function replayBuyerWorkflowCapture(input: unknown): Promise<BuyerWorkflowCaptureReport> {
  let stage: BuyerWorkflowCaptureReport["stage"] = "input", action: BuyerCaptureAction | undefined, parentPhase: BuyerWorkflowCaptureReport["parentPhase"] = "not-run", operationPhase: State["phase"] | undefined, operationIssue: State["issue"], unresolved = false, parentGetCalls = 0, workspaceGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let kernel: ReturnType<typeof createBuyerWorkflowCaptureKernel> | undefined, lifetime: ReturnType<typeof createMarketOperationScope> | undefined;
  const report = (status: BuyerWorkflowCaptureReport["status"]): BuyerWorkflowCaptureReport => Object.freeze({ status, stage, ...(action ? { action } : {}), parentPhase, ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), unresolved, parentGetCalls, workspaceGetCalls, commandCalls, syntheticCapturedKeyReads: kernel?.capturedKeyReads() ?? 0, modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "action", "scope", "expected", "parent", "workspace", "operation"]); if (envelope.formatVersion !== 1 || envelope.kind !== "buyer-workflow") invalid();
    action = decode(z.enum(buyerCaptureActions), envelope.action); if (action !== "REORDER" && Object.hasOwn(envelope, "workspace")) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape)));
    stage = "capture"; const parent = record(envelope.parent, "GET"), workspace = action === "REORDER" ? record(envelope.workspace, "GET") : undefined, operation = record(envelope.operation, "POST");
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let snapshot: Readonly<Record<string, unknown>> | undefined, command: BuyerWorkflowInput | undefined;
    const request = () => {
      if (snapshot && command) return { snapshot, command };
      try {
        const branch = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === action); if (!branch) return invalid();
        snapshot = requestSnapshot(operation.raw.requestBody, branch); command = decode<unknown>(branch.strict(), snapshot) as BuyerWorkflowInput;
        if (command.action !== action) return invalid(); return { snapshot, command };
      } catch { return invalid(); }
    };
    kernel = createBuyerWorkflowCaptureKernel(scope, async path => {
      if (stage === "workspace") { if (!workspace || workspaceGetCalls || path !== workspace.header.path) return invalid(); workspaceGetCalls++; return response(workspace); }
      if (stage !== "parent" || parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; const body = response(parent), root = workflowRoot.safeParse(body);
      if (!root.success || root.data.orderId !== expected.orderId || root.data.version !== expected.orderVersion) return null;
      const bound = orderRoot.safeParse(body); if (!bound.success || bound.data.order.id !== expected.orderId || bound.data.order.version !== expected.orderVersion || bound.data.order.buyerOrganizationId !== scope.organizationId) return null; return body;
    }, async (path, body) => {
      if (stage !== "command" || commandCalls || operation.header.method !== "POST" || path !== operation.header.path || !equalJson(body, request().snapshot)) return invalid();
      commandCalls++; return response(operation);
    }, () => { const key = request().command.idempotencyKey; if (typeof key !== "string") return invalid(); return key; });
    const controller = kernel.controller; stage = "parent"; await controller.load({ kind: "workflow", orderId: expected.orderId }); const state = controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "workflow") return report("CONSUMER_REJECTED");
    const saved = request(); stage = action === "REORDER" ? "workspace" : "command";
    const selected = await runBuyerCaptureReview(controller, state.read.value, saved.command, () => { stage = "command"; });
    const current = buyerCaptureState(controller, saved.command, expected.orderId); operationPhase = current.phase; operationIssue = current.issue; unresolved = current.unresolved === true;
    if (invalidCapture) return report("INPUT_INVALID"); if (!selected) return report("UNSUPPORTED_CONTEXT");
    return report(commandCalls === 1 && current.phase === "receipt" ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
