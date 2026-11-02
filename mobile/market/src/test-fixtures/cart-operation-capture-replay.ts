import { z } from "zod";
import { cartVersionSchema, checkoutCartSchema, repriceCartSchema } from "../../../../packages/schemas/src/index";
import { cartResponseSchema } from "../../../../packages/schemas/src/core-api";
import { workspacePageQuerySchema } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { createMarketOperationScope } from "../market-operation-scope";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { createCartCaptureKernel } from "./cart-operation-capture-kernel";

const kinds = ["validation", "reprice", "checkout"] as const;
export type CartCaptureKind = typeof kinds[number];
type Queries = ReturnType<typeof createScopedCoreReadQueries>;
type Kernel = ReturnType<typeof createCartCaptureKernel>;
export type CartCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "parent" | "validation" | "command";
  kind?: CartCaptureKind;
  parentPhase: ReturnType<Queries["getState"]>["phase"] | "not-run";
  validationPhase: ReturnType<Kernel["validation"]["getSnapshot"]>["phase"] | "not-run";
  validationIssue?: ReturnType<Kernel["validation"]["getSnapshot"]>["issue"];
  operationPhase?: ReturnType<Kernel["reprice"]["getSnapshot"]>["phase"] | ReturnType<Kernel["checkout"]["stateFor"]>["phase"];
  operationIssue?: ReturnType<Kernel["reprice"]["getSnapshot"]>["issue"] | ReturnType<Kernel["checkout"]["stateFor"]>["issue"];
  savedReceiptStatus?: "COMPLETED" | "PROCESSING" | "FAILED";
  syntheticGetCalls: number; validationCalls: number; commandCalls: number; keyRequests: number;
  modelAuthorization: "SYNTHETIC_ONLY"; nativeBindingPerformed: false; businessEligibilityVerified: false;
  productionAuthorizationVerified: false; serverAccepted: false; effectProven: false;
  realNetworkRequests: 0; realServerMutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline cart operation capture"); } }
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* Fixed report only. */ }
  throw new CaptureInputError();
}
function object(input: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || allowed && !allowed.includes(key)) throw new CaptureInputError();
  return input as Record<string, unknown>;
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
function header(input: unknown, method: "GET" | "POST", command = false) {
  const raw = object(input, ["method", "path", "httpStatus", "body", ...(command ? ["requestBody"] : [])]);
  const meta = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || command && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError();
  return { raw, meta };
}
// Capture logical JSON once. No toJSON hooks, cyclic objects, undefined or precision coercion.
function jsonSnapshot(input: unknown, seen = new Set<object>(), depth = 0): unknown {
  if (input === null || typeof input === "string" || typeof input === "boolean") return input;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (!input || typeof input !== "object" || depth > 32 || seen.has(input)) throw new CaptureInputError();
  seen.add(input);
  try {
    if (Array.isArray(input)) return input.map(value => jsonSnapshot(value, seen, depth + 1));
    const raw = object(input), result: Record<string, unknown> = {};
    for (const key of Object.keys(raw).sort()) Object.defineProperty(result, key, { value: jsonSnapshot(raw[key], seen, depth + 1), enumerable: true });
    return result;
  } finally { seen.delete(input); }
}
const currentBinding = cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true }).strip();

