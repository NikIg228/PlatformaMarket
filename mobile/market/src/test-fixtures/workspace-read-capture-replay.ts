import { z } from "zod";
import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "../market-operation-scope";
import type { ReadScope, MobileReadState } from "../read-controller";
import { MarketHttpError } from "../market-transport";
import { createWorkspaceCaptureKernel } from "./workspace-read-capture-kernel";

export type WorkspaceCaptureKind = "saved-lists" | "order-comments";
export type WorkspaceCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_READ" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "capture" | "parent" | "consumer";
  kind?: WorkspaceCaptureKind; parentPhase: MobileReadState["phase"] | "not-run"; consumerPhase: MobileReadState["phase"] | "not-run";
  parentGetCalls: number; workspaceGetCalls: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; nativeBindingPerformed: false; businessEligibilityVerified: false;
  authorProvenanceCaptured: false; productionAuthorizationVerified: false; serverAccepted: false;
  networkRequests: 0; mutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline workspace read capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError();
  return input as Record<string, unknown>;
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* No input/error details leave this standalone tool. */ }
  throw new CaptureInputError();
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    Object.defineProperty(result, key, { value, enumerable: true });
  }
  return Object.freeze(result);
}
function record(input: unknown) {
  const raw = object(input, ["method", "path", "httpStatus", "body"]);
  const header = decode(z.object({ method: z.literal("GET"), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body")) throw new CaptureInputError();
  return { raw, header };
}
const rootBinding = orderWorkflowResponseSchema.pick({ orderId: true, version: true }).strip();
const orderBinding = z.object({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true }).strip() }).strip();

/** Explicit saved-JSON source-fixture consistency. Never a CURRENT response contract or auth admission. */
export async function replayWorkspaceReadCapture(input: unknown): Promise<WorkspaceCaptureReport> {
  let stage: WorkspaceCaptureReport["stage"] = "input", kind: WorkspaceCaptureKind | undefined;
  let parentPhase: WorkspaceCaptureReport["parentPhase"] = "not-run", consumerPhase: WorkspaceCaptureReport["consumerPhase"] = "not-run", parentGetCalls = 0, workspaceGetCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, kernel: ReturnType<typeof createWorkspaceCaptureKernel> | undefined;
  const report = (status: WorkspaceCaptureReport["status"]): WorkspaceCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, consumerPhase, parentGetCalls, workspaceGetCalls, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, authorProvenanceCaptured: false, productionAuthorizationVerified: false, serverAccepted: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "parent", "read"]);
    if (envelope.formatVersion !== 1) invalid();
    kind = decode(z.enum(["saved-lists", "order-comments"]), envelope.kind);
    if (kind === "saved-lists" && (Object.hasOwn(envelope, "expected") || Object.hasOwn(envelope, "parent"))) invalid();
    if (kind === "order-comments" && (!Object.hasOwn(envelope, "expected") || !Object.hasOwn(envelope, "parent"))) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = kind === "order-comments" ? decode(z.object({ orderId: orderWorkflowResponseSchema.shape.orderId, orderVersion: orderWorkflowResponseSchema.shape.version }).strict(), scalars(envelope.expected, ["orderId", "orderVersion"])) : undefined;
    stage = "capture"; const saved = record(envelope.read), parent = kind === "order-comments" ? record(envelope.parent) : undefined;
    const response = (entry: ReturnType<typeof record>) => {
      let body: unknown; try { body = entry.raw.body; } catch { return invalid(); }
      if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body);
      return body;
    };
    kernel = createWorkspaceCaptureKernel(scope, kind, async path => {
      if (stage !== "parent" || !parent || !expected || parentGetCalls || path !== parent.header.path) return invalid();
      parentGetCalls++; const body = response(parent);
      // Explicit selected version/buyer binding precedes full private workflow decoding.
      const root = rootBinding.safeParse(body);
      if (!root.success || root.data.orderId !== expected.orderId || root.data.version !== expected.orderVersion) return null;
      const bound = orderBinding.safeParse(body);
      if (!bound.success || bound.data.order.id !== expected.orderId || bound.data.order.version !== expected.orderVersion || bound.data.order.buyerOrganizationId !== scope.organizationId) return null;
      return body;
    }, async path => {
      if (stage !== "consumer" || workspaceGetCalls || path !== saved.header.path) return invalid();
      workspaceGetCalls++; return response(saved);
    });
    const controller = kernel.controller;
    if (kind === "order-comments") {
      stage = "parent"; await controller.load({ kind: "workflow", orderId: expected!.orderId }); const state = controller.getSnapshot().state; parentPhase = state.phase;
      if (invalidCapture) return report("INPUT_INVALID");
      if (!("read" in state) || state.read.kind !== "workflow") return report("CONSUMER_REJECTED");
      const target = controller.selectOrderComments(); if (!target) return report("UNSUPPORTED_CONTEXT");
      stage = "consumer"; await controller.load({ kind: "order-comments", target });
    } else { stage = "consumer"; await controller.load({ kind: "saved-lists" }); }
    consumerPhase = controller.getSnapshot().state.phase;
    if (invalidCapture || kernel.unexpectedWrites() || workspaceGetCalls !== 1) return report("INPUT_INVALID");
    return report(consumerPhase === "ready" || consumerPhase === "empty" ? "CONSISTENT_READ" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || stage === "input" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
