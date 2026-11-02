import { z } from "zod";
import { cartVersionSchema, createCartSchema, updateCartItemSchema } from "../../../../packages/schemas/src/index";
import { cartResponseSchema, cartItemResponseSchema } from "../../../../packages/schemas/src/core-api";
import { workspacePageQuerySchema } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { createMarketOperationScope } from "../market-operation-scope";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { cartMutationCaptureKinds, createCartMutationCaptureKernel, type CartMutationCaptureKind } from "./cart-mutation-capture-kernel";

type Kernel = ReturnType<typeof createCartMutationCaptureKernel>;
type Queries = ReturnType<typeof createScopedCoreReadQueries>;
export type CartMutationCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "parent" | "command"; kind?: CartMutationCaptureKind;
  parentPhase: ReturnType<Queries["getState"]>["phase"] | "not-run";
  operationPhase?: ReturnType<Kernel["quantity"]["stateFor"]>["phase"] | ReturnType<Kernel["workspace"]["getSnapshot"]>["phase"];
  operationIssue?: ReturnType<Kernel["quantity"]["stateFor"]>["issue"] | ReturnType<Kernel["workspace"]["getSnapshot"]>["issue"];
  syntheticGetCalls: number; commandCalls: number;
  modelAuthorization: "SYNTHETIC_ONLY"; nativeBindingPerformed: false; businessEligibilityVerified: false;
  productionAuthorizationVerified: false; serverAccepted: false; effectProven: false; keyProviderAccessed: false;
  realNetworkRequests: 0; realServerMutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline cart mutation capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError();
  return input as Record<string, unknown>;
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError();
    Object.defineProperty(result, key, { value, enumerable: true });
  }
  return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, input: unknown): T {
  try { const value = schema.safeParse(input); if (value.success) return value.data; } catch { /* Fixed metadata only. */ }
  throw new CaptureInputError();
}
function record(input: unknown, command = false) {
  const raw = object(input, ["method", "path", "httpStatus", "body", ...(command ? ["requestBody"] : [])]);
  const method = command ? decode(z.enum(["POST", "PATCH", "DELETE"]), raw.method) : decode(z.literal("GET"), raw.method);
  const header = decode(z.object({ path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || command && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError();
  return { raw, header: { ...header, method } };
}
const cartBinding = cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true }).strip();
const pageBinding = z.object({ current: cartBinding.nullable(), items: z.array(cartBinding) }).strip();
const recoverySelector = z.object({ sourceCartId: cartResponseSchema.shape.id, sourceVersion: cartVersionSchema.shape.expectedVersion }).strict();
const lineSelector = z.object({ cartId: cartResponseSchema.shape.id, cartVersion: cartVersionSchema.shape.expectedVersion, itemId: cartItemResponseSchema.shape.id }).strict();
function sameFlatRequest(actual: unknown, expected: Readonly<Record<string, unknown>>): boolean {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const keys = Object.keys(actual).sort(), wanted = Object.keys(expected).sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index] && Object.is((actual as Record<string, unknown>)[key], expected[key]));
}