/** Saved JSON -> existing source models only. Never imported by the app or used as native authorization. */
export async function replayCartOperationCapture(input: unknown): Promise<CartCaptureReport> {
  let stage: CartCaptureReport["stage"] = "input", kind: CartCaptureKind | undefined;
  let parentPhase: CartCaptureReport["parentPhase"] = "not-run", validationPhase: CartCaptureReport["validationPhase"] = "not-run";
  let validationIssue: CartCaptureReport["validationIssue"], operationPhase: CartCaptureReport["operationPhase"], operationIssue: CartCaptureReport["operationIssue"], savedReceiptStatus: CartCaptureReport["savedReceiptStatus"];
  let syntheticGetCalls = 0, validationCalls = 0, commandCalls = 0, keyRequests = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, scope: ReadScope | undefined, queries: Queries | undefined, client: ReturnType<typeof bindMarketReads> | undefined, kernel: Kernel | undefined;
  const report = (status: CartCaptureReport["status"]): CartCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, validationPhase, ...(validationIssue ? { validationIssue } : {}), ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), ...(savedReceiptStatus ? { savedReceiptStatus } : {}), syntheticGetCalls, validationCalls, commandCalls, keyRequests, modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "query", "parent", "validation", "operation"]);
    if (envelope.formatVersion !== 1) invalid();
    kind = decode(z.enum(kinds), envelope.kind);
    if (kind === "validation" ? Object.hasOwn(envelope, "operation") : !Object.hasOwn(envelope, "operation")) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); scope = lifetime.owner;
    const expected = decode(z.object({ cartId: cartResponseSchema.shape.id, cartVersion: cartVersionSchema.shape.expectedVersion }).strict(), scalars(envelope.expected, ["cartId", "cartVersion"]));
    stage = "query";
    const queryRoot = object(envelope.query, ["kind", "input"]);
    if (queryRoot.kind !== "workspace-carts") invalid();
    const fields = scalars(queryRoot.input, Object.keys(workspacePageQuerySchema.shape)); decode(workspacePageQuerySchema.strict(), fields);
    const query = { kind: "workspace-carts" as const, input: fields };
    stage = "capture";
    // Check every record header before inspecting any response body.
    const parent = header(envelope.parent, "GET"), validation = header(envelope.validation, "POST"), operation = kind === "validation" ? undefined : header(envelope.operation, "POST", true);
    const response = (record: ReturnType<typeof header>) => {
      let body: unknown; try { body = record.raw.body; } catch { return invalid(); }
      if (record.meta.httpStatus >= 300) throw new MarketHttpError(record.meta.httpStatus, body);
      return body;
    };
    client = bindMarketReads(async path => {
      if (syntheticGetCalls || path !== parent.meta.path) return invalid(); syntheticGetCalls++;
      const body = response(parent);
      // Explicit selected parent binding precedes full DTO/private-field decoding.
      const root = decode(z.object({ current: currentBinding.nullable() }).strip(), body);
      if (root.current && (root.current.id !== expected.cartId || root.current.version !== expected.cartVersion || root.current.buyerOrganizationId !== scope!.organizationId)) return null;
      return body;
    }, scope.organizationId);
    queries = createScopedCoreReadQueries(scope, client); stage = "parent"; await queries.load(query);
    const parentState = queries.getState(); parentPhase = parentState.phase;
    if (invalidCapture) return report("INPUT_INVALID");
    if (parentState.phase !== "ready" && parentState.phase !== "empty") return report("CONSUMER_REJECTED");
    if (!("read" in parentState) || parentState.read.kind !== "workspace-carts" || !parentState.read.value.current) return report("UNSUPPORTED_CONTEXT");
    const page = parentState.read.value, cart = page.current!;
    let requestSnapshot: Record<string, unknown> | undefined;
    const capturedRequest = () => {
      if (requestSnapshot) return requestSnapshot;
      try {
        if (!operation) return invalid();
        const raw = object(operation.raw.requestBody, kind === "checkout" ? ["expectedVersion", "idempotencyKey"] : ["expectedVersion", "acceptedItems"]);
        const snapshot = jsonSnapshot(raw) as Record<string, unknown>;
        decode(cartVersionSchema.strip(), snapshot);
        if (kind === "checkout") decode(checkoutCartSchema.strict(), snapshot); else decode(repriceCartSchema, snapshot);
        requestSnapshot = snapshot; return snapshot;
      } catch { return invalid(); }
    };
    kernel = createCartCaptureKernel(scope, page, async (method, path, body) => {
      if (stage === "validation") {
        if (method !== "POST" || body !== undefined || validationCalls || path !== validation.meta.path) return invalid();
        validationCalls++; return response(validation);
      }
      if (stage !== "command" || !operation || method !== "POST" || commandCalls || path !== operation.meta.path) return invalid();
      const expectedRequest = capturedRequest();
      if (JSON.stringify(jsonSnapshot(body)) !== JSON.stringify(expectedRequest)) return invalid();
      commandCalls++; return response(operation);
    }, () => {
      keyRequests++; if (keyRequests !== 1 || kind !== "checkout") return invalid();
      const key = capturedRequest().idempotencyKey; if (typeof key !== "string") return invalid(); return key;
    });
    stage = "validation";
    if (!kernel.validation.canValidate(page)) return report("UNSUPPORTED_CONTEXT");
    await kernel.validation.validate(page); const quoteState = kernel.validation.getSnapshot(); validationPhase = quoteState.phase; validationIssue = quoteState.issue;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!kernel.validation.resultFor(page) || validationCalls !== 1) return report("CONSUMER_REJECTED");
    if (kind === "validation") return report("CONSISTENT_RESPONSE");
    stage = "command";
    const model = kind === "reprice" ? kernel.reprice : kernel.checkout;
    if (!model.prepare(page)) return report("UNSUPPORTED_CONTEXT");
    if (kind === "reprice") {
      await kernel.reprice.confirm(); const state = kernel.reprice.getSnapshot(); operationPhase = state.phase; operationIssue = state.issue;
      if (invalidCapture) return report("INPUT_INVALID");
      return report(commandCalls === 1 && kernel.reloads() === 0 && !!kernel.reprice.resultCart() ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
    }
    await kernel.checkout.confirm(cart.id); const state = kernel.checkout.stateFor(cart.id); operationPhase = state.phase; operationIssue = state.issue;
    if (invalidCapture) return report("INPUT_INVALID");
    const receipt = kernel.checkout.receiptFor(cart.id);
    if (receipt && ["COMPLETED", "PROCESSING", "FAILED"].includes(receipt.status)) savedReceiptStatus = receipt.status as CartCaptureReport["savedReceiptStatus"];
    return report(commandCalls === 1 && keyRequests === 1 && kernel.reloads() === 0 && !!savedReceiptStatus ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || ["input", "query", "capture"].includes(stage) ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); if (queries && scope && client) queries.reset(scope, client); }
}
