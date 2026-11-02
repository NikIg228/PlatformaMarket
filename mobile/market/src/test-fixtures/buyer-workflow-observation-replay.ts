import { z } from "zod";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import type { ReadScope, MobileReadState } from "../read-controller";
import type { BuyerWorkflowInput } from "../order-workflow-command-fixture";
import { buyerCaptureActions, buyerCaptureState, createBuyerWorkflowCaptureKernel, runBuyerCaptureReview, type BuyerCaptureAction } from "./buyer-workflow-capture-kernel";

type Kernel = ReturnType<typeof createBuyerWorkflowCaptureKernel>;
type Controller = Kernel["controller"];
type State = ReturnType<typeof buyerCaptureState>;
type ReadPhase = State["phase"] | ReturnType<Controller["orderReorderCommands"]["stateFor"]>["orderRead"];
export type BuyerWorkflowObservationReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_OBSERVATION" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "workspace" | "initial" | "observation";
  action?: BuyerCaptureAction; parentPhase: MobileReadState["phase"] | "not-run"; observationPhase: MobileReadState["phase"] | "not-run";
  initialPhase?: State["phase"]; finalPhase?: State["phase"]; readPhase?: ReadPhase;
  initialUnresolved: boolean; unresolved: boolean; retainedPriorRead: boolean; sameAttemptInputRetained: boolean; originalUUIDRetained: boolean;
  parentGetCalls: number; workspaceGetCalls: number; observationGetCalls: number; commandCalls: number; syntheticCapturedKeyReads: number;
  modelAuthorization: "SYNTHETIC_ONLY"; reviewProvenance: "SIMULATED_SOURCE_OBSERVATION_ONLY";
  nativeBindingPerformed: false; nativeKeyProviderAccessed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false; serverAccepted: false; effectProven: false;
  automaticRetryPerformed: false; writeReplayPerformed: false; returnedIdReadPerformed: false; observedEffectAttributed: false; readAcknowledged: false; newAttemptPrepared: false;
  credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline buyer workflow observation capture"); } }
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

function ordinaryModel(controller: Controller, input: BuyerWorkflowInput) {
  switch (input.action) {
    case "CANCEL": return controller.cancellationCommands;
    case "RECEIVE_SHIPMENT": return controller.receiptCommands;
    case "REQUEST_RETURN": return input.kind === "GOODS" ? controller.goodsReturnCommands : controller.moneyReturnCommands;
    case "SEND_RETURN_GOODS": return controller.returnSendCommands;
    case "RECEIVE_MANUAL_REFUND": return controller.refundReceiveCommands;
    case "ACCEPT_COMPOSITION": return controller.orderCompositionCommands;
    case "OPEN_PAYMENT_DISPUTE": return controller.paymentDisputeCommands;
    case "REORDER": throw new CaptureInputError();
  }
}

