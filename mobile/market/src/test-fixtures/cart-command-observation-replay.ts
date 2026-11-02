import { z } from "zod";
import { cartVersionSchema, updateCartItemSchema } from "../../../../packages/schemas/src/index";
import { cartResponseSchema, cartItemResponseSchema } from "../../../../packages/schemas/src/core-api";
import { workspacePageQuerySchema } from "../../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../read-controller";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import { createCartObservationKernel, submitCartObservationInitial, applyCartObservationAction, cartObservationActions, type CartObservationKind, type CartObservationAction } from "./cart-command-observation-kernel";

type Kernel = ReturnType<typeof createCartObservationKernel>;
type ModelPhase = ReturnType<Kernel["model"]["stateFor"]>["phase"];
type ReadPhase = ReturnType<Kernel["readState"]>["phase"] | "not-run";
export type CartObservationReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_OBSERVATION" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "parent" | "command" | "observation" | "action"; kind?: CartObservationKind; action?: CartObservationAction;
  parentPhase: ReadPhase; observationPhase: ReadPhase; initialPhase?: ModelPhase; readPhase?: ModelPhase; finalPhase?: ModelPhase;
  priorUnknown: boolean; retainedPriorRead: boolean; workspaceObservationAccepted: boolean; readClosed: boolean; currentReadVersionPrepared: boolean;
  parentGetCalls: number; observationGetCalls: number; commandCalls: number; secondCommandAttempts: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY"; reviewProvenance: "SIMULATED_SOURCE_OBSERVATION_ONLY";
  nativeBindingPerformed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false; serverAccepted: false; effectProven: false; observedEffectAttributed: false;
  writeReplayPerformed: false; keyProviderAccessed: false; credentialStoreAccessed: false; realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline cart observation capture"); } }
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
const lineSelector = z.object({ cartId: cartResponseSchema.shape.id, cartVersion: cartVersionSchema.shape.expectedVersion, itemId: cartItemResponseSchema.shape.id }).strict();
function sameFlatRequest(actual: unknown, expected: Readonly<Record<string, unknown>>): boolean {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const keys = Object.keys(actual).sort(), wanted = Object.keys(expected).sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index] && Object.is((actual as Record<string, unknown>)[key], expected[key]));
}

