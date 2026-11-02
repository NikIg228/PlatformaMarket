import { z } from "zod";
import { compareOffersSchema } from "../../../../packages/schemas/src/index";
import { createSavedListSchema, upsertSavedListItemSchema } from "../../../../packages/schemas/src/commercial";
import type { MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import type { OfferComparisonResponse } from "../../../../packages/schemas/src/core-api";
import type { ReadScope } from "../read-controller";
import { createScopedCoreReadQueries } from "../scoped-core-read-queries";
import { createMarketOperationScope } from "../market-operation-scope";
import { bindMarketReads, MarketHttpError } from "../market-transport";
import { createWorkspaceCaptureKernel } from "./workspace-read-capture-kernel";
import { createSavedListMutationCaptureKernel, savedListCaptureKinds, type SavedListCaptureKind } from "./saved-list-mutation-capture-kernel";

type Kernel = ReturnType<typeof createSavedListMutationCaptureKernel>;
type State = ReturnType<Kernel["create"]["getSnapshot"]> | ReturnType<Kernel["item"]["getSnapshot"]> | ReturnType<Kernel["remove"]["getSnapshot"]>;
type ItemState = ReturnType<Kernel["item"]["getSnapshot"]>;
type QuantityIssueKind = NonNullable<ItemState["quantityIssue"]>["kind"];
type TextIssueKind = NonNullable<ItemState["noteIssue"]>["kind"];
export type SavedListMutationCaptureReport = Readonly<{
  status: "INPUT_INVALID" | "CONSISTENT_RESPONSE" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
  stage: "input" | "query" | "capture" | "comparison" | "parent" | "command"; kind?: SavedListCaptureKind;
  comparisonPhase: ReturnType<ReturnType<typeof createScopedCoreReadQueries>["getState"]>["phase"] | "not-run";
  parentPhase: ReturnType<ReturnType<typeof createWorkspaceCaptureKernel>["controller"]["getSnapshot"]>["state"]["phase"] | "not-run";
  operationPhase?: State["phase"]; operationIssue?: State["issue"]; quantityIssueKind?: QuantityIssueKind; textIssueKind?: TextIssueKind;
  comparisonGetCalls: number; workspaceGetCalls: number; commandCalls: number; unresolvedAttempts: number;
  responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY";
  nativeBindingPerformed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false;
  serverAccepted: false; effectProven: false; keyProviderAccessed: false; credentialStoreAccessed: false;
  realNetworkRequests: 0; realServerMutations: 0;
}>;
class CaptureInputError extends Error { constructor() { super("Invalid offline saved-list operation capture"); } }
function object(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CaptureInputError();
  const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) throw new CaptureInputError();
  for (const key of Reflect.ownKeys(input)) if (typeof key !== "string" || !allowed.includes(key)) throw new CaptureInputError();
  return input as Record<string, unknown>;
}
function scalars(input: unknown, allowed: readonly string[]) {
  const raw = object(input, allowed), result: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) { const value = raw[key]; if (value !== null && value !== undefined && !["string", "number", "boolean"].includes(typeof value)) throw new CaptureInputError(); Object.defineProperty(result, key, { value, enumerable: true }); }
  return Object.freeze(result);
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T { try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Fixed redacted failure only. */ } throw new CaptureInputError(); }
function record(value: unknown, method: "GET" | "POST" | "DELETE") {
  const raw = object(value, ["method", "path", "httpStatus", "body", ...(method === "POST" ? ["requestBody"] : [])]);
  const header = decode(z.object({ method: z.literal(method), path: z.string().min(1), httpStatus: z.number().int().min(200).max(599) }).strict(), { method: raw.method, path: raw.path, httpStatus: raw.httpStatus });
  if (!Object.hasOwn(raw, "body") || method === "POST" && !Object.hasOwn(raw, "requestBody")) throw new CaptureInputError(); return { raw, header };
}
/** Initial source-model compatibility only; private local DTOs are not accepted CURRENT API schemas. */
export async function replaySavedListMutationCapture(input: unknown): Promise<SavedListMutationCaptureReport> {
  let stage: SavedListMutationCaptureReport["stage"] = "input", kind: SavedListCaptureKind | undefined, comparisonPhase: SavedListMutationCaptureReport["comparisonPhase"] = "not-run", parentPhase: SavedListMutationCaptureReport["parentPhase"] = "not-run";
  let operationPhase: State["phase"] | undefined, operationIssue: State["issue"], quantityIssueKind: QuantityIssueKind | undefined, textIssueKind: TextIssueKind | undefined, comparisonGetCalls = 0, workspaceGetCalls = 0, commandCalls = 0, unresolvedAttempts = 0, invalidCapture = false;
  let lifetime: ReturnType<typeof createMarketOperationScope> | undefined, workspace: ReturnType<typeof createWorkspaceCaptureKernel> | undefined, queries: ReturnType<typeof createScopedCoreReadQueries> | undefined, client: ReturnType<typeof bindMarketReads> | undefined, scope: ReadScope | undefined, kernel: Kernel | undefined;
  const report = (status: SavedListMutationCaptureReport["status"]): SavedListMutationCaptureReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), comparisonPhase, parentPhase, ...(operationPhase ? { operationPhase } : {}), ...(operationIssue ? { operationIssue } : {}), ...(quantityIssueKind ? { quantityIssueKind } : {}), ...(textIssueKind ? { textIssueKind } : {}), comparisonGetCalls, workspaceGetCalls, commandCalls, unresolvedAttempts, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
  try {
    const envelope = object(input, ["formatVersion", "kind", "scope", "expected", "comparisonQuery", "comparison", "parent", "operation"]);
    if (envelope.formatVersion !== 1) invalid(); kind = decode(z.enum(savedListCaptureKinds), envelope.kind);
    if (kind === "list-create" && Object.hasOwn(envelope, "expected") || kind !== "list-upsert" && (Object.hasOwn(envelope, "comparisonQuery") || Object.hasOwn(envelope, "comparison"))) invalid();
    const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]); lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); scope = lifetime.owner;
    const expected = kind === "list-create" ? undefined : kind === "list-upsert" ? decode(z.object({ listId: z.uuid(), offerId: z.uuid() }).strict(), scalars(envelope.expected, ["listId", "offerId"])) : decode(z.object({ listId: z.uuid(), itemId: z.uuid() }).strict(), scalars(envelope.expected, ["listId", "itemId"]));
    let comparisonQuery: MobileReadQuery | undefined;
    if (kind === "list-upsert") {
      stage = "query"; const root = object(envelope.comparisonQuery, ["kind", "input"]); if (root.kind !== "comparison") invalid();
      const raw = scalars(root.input, Object.keys(compareOffersSchema.shape).filter(key => key !== "buyerOrganizationId")); decode<unknown>(compareOffersSchema.strict(), { ...raw, buyerOrganizationId: scope.organizationId }); comparisonQuery = { kind: "comparison", input: raw } as MobileReadQuery;
    }
    stage = "capture"; const comparison = kind === "list-upsert" ? record(envelope.comparison, "GET") : undefined, parent = record(envelope.parent, "GET"), operation = record(envelope.operation, kind === "list-remove" ? "DELETE" : "POST");
    const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
    let compared: OfferComparisonResponse | null = null;
    if (comparison && comparisonQuery) {
      client = bindMarketReads(async path => { if (stage !== "comparison" || comparisonGetCalls || path !== comparison.header.path) return invalid(); comparisonGetCalls++; return response(comparison); }, scope.organizationId); queries = createScopedCoreReadQueries(scope, client);
      stage = "comparison"; await queries.load(comparisonQuery); const state = queries.getState(); comparisonPhase = state.phase;
      if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "comparison") return report("CONSUMER_REJECTED"); compared = state.read.value;
    }
    workspace = createWorkspaceCaptureKernel(scope, "saved-lists", async () => invalid(), async path => { if (stage !== "parent" || workspaceGetCalls || path !== parent.header.path) return invalid(); workspaceGetCalls++; return response(parent); });
    stage = "parent"; await workspace.controller.load({ kind: "saved-lists" }); const state = workspace.controller.getSnapshot().state; parentPhase = state.phase;
    if (invalidCapture || workspace.unexpectedWrites()) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "saved-lists") return report("CONSUMER_REJECTED");
    const page = state.read.value, list = expected ? page.find(row => row.id === expected.listId) : undefined, selectedItem = expected && "itemId" in expected ? list?.items.find(row => row.id === expected.itemId) : undefined;
    if (kind !== "list-create" && !list || kind === "list-remove" && !selectedItem) return report("UNSUPPORTED_CONTEXT");
    let requestSnapshot: Readonly<Record<string, unknown>> | undefined;
    const request = () => {
      if (requestSnapshot) return requestSnapshot;
      try { const schema = kind === "list-create" ? createSavedListSchema : upsertSavedListItemSchema, raw = scalars(operation.raw.requestBody, Object.keys(schema.shape)); decode<unknown>(schema.strict(), raw); requestSnapshot = raw; return raw; } catch { return invalid(); }
    };
    kernel = createSavedListMutationCaptureKernel(scope, page, compared, async (method, path, body) => {
      if (stage !== "command" || commandCalls || method !== operation.header.method || path !== operation.header.path) return invalid();
      if (kind === "list-remove") { if (body !== undefined) return invalid(); }
      else {
        const saved = request(), actual = body as Readonly<Record<string, unknown>> | undefined; if (!actual) return invalid();
        const keys = Object.keys(actual).sort(), wanted = Object.keys(saved).sort(); if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index] || !Object.is(actual[key], saved[key]))) return invalid();
      }
      commandCalls++; return response(operation);
    });
    stage = "command"; let selected = false;
    if (kind === "list-create") {
      const saved = request(); if (typeof saved.name !== "string" || typeof saved.isDefault !== "boolean") return invalid();
      kernel.create.start(saved.name); kernel.create.setDefault(saved.isDefault); selected = kernel.create.prepare(page); textIssueKind = kernel.create.getSnapshot().nameIssue?.kind;
    } else if (kind === "list-remove") selected = kernel.remove.prepare(page, list!, selectedItem!);
    else {
      const target = kernel.draft.begin(compared!, (expected as { offerId: string }).offerId); if (!target) return report("UNSUPPORTED_CONTEXT");
      const saved = request(); if (typeof saved.quantity !== "number") return invalid(); if (typeof saved.note !== "string") return report("UNSUPPORTED_CONTEXT");
      kernel.draft.setText(target, "quantityText", String(saved.quantity)); kernel.draft.setText(target, "noteText", saved.note);
      selected = kernel.item.select(target, compared!) === "selected" && kernel.item.prepare(page, list!);
      const state = kernel.item.getSnapshot(); quantityIssueKind = state.quantityIssue?.kind; textIssueKind = state.noteIssue?.kind;
    }
    const model = kind === "list-create" ? kernel.create : kind === "list-remove" ? kernel.remove : kernel.item;
    if (!selected || !model.canConfirm()) { operationPhase = model.getSnapshot().phase; return report("UNSUPPORTED_CONTEXT"); }
    await model.confirm(); const current = model.getSnapshot(); operationPhase = current.phase; operationIssue = current.issue; unresolvedAttempts = current.priorUnknown.length;
    if (invalidCapture) return report("INPUT_INVALID");
    return report(commandCalls === 1 && !kernel.reloads() && !kernel.unexpectedReads() && current.phase === "result" ? "CONSISTENT_RESPONSE" : "CONSUMER_REJECTED");
  } catch { return report(invalidCapture || ["input", "query", "capture"].includes(stage) ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
  finally { kernel?.close(); workspace?.close(); lifetime?.close(); if (scope && client) queries?.reset(scope, client); }
}