/** Explicit original-order observation of an unresolved BUYER attempt; the attempt remains unresolved. */
export async function replayBuyerWorkflowObservation(input: unknown): Promise<BuyerWorkflowObservationReport> {
  let stage: BuyerWorkflowObservationReport["stage"] = "input", action: BuyerCaptureAction | undefined;
  let parentPhase: BuyerWorkflowObservationReport["parentPhase"] = "not-run", observationPhase: BuyerWorkflowObservationReport["observationPhase"] = "not-run";
  let initialPhase: State["phase"] | undefined, finalPhase: State["phase"] | undefined, readPhase: ReadPhase;
  let initialUnresolved = false, unresolved = false, retainedPriorRead = false, sameAttemptInputRetained = false, originalUUIDRetained = false;
  let parentGetCalls = 0, workspaceGetCalls = 0, observationGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let kernel: Kernel | undefined, lifetime: ReturnType<typeof createMarketOperationScope> | undefined;
  const report = (status: BuyerWorkflowObservationReport["status"]): BuyerWorkflowObservationReport => Object.freeze({ status, stage, ...(action ? { action } : {}), parentPhase, observationPhase, ...(initialPhase ? { initialPhase } : {}), ...(finalPhase ? { finalPhase } : {}), ...(readPhase ? { readPhase } : {}), initialUnresolved, unresolved, retainedPriorRead, sameAttemptInputRetained, originalUUIDRetained, parentGetCalls, workspaceGetCalls, observationGetCalls, commandCalls, syntheticCapturedKeyReads: kernel?.capturedKeyReads() ?? 0, modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_OBSERVATION_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, writeReplayPerformed: false, returnedIdReadPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "action", "scope", "expected", "parent", "workspace", "initial", "observation"]);
    if (envelope.formatVersion !== 1 || envelope.kind !== "buyer-workflow-observation") invalid();
    action = decode(z.enum(buyerCaptureActions), envelope.action);
    if (action !== "REORDER" && Object.hasOwn(envelope, "workspace")) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape)));
    stage = "capture";
    const parent = record(envelope.parent, "GET"), workspace = action === "REORDER" ? record(envelope.workspace, "GET") : undefined;
    const initial = record(envelope.initial, "POST"), observation = record(envelope.observation, "GET");
    if (observation.header.path !== parent.header.path) invalid();
    const response = (entry: ReturnType<typeof record>) => {
      let body: unknown; try { body = entry.raw.body; } catch { return invalid(); }
      if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body;
    };
    const boundWorkflow = (body: unknown, initialRead: boolean) => {
      try {
        const root = workflowRoot.safeParse(body);
        if (!root.success || root.data.orderId !== expected.orderId || initialRead && root.data.version !== expected.orderVersion) return null;
        const bound = orderRoot.safeParse(body);
        if (!bound.success || bound.data.order.id !== expected.orderId || bound.data.order.version !== root.data.version || bound.data.order.buyerOrganizationId !== scope.organizationId) return null;
        return body;
      } catch { return invalid(); }
    };
    let snapshot: Readonly<Record<string, unknown>> | undefined, command: BuyerWorkflowInput | undefined;
    const request = () => {
      if (snapshot && command) return { snapshot, command };
      try {
        const branch = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === action); if (!branch) return invalid();
        snapshot = requestSnapshot(initial.raw.requestBody, branch); command = decode<unknown>(branch.strict(), snapshot) as BuyerWorkflowInput;
        if (command.action !== action) return invalid(); return { snapshot, command };
      } catch { return invalid(); }
    };
    kernel = createBuyerWorkflowCaptureKernel(scope, async path => {
      if (stage === "workspace") { if (!workspace || workspaceGetCalls || path !== workspace.header.path) return invalid(); workspaceGetCalls++; return response(workspace); }
      if (stage === "parent") { if (parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; return boundWorkflow(response(parent), true); }
      if (stage !== "observation" || observationGetCalls || path !== observation.header.path) return invalid();
      observationGetCalls++; return boundWorkflow(response(observation), false);
    }, async (path, body) => {
      if (stage !== "initial" || commandCalls || path !== initial.header.path || !equalJson(body, request().snapshot)) return invalid();
      commandCalls++; return response(initial);
    }, () => {
      if (stage !== "initial") return invalid();
      const key = request().command.idempotencyKey; if (typeof key !== "string") return invalid(); return key;
    });
    const controller = kernel.controller;
    stage = "parent"; await controller.load({ kind: "workflow", orderId: expected.orderId });
    const state = controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!("read" in state) || state.read.kind !== "workflow") return report("CONSUMER_REJECTED");
    const saved = request(); stage = action === "REORDER" ? "workspace" : "initial";
    const selected = await runBuyerCaptureReview(controller, state.read.value, saved.command, () => { stage = "initial"; });
    const first = buyerCaptureState(controller, saved.command, expected.orderId);
    initialPhase = finalPhase = first.phase; initialUnresolved = unresolved = first.unresolved === true;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!selected || commandCalls !== 1 || initialPhase !== "unknown" || !initialUnresolved) return report("UNSUPPORTED_CONTEXT");
    const firstInput = first.input, beforeObservation = controller.getSnapshot().state;
    stage = "observation";
    if (saved.command.action === "REORDER") await controller.orderReorderCommands.readOrder(expected.orderId);
    else await ordinaryModel(controller, saved.command).readCurrent(expected.orderId);
    const after = controller.getSnapshot().state, current = buyerCaptureState(controller, saved.command, expected.orderId);
    observationPhase = after.phase; finalPhase = current.phase; unresolved = current.unresolved === true;
    readPhase = saved.command.action === "REORDER" ? controller.orderReorderCommands.stateFor(expected.orderId).orderRead : current.phase;
    sameAttemptInputRetained = firstInput !== undefined && current.input === firstInput;
    originalUUIDRetained = sameAttemptInputRetained && current.input?.idempotencyKey === saved.command.idempotencyKey;
    retainedPriorRead = observationGetCalls === 1 && (after === beforeObservation || "read" in beforeObservation && "read" in after && after.read === beforeObservation.read);
    if (invalidCapture) return report("INPUT_INVALID");
    if (retainedPriorRead) return report("UNSUPPORTED_CONTEXT");
    if (!("read" in after) || after.read.kind !== "workflow" || after.read.value.orderId !== expected.orderId) return report("CONSUMER_REJECTED");
    return report(observationGetCalls === 1 && commandCalls === 1 && kernel.capturedKeyReads() === 1 && readPhase === "review" && unresolved && sameAttemptInputRetained && originalUUIDRetained ? "CONSISTENT_OBSERVATION" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