/** Unknown/CAS-conflict source observation, without replay or attribution of the first operation's effect. */
export async function replayCartCommandObservation(input: unknown): Promise<CartObservationReport> {
  let stage: CartObservationReport["stage"] = "input", kind: CartObservationKind | undefined, action: CartObservationAction | undefined, parentPhase: ReadPhase = "not-run", observationPhase: ReadPhase = "not-run", initialPhase: ModelPhase | undefined, readPhase: ModelPhase | undefined, finalPhase: ModelPhase | undefined;
  let priorUnknown = false, workspaceObservationAccepted = false, readClosed = false, currentReadVersionPrepared = false, parentGetCalls = 0, observationGetCalls = 0, commandCalls = 0, secondCommandAttempts = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, kernel: Kernel | undefined;
  const report = (status: CartObservationReport["status"]): CartObservationReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), ...(action ? { action } : {}), parentPhase, observationPhase, ...(initialPhase ? { initialPhase } : {}), ...(readPhase ? { readPhase } : {}), ...(finalPhase ? { finalPhase } : {}), priorUnknown, retainedPriorRead: kernel?.retainedPriorRead() ?? false, workspaceObservationAccepted, readClosed, currentReadVersionPrepared, parentGetCalls, observationGetCalls, commandCalls, secondCommandAttempts, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_OBSERVATION_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, observedEffectAttributed: false, writeReplayPerformed: false, keyProviderAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "action", "scope", "expected", "query", "parent", "operation", "observation"]); if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(["quantity", "remove"]), envelope.kind); action = decode(z.enum(cartObservationActions), envelope.action);
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
    const expected = decode(lineSelector, scalars(envelope.expected, Object.keys(lineSelector.shape)));
    stage = "query"; const rawQuery = object(envelope.query, ["kind", "input"]); if (rawQuery.kind !== "workspace-carts") invalid(); const queryInput = decode(workspacePageQuerySchema.strict(), scalars(rawQuery.input, Object.keys(workspacePageQuerySchema.shape)));
    stage = "capture"; const parent = record(envelope.parent), operation = record(envelope.operation, true), observation = record(envelope.observation); if (operation.header.method !== (kind === "quantity" ? "PATCH" : "DELETE")) invalid();
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let snapshot: Readonly<Record<string, unknown>> | undefined;
    const request = () => { if (snapshot) return snapshot; try { const schema = kind === "quantity" ? updateCartItemSchema : cartVersionSchema, raw = scalars(operation.raw.requestBody, Object.keys(schema.shape)); decode<unknown>(schema.strict(), raw); if (raw.expectedVersion !== expected.cartVersion) return invalid(); snapshot = raw; return raw; } catch { return invalid(); } };
    kernel = createCartObservationKernel(scope, { kind: "workspace-carts", input: queryInput }, async path => {
      if (stage === "parent") { if (parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; const body = response(parent), root = pageBinding.safeParse(body);
        if (!root.success || root.data.items.some(cart => cart.buyerOrganizationId !== scope.organizationId) || !root.data.current || root.data.current.buyerOrganizationId !== scope.organizationId || root.data.current.id !== expected.cartId || root.data.current.version !== expected.cartVersion) return null; return body; }
      if (stage !== "observation" || observationGetCalls || path !== observation.header.path) return invalid(); observationGetCalls++; return response(observation);
    }, async (method, path, body) => {
      if (stage !== "command") { secondCommandAttempts++; return invalid(); }
      if (commandCalls || method !== operation.header.method || path !== operation.header.path || !sameFlatRequest(body, request())) return invalid(); commandCalls++; return response(operation);
    });
    stage = "parent"; await kernel.load(); parentPhase = kernel.readState().phase; if (invalidCapture) return report("INPUT_INVALID"); const cart = kernel.page()?.current; if (!cart) return report("CONSUMER_REJECTED"); if (!cart.items.some(row => row.id === expected.itemId)) return report("UNSUPPORTED_CONTEXT");
    stage = "command"; if (!await submitCartObservationInitial(kernel, kind, expected.itemId, kind === "quantity" ? request().quantity : undefined)) return report("UNSUPPORTED_CONTEXT");
    let current = kernel.model.stateFor(expected.cartId); initialPhase = current.phase; priorUnknown = current.priorUnknown === true;
    if (invalidCapture) return report("INPUT_INVALID"); if (commandCalls !== 1 || !["unknown", "conflict"].includes(initialPhase) || !kernel.model.canRead(expected.cartId, expected.itemId)) return report("UNSUPPORTED_CONTEXT");
    stage = "observation"; await kernel.model.readCurrent(expected.cartId, expected.itemId); observationPhase = kernel.readState().phase; current = kernel.model.stateFor(expected.cartId); readPhase = current.phase; priorUnknown = current.priorUnknown === true;
    if (invalidCapture) return report("INPUT_INVALID"); if (!kernel.page() || !["review", "source-changed"].includes(readPhase)) return report("CONSUMER_REJECTED");
    stage = "action"; if (!applyCartObservationAction(kernel, expected.cartId, expected.itemId, action)) return report("UNSUPPORTED_CONTEXT");
    current = kernel.model.stateFor(expected.cartId); finalPhase = current.phase; priorUnknown = current.priorUnknown === true;
    workspaceObservationAccepted = action === "observe-workspace"; readClosed = action === "close-read";
    currentReadVersionPrepared = action === "prepare" && !!kernel.page()?.current && current.input?.expectedVersion === kernel.page()!.current!.version;
    return report(commandCalls === 1 && observationGetCalls === 1 && secondCommandAttempts === 0 ? "CONSISTENT_OBSERVATION" : "INPUT_INVALID");
  } catch { return report(invalidCapture || stage === "input" || stage === "query" || stage === "capture" ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); }
}
