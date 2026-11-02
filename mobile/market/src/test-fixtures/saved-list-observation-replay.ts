import { z } from "zod";
import { compareOffersSchema } from "../../../../packages/schemas/src/index";
import { createSavedListSchema, upsertSavedListItemSchema } from "../../../../packages/schemas/src/commercial";
import type { MobileReadQuery } from "../../../../contracts/mobile-read/read-queries";
import { createMarketOperationScope } from "../market-operation-scope";
import { MarketHttpError } from "../market-transport";
import type { ReadScope } from "../read-controller";
import { savedListCaptureKinds, type SavedListCaptureKind } from "./saved-list-mutation-capture-kernel";
import { createSavedListObservationKernel } from "./saved-list-observation-kernel";

type Kernel = ReturnType<typeof createSavedListObservationKernel>;
type Controller = Kernel["controller"];
type State = ReturnType<Controller["savedListCreateCommands"]["getSnapshot"]> | ReturnType<Controller["savedListItemCommands"]["getSnapshot"]> | ReturnType<Controller["savedListRemoveCommands"]["getSnapshot"]>;
type ReadPhase = ReturnType<Controller["getSnapshot"]>["state"]["phase"];
export type SavedListObservationReport = Readonly<{
 status: "INPUT_INVALID" | "CONSISTENT_OBSERVATION" | "UNSUPPORTED_CONTEXT" | "CONSUMER_REJECTED";
 stage: "input" | "query" | "capture" | "comparison" | "parent" | "initial" | "observation";
 kind?: SavedListCaptureKind; comparisonPhase: ReadPhase | "not-run"; parentPhase: ReadPhase | "not-run"; observationPhase: ReadPhase | "not-run";
 initialPhase?: State["phase"]; finalPhase?: State["phase"];
 comparisonGetCalls: number; parentGetCalls: number; observationGetCalls: number; commandCalls: number;
 initialUnresolved: boolean; unresolved: boolean; initialUnknownAttempts: number; unknownAttempts: number;
 sameUnknownRecordRetained: boolean; sameAttemptInputRetained: boolean;
 responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY"; modelAuthorization: "SYNTHETIC_ONLY";
 nativeBindingPerformed: false; businessEligibilityVerified: false; productionAuthorizationVerified: false;
 serverAccepted: false; effectProven: false; keyProviderAccessed: false; credentialStoreAccessed: false;
 automaticRetryPerformed: false; writeReplayPerformed: false; observedEffectAttributed: false; readAcknowledged: false; newAttemptPrepared: false;
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
/** Explicit own-list observation of one unresolved attempt; GET is not a mutation receipt. */
export async function replaySavedListObservation(input: unknown): Promise<SavedListObservationReport> {
 let stage: SavedListObservationReport["stage"] = "input", kind: SavedListCaptureKind | undefined;
 let comparisonPhase: ReadPhase | "not-run" = "not-run", parentPhase: ReadPhase | "not-run" = "not-run", observationPhase: ReadPhase | "not-run" = "not-run";
 let initialPhase: State["phase"] | undefined, finalPhase: State["phase"] | undefined;
 let comparisonGetCalls = 0, parentGetCalls = 0, observationGetCalls = 0, commandCalls = 0, initialUnknownAttempts = 0, unknownAttempts = 0;
 let initialUnresolved = false, unresolved = false, sameUnknownRecordRetained = false, sameAttemptInputRetained = false, invalidCapture = false;
 let kernel: Kernel | undefined, lifetime: ReturnType<typeof createMarketOperationScope> | undefined;
 const report = (status: SavedListObservationReport["status"]): SavedListObservationReport => Object.freeze({ status, stage, ...(kind ? { kind } : {}), comparisonPhase, parentPhase, observationPhase, ...(initialPhase ? { initialPhase } : {}), ...(finalPhase ? { finalPhase } : {}), comparisonGetCalls, parentGetCalls, observationGetCalls, commandCalls, initialUnresolved, unresolved, initialUnknownAttempts, unknownAttempts, sameUnknownRecordRetained, sameAttemptInputRetained, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, credentialStoreAccessed: false, automaticRetryPerformed: false, writeReplayPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false, realNetworkRequests: 0, realServerMutations: 0 });
 const invalid = (): never => { invalidCapture = true; throw new CaptureInputError(); };
 try {
  const envelope = object(input, ["formatVersion", "mode", "kind", "scope", "expected", "comparisonQuery", "comparison", "parent", "initial", "observation"]);
  if (envelope.formatVersion !== 1 || envelope.mode !== "saved-list-observation") invalid();
  kind = decode(z.enum(savedListCaptureKinds), envelope.kind);
  if (kind === "list-create" && Object.hasOwn(envelope, "expected") || kind !== "list-upsert" && (Object.hasOwn(envelope, "comparisonQuery") || Object.hasOwn(envelope, "comparison"))) invalid();
  const owner = scalars(envelope.scope, ["product", "environment", "userId", "organizationId", "generation"]);
  lifetime = createMarketOperationScope(owner as ReadScope, () => true, () => new CaptureInputError()); const scope = lifetime.owner;
  const expected = kind === "list-create" ? undefined : kind === "list-upsert" ? decode(z.object({ listId: z.uuid(), offerId: z.uuid() }).strict(), scalars(envelope.expected, ["listId", "offerId"])) : decode(z.object({ listId: z.uuid(), itemId: z.uuid() }).strict(), scalars(envelope.expected, ["listId", "itemId"]));
  let comparisonQuery: MobileReadQuery | undefined;
  if (kind === "list-upsert") {
   stage = "query"; const root = object(envelope.comparisonQuery, ["kind", "input"]); if (root.kind !== "comparison") invalid();
   const raw = scalars(root.input, Object.keys(compareOffersSchema.shape).filter(key => key !== "buyerOrganizationId")); decode<unknown>(compareOffersSchema.strict(), { ...raw, buyerOrganizationId: scope.organizationId }); comparisonQuery = { kind: "comparison", input: raw } as MobileReadQuery;
  }
  stage = "capture";
  const comparison = kind === "list-upsert" ? record(envelope.comparison, "GET") : undefined, parent = record(envelope.parent, "GET"), initial = record(envelope.initial, kind === "list-remove" ? "DELETE" : "POST"), observation = record(envelope.observation, "GET");
  if (observation.header.path !== parent.header.path) invalid();
  const response = (entry: ReturnType<typeof record>) => { let body: unknown; try { body = entry.raw.body; } catch { return invalid(); } if (entry.header.httpStatus >= 300) throw new MarketHttpError(entry.header.httpStatus, body); return body; };
  let requestSnapshot: Readonly<Record<string, unknown>> | undefined;
  const request = () => { if (requestSnapshot) return requestSnapshot; try { const schema = kind === "list-create" ? createSavedListSchema : upsertSavedListItemSchema, raw = scalars(initial.raw.requestBody, Object.keys(schema.shape)); decode<unknown>(schema.strict(), raw); requestSnapshot = raw; return raw; } catch { return invalid(); } };
  kernel = createSavedListObservationKernel(scope, async path => {
   if (stage !== "comparison" || !comparison || comparisonGetCalls || path !== comparison.header.path) return invalid(); comparisonGetCalls++; return response(comparison);
  }, async path => {
   if (stage === "parent") { if (parentGetCalls || path !== parent.header.path) return invalid(); parentGetCalls++; return response(parent); }
   if (stage !== "observation" || observationGetCalls || path !== observation.header.path) return invalid(); observationGetCalls++; return response(observation);
  }, async (method, path, body) => {
   if (stage !== "initial" || commandCalls || method !== initial.header.method || path !== initial.header.path) return invalid();
   if (kind === "list-remove") { if (body !== undefined) return invalid(); }
   else { const saved = request(), actual = body as Readonly<Record<string, unknown>> | undefined; if (!actual) return invalid(); const keys = Object.keys(actual).sort(), wanted = Object.keys(saved).sort(); if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index] || !Object.is(actual[key], saved[key]))) return invalid(); }
   commandCalls++; return response(initial);
  });
  const controller = kernel.controller;
  if (comparisonQuery) {
   stage = "comparison"; await controller.load(comparisonQuery); const state = controller.getSnapshot().state; comparisonPhase = state.phase;
   if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in state) || state.read.kind !== "comparison") return report("CONSUMER_REJECTED");
   const compared = state.read.value, target = controller.localListDraft.begin(compared, (expected as { offerId: string }).offerId); if (!target) return report("UNSUPPORTED_CONTEXT");
   const saved = request(); if (typeof saved.quantity !== "number") return invalid(); if (typeof saved.note !== "string") return report("UNSUPPORTED_CONTEXT");
   controller.localListDraft.setText(target, "quantityText", String(saved.quantity)); controller.localListDraft.setText(target, "noteText", saved.note);
   if (controller.savedListItemCommands.select(target, compared) !== "selected") return report("UNSUPPORTED_CONTEXT");
  }
  stage = "parent"; await controller.load({ kind: "saved-lists" }); const parentState = controller.getSnapshot().state; parentPhase = parentState.phase;
  if (invalidCapture) return report("INPUT_INVALID"); if (!("read" in parentState) || parentState.read.kind !== "saved-lists") return report("CONSUMER_REJECTED");
  const page = parentState.read.value, list = expected ? page.find(row => row.id === expected.listId) : undefined, selectedItem = expected && "itemId" in expected ? list?.items.find(row => row.id === expected.itemId) : undefined;
  if (kind !== "list-create" && !list || kind === "list-remove" && !selectedItem) return report("UNSUPPORTED_CONTEXT");
  const model = kind === "list-create" ? controller.savedListCreateCommands : kind === "list-upsert" ? controller.savedListItemCommands : controller.savedListRemoveCommands;
  let selected = false;
  if (kind === "list-create") { const saved = request(); if (typeof saved.name !== "string" || typeof saved.isDefault !== "boolean") return invalid(); controller.savedListCreateCommands.start(saved.name); controller.savedListCreateCommands.setDefault(saved.isDefault); selected = controller.savedListCreateCommands.prepare(page); }
  else if (kind === "list-upsert") selected = controller.savedListItemCommands.prepare(page, list!);
  else selected = controller.savedListRemoveCommands.prepare(page, list!, selectedItem!);
  if (!selected || !model.canConfirm()) return report("UNSUPPORTED_CONTEXT");
  stage = "initial"; await model.confirm(); const before = model.getSnapshot(); initialPhase = before.phase; initialUnresolved = before.unresolved === true; initialUnknownAttempts = before.priorUnknown.length;
  unresolved = initialUnresolved; unknownAttempts = initialUnknownAttempts;
  if (invalidCapture) return report("INPUT_INVALID"); if (commandCalls !== 1 || before.phase !== "unknown" || !initialUnresolved || initialUnknownAttempts !== 1 || !model.canRead()) return report("UNSUPPORTED_CONTEXT");
  stage = "observation"; await model.readCurrent(); const current = model.getSnapshot(), read = controller.getSnapshot().state;
  finalPhase = current.phase; observationPhase = read.phase; unresolved = current.unresolved === true; unknownAttempts = current.priorUnknown.length;
  sameUnknownRecordRetained = unknownAttempts === initialUnknownAttempts && current.priorUnknown[0] === before.priorUnknown[0];
  sameAttemptInputRetained = kind === "list-remove" ? "target" in before && "target" in current && current.target === before.target : "input" in before && "input" in current && current.input === before.input;
  if (invalidCapture) return report("INPUT_INVALID");
  return report(observationGetCalls === 1 && commandCalls === 1 && current.phase === "review" && unresolved && sameUnknownRecordRetained && sameAttemptInputRetained ? "CONSISTENT_OBSERVATION" : "CONSUMER_REJECTED");
 } catch { return report(invalidCapture || ["input", "query", "capture"].includes(stage) ? "INPUT_INVALID" : "CONSUMER_REJECTED"); }
 finally { kernel?.close(); lifetime?.close(); }
}