/** Explicit local response replay; synthetic model authority never admits a real business command. */
export async function replayCartMutationCapture(input: unknown): Promise<CartMutationCaptureReport> {
  let stage: CartMutationCaptureReport["stage"] = "input", kind: CartMutationCaptureKind | undefined, parentPhase: CartMutationCaptureReport["parentPhase"] = "not-run";
  let operationPhase: CartMutationCaptureReport["operationPhase"], operationIssue: CartMutationCaptureReport["operationIssue"], syntheticGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, scope: ReadScope | undefined, queries: Queries | undefined, client: ReturnType<typeof bindMarketReads> | undefined, kernel: Kernel | undefined;
  const report = (status: CartMutationCaptureReport["status"]): CartMutationCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), parentPhase, ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), syntheticGetCalls, commandCalls, modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "query", "parent", "operation"]);
    if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(cartMutationCaptureKinds), envelope.kind);
    if (kind === "create" ? Object.hasOwn(envelope, "expected") : !Object.hasOwn(envelope, "expected")) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); scope = lifetime.owner;
    const recovery = kind === "recover" ? decode(recoverySelector, scalars(envelope.expected, ["sourceCartId", "sourceVersion"])) : undefined;
    const selected = kind === "quantity" || kind === "remove" ? decode(lineSelector, scalars(envelope.expected, ["cartId", "cartVersion", "itemId"])) : undefined;
    stage = "query"; const rawQuery = object(envelope.query, ["kind", "input"]); if (rawQuery.kind !== "workspace-carts") invalid();
    const fields = scalars(rawQuery.input, Object.keys(workspacePageQuerySchema.shape)); decode(workspacePageQuerySchema.strict(), fields);
    stage = "capture"; const parent = record(envelope.parent), operation = record(envelope.operation, true);
    const response = (entry: ReturnType<typeof record>) => {
      let body: unknown; try { body = entry.raw.body; } catch { return invalid(); }
      if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body;
    };
    client = bindMarketReads(async path => {
      if (syntheticGetCalls || path !== parent.header.path) return invalid(); syntheticGetCalls++; const body = response(parent), root = pageBinding.safeParse(body);
      if (!root.success || root.data.current && root.data.current.buyerOrganizationId !== scope!.organizationId || root.data.items.some(cart => cart.buyerOrganizationId !== scope!.organizationId)) return null;
      if (selected && root.data.current && (root.data.current.id !== selected.cartId || root.data.current.version !== selected.cartVersion)) return null;
      const source = recovery && root.data.items.find(cart => cart.id === recovery.sourceCartId); if (source && source.version !== recovery!.sourceVersion) return null;
      return body;
    }, scope.organizationId);
    queries = createScopedCoreReadQueries(scope, client); stage = "parent"; await queries.load({ kind: "workspace-carts", input: fields }); const parentState = queries.getState(); parentPhase = parentState.phase;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!("read" in parentState) || parentState.read.kind !== "workspace-carts") return report("CONSUMER_REJECTED");
    const page = parentState.read.value;
    let requestSnapshot: Readonly<Record<string, unknown>> | undefined;
    const capturedRequest = () => {
      if (requestSnapshot) return requestSnapshot;
      try {
        const schema = kind === "create" ? createCartSchema : kind === "quantity" ? updateCartItemSchema : cartVersionSchema;
        const raw = scalars(operation.raw.requestBody, Object.keys(schema.shape)); decode<unknown>(schema.strict(), raw); requestSnapshot = raw; return raw;
      } catch { return invalid(); }
    };
    kernel = createCartMutationCaptureKernel(scope, page, async (method, path, body) => {
      if (stage !== "command" || commandCalls || method !== operation.header.method || path !== operation.header.path || !sameFlatRequest(body, capturedRequest())) return invalid();
      commandCalls++; return response(operation);
    });
    stage = "command";
    if (kind === "create") {
      if (!kernel.workspace.canStart(page)) return report("UNSUPPORTED_CONTEXT");
      const currency = capturedRequest().currency; if (currency !== undefined && typeof currency !== "string") return invalid();
      await kernel.workspace.start(page, currency);
    } else if (kind === "recover") {
      const source = page.items.find(cart => cart.id === recovery!.sourceCartId); if (!source || !kernel.workspace.canStartRecovery(page, source)) return report("UNSUPPORTED_CONTEXT");
      await kernel.workspace.startRecovery(page, source);
    } else {
      const cart = page.current, item = cart?.items.find(line => line.id === selected!.itemId);
      if (!cart || !item) return report("UNSUPPORTED_CONTEXT");
      if (kind === "quantity") {
        if (!kernel.quantity.canSubmit(cart, item)) return report("UNSUPPORTED_CONTEXT");
        const quantity = capturedRequest().quantity; if (typeof quantity !== "number") return invalid();
        if (!kernel.drafts.begin(cart, item)) return report("UNSUPPORTED_CONTEXT"); kernel.drafts.change(cart, item, String(quantity)); await kernel.quantity.submit(cart, item);
      } else {
        if (!kernel.quantity.canBeginRemove(cart, item)) return report("UNSUPPORTED_CONTEXT"); kernel.quantity.beginRemove(cart, item); await kernel.quantity.confirmRemove(cart.id, item.id);
      }
    }
    if (kind === "create" || kind === "recover") { const state = kernel.workspace.getSnapshot(); operationPhase = state.phase; operationIssue = state.issue; }
    else { const state = kernel.quantity.stateFor(selected!.cartId); operationPhase = state.phase; operationIssue = state.issue; }
    if (invalidCapture) return report("INPUT_INVALID");
    const consistent = kind === "create" || kind === "recover" ? !!kernel.workspace.resultCart() : operationPhase === "success";
    return report(commandCalls === 1 && kernel.reloads() === 0 && consistent ? "CONSISTENT_RESPONSE" : commandCalls === 0 && operationPhase === "idle" ? "UNSUPPORTED_CONTEXT" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || ["input", "query", "capture"].includes(stage) ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); if (queries && scope && client) queries.reset(scope, client); }
}
