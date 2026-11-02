import { z } from "zod";
import { addCartItemSchema, cartVersionSchema, compareOffersSchema } from "../../../../packages/schemas/src/index";
import { cartResponseSchema } from "../../../../packages/schemas/src/core-api";
import { workspacePageQuerySchema } from "../../../../packages/schemas/src/workspace-reads";
import type { MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import type { ReadScope } from "../read-controller";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { createMarketOperationScope } from "../market-operation-scope";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { createCartAddCaptureKernel } from "./cart-add-capture-kernel";

type Queries = ReturnType<typeof createScopedCoreReadQueries>;
type Kernel = ReturnType<typeof createCartAddCaptureKernel>;
type AddState = ReturnType<Kernel["model"]["getSnapshot"]>;
export type CartAddCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "comparison" | "parent" | "command"; kind?: "cart-add";
  comparisonPhase: ReturnType<Queries["getState"]>["phase"] | "not-run"; parentPhase: ReturnType<Queries["getState"]>["phase"] | "not-run";
  operationPhase?: AddState["phase"]; operationIssue?: AddState["issue"]; selectionIssue?: AddState["selectionIssue"];
  quantityIssueKind?: NonNullable<AddState["quantityIssue"]>["kind"];
  comparisonGetCalls: number; cartGetCalls: number; commandCalls: number;
  modelAuthorization: "SYNTHETIC_ONLY"; nativeBindingPerformed: false; businessEligibilityVerified: false;
  productionAuthorizationVerified: false; serverAccepted: false; effectProven: false; cartVersionInferred: false; keyProviderAccessed: false;
  realNetworkRequests: 0; realServerMutations: 0; credentialStoreAccessed: false;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline cart add capture"); } }
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
  try { const parsed = schema.safeParse(input); if (parsed.success) return parsed.data; } catch { /* No private input/getter error output. */ }
  throw new CaptureInputError();
}
function record(input: unknown, command = false) {
  const raw = object(input, ["method", "path", "httpStatus", "body", ...(command ? ["requestBody"] : [])]);
  const header = decode(z.object({ method: z.literal(command ? "POST" : "GET"), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || command && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError();
  return { raw, header };
}
const cartBinding = cartResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true }).strip();
const pageBinding = z.object({ current: cartBinding.nullable(), items: z.array(cartBinding) }).strip();
const expectedSchema = z.object({ cartId: cartResponseSchema.shape.id, cartVersion: cartVersionSchema.shape.expectedVersion, offerId: addCartItemSchema.shape.offerId }).strict();

/** One initial add-offer response through original source rules. No real command, root-version inference or grant. */
export async function replayCartAddCapture(input: unknown): Promise<CartAddCaptureReport> {
  let stage: CartAddCaptureReport["stage"] = "input", kind: "cart-add" | undefined, comparisonPhase: CartAddCaptureReport["comparisonPhase"] = "not-run", parentPhase: CartAddCaptureReport["parentPhase"] = "not-run";
  let operationPhase: CartAddCaptureReport["operationPhase"], operationIssue: CartAddCaptureReport["operationIssue"], selectionIssue: CartAddCaptureReport["selectionIssue"], quantityIssueKind: CartAddCaptureReport["quantityIssueKind"];
  let comparisonGetCalls = 0, cartGetCalls = 0, commandCalls = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, scope: ReadScope | undefined, client: ReturnType<typeof bindMarketReads> | undefined, comparisonQueries: Queries | undefined, cartQueries: Queries | undefined, kernel: Kernel | undefined;
  const report = (status: CartAddCaptureReport["status"]): CartAddCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), comparisonPhase, parentPhase, ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), ...(selectionIssue ? { selectionIssue } : {}), ...(quantityIssueKind ? { quantityIssueKind } : {}), comparisonGetCalls, cartGetCalls, commandCalls, modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, cartVersionInferred: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "comparisonQuery", "cartQuery", "comparison", "parent", "operation"]);
    if (envelope.formatVersion !== 1) invalid(); kind = decode(z.literal("cart-add"), envelope.kind);
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
    lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); scope = lifetime.owner;
    const expected = decode(expectedSchema, scalars(envelope.expected, Object.keys(expectedSchema.shape)));
    stage = "query";
    const comparisonRoot = object(envelope.comparisonQuery, ["kind", "input"]), cartRoot = object(envelope.cartQuery, ["kind", "input"]);
    if (comparisonRoot.kind !== "comparison" || cartRoot.kind !== "workspace-carts") invalid();
    const comparisonInput = scalars(comparisonRoot.input, Object.keys(compareOffersSchema.shape).filter(key => key !== "buyerOrganizationId"));
    decode<unknown>(compareOffersSchema.strict(), { ...comparisonInput, buyerOrganizationId: scope.organizationId });
    // Keep validated z.input scalar text; actual dispatcher/binding decides wire defaults/encoding.
    const comparisonQuery = Object.freeze({ kind: "comparison", input: comparisonInput }) as MobileReadQuery;
    const cartInput = scalars(cartRoot.input, Object.keys(workspacePageQuerySchema.shape)); decode(workspacePageQuerySchema.strict(), cartInput);
    stage = "capture"; const comparison = record(envelope.comparison), parent = record(envelope.parent), operation = record(envelope.operation, true);
    const response = (entry: ReturnType<typeof record>) => {
      let body: unknown; try { body = entry.raw.body; } catch { return invalid(); }
      if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body;
    };
    client = bindMarketReads(async path => {
      if (stage === "comparison") { if (comparisonGetCalls || path !== comparison.header.path) return invalid(); comparisonGetCalls++; return response(comparison); }
      if (stage !== "parent" || cartGetCalls || path !== parent.header.path) return invalid(); cartGetCalls++;
      const body = response(parent), root = pageBinding.safeParse(body);
      if (!root.success || root.data.current && (root.data.current.buyerOrganizationId !== scope!.organizationId || root.data.current.id !== expected.cartId || root.data.current.version !== expected.cartVersion) || root.data.items.some(cart => cart.buyerOrganizationId !== scope!.organizationId)) return null;
      return body;
    }, scope.organizationId);
    comparisonQueries = createScopedCoreReadQueries(scope, client); cartQueries = createScopedCoreReadQueries(scope, client);
    stage = "comparison"; await comparisonQueries.load(comparisonQuery); const compared = comparisonQueries.getState(); comparisonPhase = compared.phase;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!("read" in compared) || compared.read.kind !== "comparison") return report("CONSUMER_REJECTED");
    stage = "parent"; await cartQueries.load({ kind: "workspace-carts", input: cartInput }); const current = cartQueries.getState(); parentPhase = current.phase;
    if (invalidCapture) return report("INPUT_INVALID");
    if (!("read" in current) || current.read.kind !== "workspace-carts") return report("CONSUMER_REJECTED");
    const page = current.read.value; if (!page.current) return report("UNSUPPORTED_CONTEXT");
    let requestSnapshot: Readonly<Record<string, unknown>> | undefined;
    const capturedRequest = () => {
      if (requestSnapshot) return requestSnapshot;
      try { const raw = scalars(operation.raw.requestBody, Object.keys(addCartItemSchema.shape)); decode(addCartItemSchema.strict(), raw); requestSnapshot = raw; return raw; }
      catch { return invalid(); }
    };
    kernel = createCartAddCaptureKernel(scope, compared.read.value, page, async (method, path, body) => {
      if (stage !== "command" || commandCalls || method !== operation.header.method || path !== operation.header.path || !body) return invalid();
      const saved = capturedRequest(), actual = body as Readonly<Record<string, unknown>>, keys = Object.keys(actual).sort(), wanted = Object.keys(saved).sort();
      if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index] || !Object.is(actual[key], saved[key]))) return invalid();
      commandCalls++; return response(operation);
    });
    stage = "command"; const target = kernel.list.begin(compared.read.value, expected.offerId); if (!target) return report("UNSUPPORTED_CONTEXT");
    const quantity = capturedRequest().quantity; if (typeof quantity !== "number") return invalid(); kernel.list.setText(target, "quantityText", String(quantity));
    const selected = kernel.model.select(target, compared.read.value);
    if (selected !== "selected" || !kernel.model.canSubmit(page)) {
      const state = kernel.model.getSnapshot(); operationPhase = state.phase; selectionIssue = state.selectionIssue; quantityIssueKind = state.quantityIssue?.kind; return report("UNSUPPORTED_CONTEXT");
    }
    await kernel.model.submit(page); const state = kernel.model.getSnapshot(); operationPhase = state.phase; operationIssue = state.issue;
    if (invalidCapture) return report("INPUT_INVALID");
    return report(commandCalls === 1 && kernel.reloads() === 0 && state.phase === "result" && !!kernel.model.resultCartId() ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || ["input", "query", "capture"].includes(stage) ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); lifetime?.close(); if (scope && client) { comparisonQueries?.reset(scope, client); cartQueries?.reset(scope, client); } }
}
