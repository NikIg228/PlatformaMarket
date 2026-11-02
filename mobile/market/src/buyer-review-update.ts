import { z } from "zod";
import { updateVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { receiptIdentity, receiptSchema, reviewDimensions, type BuyerReviewReceipt, type BuyerReviewCommandPort, type BuyerReviewIssue, type ReviewDraft, type ReviewDimension } from "./buyer-review-create";
import { MarketHttpError } from "./market-transport";
import type { ReadScope } from "./read-controller";

export type BuyerReviewUpdateInput = Readonly<z.output<typeof updateVerifiedReviewSchema>>;
export type BuyerReviewDiscovery = Readonly<{ phase: "loading" | "ready" | "empty" | "error"; receipts: readonly BuyerReviewReceipt[]; issue?: BuyerReviewIssue }>;
export type BuyerReviewUpdateState = Readonly<{
  phase: "idle" | "editing" | "prepared" | "pending" | "unknown" | "rejected" | "checking" | "observed" | "result";
  discovery?: BuyerReviewDiscovery;
  draft?: ReviewDraft; reason?: string; base?: BuyerReviewReceipt; input?: BuyerReviewUpdateInput; receipt?: BuyerReviewReceipt;
  issue?: BuyerReviewIssue; unresolved: boolean; previousOutcomeUnknown: boolean; observationMissing?: boolean;
}>;
const idle: BuyerReviewUpdateState = Object.freeze({ phase: "idle", unresolved: false, previousOutcomeUnknown: false });
type Attempt = { base: BuyerReviewReceipt; input: BuyerReviewUpdateInput; token: object | null; sent: boolean };
function errorIssue(error: unknown): BuyerReviewIssue | null {
  try { if (!(error instanceof MarketHttpError)) return null; const b = errorResponseSchema.safeParse(error.payload); if (!b.success || b.data.statusCode !== error.status) return null; return error.status === 400 ? "input" : error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 || error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : null; } catch { return null; }
}
function readReceipt(body: unknown, base: BuyerReviewReceipt, input?: BuyerReviewUpdateInput): BuyerReviewReceipt | null {
  try {
    const root = receiptIdentity.safeParse(body); if (!root.success || (Object.keys(root.data) as (keyof typeof root.data)[]).some(k => root.data[k] !== base[k])) return null;
    const parsed = receiptSchema.safeParse(body); if (!parsed.success) return null; const row = parsed.data;
    if ((Object.keys(root.data) as (keyof typeof root.data)[]).some(k => row[k] !== root.data[k]) || row.createdAt !== base.createdAt || row.editDeadline !== base.editDeadline || row.version < base.version) return null;
    if (input && (row.version !== input.version + 1 || row.overallRating !== input.overallRating || row.comment !== (input.comment ?? null) || reviewDimensions.some(k => row.dimensions[k] !== input.dimensions[k]) || row.status !== "PENDING" && row.status !== base.status)) return null;
    if (!input && row.status !== "PUBLISHED") return null;
    return Object.freeze({ ...row, dimensions: Object.freeze({ ...row.dimensions }) });
  } catch { return null; }
}

/** Optimistic PATCH is never replayed. Independent published reading cannot attribute a lost response. */
export function createBuyerReviewUpdates(scope: ReadScope, port: BuyerReviewCommandPort | undefined, currentWorkflow: (id: string) => OrderWorkflowResponse | null, now: () => number = Date.now) {
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>(), attempts = new Map<string, Attempt>();
  const discoveryRequests = new Map<string, object>();
  const uncertainHistory = new Map<string, readonly Attempt[]>();
  const knownBases = new Map<string, BuyerReviewReceipt>();
  let active = true, snapshot: Readonly<Record<string, BuyerReviewUpdateState>> = Object.freeze({});
  const stateFor = (id: string) => Object.hasOwn(snapshot, id) ? snapshot[id]! : idle;
  const emit = (id: string, state: BuyerReviewUpdateState) => { snapshot = Object.freeze({ ...snapshot, [id]: Object.freeze(state) }); listeners.forEach(fn => fn()); };
  function own(workflow: OrderWorkflowResponse, receipt: BuyerReviewReceipt) {
    try { return active && currentWorkflow(workflow.orderId) === workflow && workflow.order.id === workflow.orderId && workflow.order.buyerOrganizationId === owner.organizationId && workflow.order.supplierOrganizationId === receipt.supplierOrganizationId && receipt.supplierOrderId === workflow.orderId && receipt.reviewerOrganizationId === owner.organizationId && receipt.reviewerUserId === owner.userId; } catch { return false; }
  }
  function beforeDeadline(receipt: BuyerReviewReceipt) { try { const value = now(); return Number.isFinite(value) && Date.parse(receipt.editDeadline) > value; } catch { return false; } }
  function start(id: string, base: BuyerReviewReceipt, previousOutcomeUnknown: boolean) {
    discoveryRequests.delete(id);
    attempts.delete(id);
    knownBases.set(base.id, base);
    emit(id, { phase: "editing", base, draft: Object.freeze({ overallRating: base.overallRating, dimensions: Object.freeze({ ...base.dimensions }), comment: base.comment ?? "", productVariantId: base.productVariantId }), reason: "", unresolved: false, previousOutcomeUnknown });
  }
  function currentBase(_id: string, candidate: BuyerReviewReceipt) { const known = knownBases.get(candidate.id); if (!known) return candidate; const root = receiptIdentity.safeParse(candidate); if (!root.success || (Object.keys(root.data) as (keyof typeof root.data)[]).some(key => root.data[key] !== known[key])) return candidate; return known.version >= candidate.version ? known : candidate; }
  function previousUnknown(id: string, reviewId: string) { return uncertainHistory.get(id)?.some(attempt => attempt.base.id === reviewId) === true; }
  function blocksTargetSwitch(id: string) { const state = stateFor(id); return !active || !["idle", "result"].includes(state.phase) || state.unresolved || discoveryRequests.has(id); }
  function viewForReceipt(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt): BuyerReviewUpdateState { const state = stateFor(workflow.orderId), base = validatedBase(workflow, currentBase(workflow.orderId, candidate)); if (!base) return idle; return state.base?.id === base.id || state.receipt?.id === base.id ? state : Object.freeze({ ...idle, base, previousOutcomeUnknown: previousUnknown(workflow.orderId, base.id) }); }
  function validatedBase(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt): BuyerReviewReceipt | null {
    try {
      const root = receiptIdentity.safeParse(candidate); if (!root.success || root.data.reviewerOrganizationId !== owner.organizationId || root.data.reviewerUserId !== owner.userId || root.data.supplierOrderId !== workflow.orderId || root.data.targetKey !== (root.data.productVariantId ? `PRODUCT:${root.data.productVariantId}` : "SUPPLIER")) return null;
      const parsed = receiptSchema.safeParse(candidate); if (!parsed.success || (Object.keys(root.data) as (keyof typeof root.data)[]).some(key => parsed.data[key] !== root.data[key])) return null;
      const base = Object.freeze({ ...parsed.data, dimensions: Object.freeze({ ...parsed.data.dimensions }) }); return own(workflow, base) ? base : null;
    } catch { return null; }
  }
  const canBegin = (workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt) => {
    try { const state = stateFor(workflow.orderId), base = validatedBase(workflow, currentBase(workflow.orderId, candidate)); return typeof port?.update === "function" && (state.phase === "idle" || state.phase === "result") && !!base && beforeDeadline(base); } catch { return false; }
  };
  const canConfirm = (workflow: OrderWorkflowResponse) => { const id = workflow.orderId, attempt = attempts.get(id); return active && stateFor(id).phase === "prepared" && !!attempt && !attempt.sent && !attempt.token && own(workflow, attempt.base) && beforeDeadline(attempt.base); };
  function canAcceptObserved(workflow: OrderWorkflowResponse) { const state = stateFor(workflow.orderId); return active && state.phase === "observed" && !!state.receipt && own(workflow, state.receipt) && beforeDeadline(state.receipt); }
  function supportsDiscovery(workflow: OrderWorkflowResponse): boolean {
    try { return active && typeof port?.readPublished === "function" && typeof port.update === "function" && currentWorkflow(workflow.orderId) === workflow && workflow.order.id === workflow.orderId && workflow.order.version === workflow.version && workflow.order.buyerOrganizationId === owner.organizationId && workflow.order.supplierOrganizationId !== owner.organizationId; } catch { return false; }
  }
  function canDiscover(workflow: OrderWorkflowResponse) { return supportsDiscovery(workflow) && ["idle", "result"].includes(stateFor(workflow.orderId).phase) && !discoveryRequests.has(workflow.orderId); }
  function canSelectDiscovered(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt) { const discovery = stateFor(workflow.orderId).discovery; return supportsDiscovery(workflow) && discovery?.phase === "ready" && discovery.receipts.includes(candidate) && canBegin(workflow, candidate); }
  async function discover(workflow: OrderWorkflowResponse) {
    if (!canDiscover(workflow)) return; const id = workflow.orderId, token = {}; discoveryRequests.set(id, token);
    emit(id, { ...stateFor(id), discovery: Object.freeze({ phase: "loading", receipts: Object.freeze([]) }) });
    try {
      const body = await port!.readPublished!(owner, workflow.order.supplierOrganizationId);
      if (!active || discoveryRequests.get(id) !== token || !supportsDiscovery(workflow) || !["idle", "result"].includes(stateFor(id).phase)) return;
      let receipts: BuyerReviewReceipt[];
      try {
        const roots = receiptIdentity.extend({ status: z.literal("PUBLISHED") }).array().max(200).parse(body);
        if (roots.some(row => row.supplierOrganizationId !== workflow.order.supplierOrganizationId) || new Set(roots.map(row => row.id)).size !== roots.length) throw Error("identity");
        const targets = new Set<string>(); receipts = [];
        for (const [index, root] of roots.entries()) {
          if (root.supplierOrderId !== id || root.reviewerOrganizationId !== owner.organizationId || root.reviewerUserId !== owner.userId) continue;
          if (root.targetKey !== (root.productVariantId ? `PRODUCT:${root.productVariantId}` : "SUPPLIER") || targets.has(root.targetKey) || root.productVariantId !== null && !workflow.order.items.some(item => item.supplierOrderId === id && item.productVariantId === root.productVariantId)) throw Error("target");
          const parsed = validatedBase(workflow, (body as BuyerReviewReceipt[])[index]!);
          if (!parsed || (Object.keys(root) as (keyof typeof root)[]).some(key => parsed[key] !== root[key])) throw Error("receipt");
          targets.add(root.targetKey); receipts.push(parsed);
        }
      } catch { discoveryRequests.delete(id); emit(id, { ...stateFor(id), discovery: Object.freeze({ phase: "error", receipts: Object.freeze([]), issue: "contract" }) }); return; }
      discoveryRequests.delete(id); emit(id, { ...stateFor(id), discovery: Object.freeze({ phase: receipts.length ? "ready" : "empty", receipts: Object.freeze(receipts) }) });
    } catch (error) {
      if (!active || discoveryRequests.get(id) !== token || !supportsDiscovery(workflow)) return;
      discoveryRequests.delete(id); emit(id, { ...stateFor(id), discovery: Object.freeze({ phase: "error", receipts: Object.freeze([]), issue: errorIssue(error) ?? "network" }) });
    } finally { if (discoveryRequests.get(id) === token) { discoveryRequests.delete(id); if (active && stateFor(id).discovery?.phase === "loading") emit(id, { ...stateFor(id), discovery: undefined }); } }
  }
  function clear() { active = false; discoveryRequests.clear(); attempts.clear(); uncertainHistory.clear(); knownBases.clear(); snapshot = Object.freeze({}); listeners.forEach(fn => fn()); }
  return {
    getSnapshot: () => snapshot, stateFor, viewForReceipt, blocksTargetSwitch, canBegin, canConfirm, canAcceptObserved, supportsDiscovery, canDiscover, discover, canSelectDiscovered,
    selectDiscovered(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt) { if (!canSelectDiscovered(workflow, candidate)) return false; const base = validatedBase(workflow, currentBase(workflow.orderId, candidate)); if (!base) return false; start(workflow.orderId, base, previousUnknown(workflow.orderId, base.id)); return true; },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    begin(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt) { if (!canBegin(workflow, candidate)) return false; const base = validatedBase(workflow, currentBase(workflow.orderId, candidate)); if (!base) return false; start(workflow.orderId, base, previousUnknown(workflow.orderId, base.id)); return true; },
    setRating(id: string, key: "overallRating" | ReviewDimension, value: number) { const state = stateFor(id); if (!active || state.phase !== "editing" || !state.draft || !Number.isInteger(value) || value < 1 || value > 5 || key !== "overallRating" && !reviewDimensions.includes(key)) return false; const draft = key === "overallRating" ? { ...state.draft, overallRating: value } : { ...state.draft, dimensions: Object.freeze({ ...state.draft.dimensions, [key]: value }) }; emit(id, { ...state, draft: Object.freeze(draft), issue: undefined }); return true; },
    setText(id: string, field: "comment" | "reason", value: string) { const state = stateFor(id); if (!active || state.phase !== "editing" || !state.draft || typeof value !== "string") return false; emit(id, field === "reason" ? { ...state, reason: value, issue: undefined } : { ...state, draft: Object.freeze({ ...state.draft, comment: value }), issue: undefined }); return true; },
    prepare(workflow: OrderWorkflowResponse) {
      const id = workflow.orderId, state = stateFor(id); if (!state.base || !state.draft || state.phase !== "editing" || !own(workflow, state.base) || !beforeDeadline(state.base) || typeof port?.update !== "function") return false;
      const parsed = updateVerifiedReviewSchema.strict().safeParse({ overallRating: state.draft.overallRating, dimensions: state.draft.dimensions, comment: state.draft.comment, version: state.base.version, ...(state.reason?.trim() ? { reason: state.reason } : {}) });
      if (!parsed.success) { emit(id, { ...state, issue: "input" }); return false; }
      const input = Object.freeze({ ...parsed.data, dimensions: Object.freeze({ ...parsed.data.dimensions }) }); attempts.set(id, { base: state.base, input, token: null, sent: false }); emit(id, { ...state, input, phase: "prepared", issue: undefined }); return true;
    },
    edit(id: string) { const state = stateFor(id); if (!active || state.phase !== "prepared" && !(state.phase === "rejected" && (state.issue === "input" || state.issue === "throttled"))) return false; attempts.delete(id); emit(id, { ...state, phase: "editing", input: undefined, issue: undefined }); return true; },
    async confirm(workflow: OrderWorkflowResponse) {
      if (!canConfirm(workflow) || !port?.update) return; const id = workflow.orderId, attempt = attempts.get(id)!; const token = {}; attempt.token = token; attempt.sent = true; emit(id, { ...stateFor(id), phase: "pending", issue: undefined });
      try {
        const body = await port.update(owner, attempt.base.id, attempt.input); if (!active || attempts.get(id) !== attempt || attempt.token !== token) return;
        const current = currentWorkflow(id), receipt = current && own(current, attempt.base) ? readReceipt(body, attempt.base, attempt.input) : null;
        attempt.token = null; if (!receipt) { emit(id, { ...stateFor(id), phase: "unknown", unresolved: true, issue: "contract" }); return; }
        knownBases.set(receipt.id, receipt);
        emit(id, { ...stateFor(id), phase: "result", receipt, unresolved: false, issue: undefined });
      } catch (error) {
        if (!active || attempts.get(id) !== attempt || attempt.token !== token) return; attempt.token = null; const issue = errorIssue(error);
        emit(id, { ...stateFor(id), phase: issue ? "rejected" : "unknown", issue: issue ?? "network", unresolved: !issue });
      }
    },
    canObserve(workflow: OrderWorkflowResponse) { const state = stateFor(workflow.orderId); return !!state.base && own(workflow, state.base) && typeof port?.readPublished === "function" && (state.phase === "unknown" || state.phase === "rejected" && state.issue === "conflict"); },
    async observe(workflow: OrderWorkflowResponse) {
      if (!this.canObserve(workflow) || !port?.readPublished) return; const id = workflow.orderId, state = stateFor(id), attempt = attempts.get(id); if (!attempt || attempt.token) return; const token = {}; attempt.token = token; emit(id, { ...state, phase: "checking", issue: undefined, observationMissing: false });
      try {
        const body = await port.readPublished(owner, attempt.base.supplierOrganizationId); if (!active || attempts.get(id) !== attempt || attempt.token !== token) return;
        const current = currentWorkflow(id); if (!current || !own(current, attempt.base) || !Array.isArray(body) || body.length > 200) { attempt.token = null; emit(id, { ...state, issue: "contract" }); return; }
        let candidates: unknown[];
        try { candidates = body.filter(row => row !== null && typeof row === "object" && Reflect.get(row, "id") === attempt.base.id); } catch { attempt.token = null; emit(id, { ...state, issue: "contract" }); return; }
        const receipt = candidates.length === 1 ? readReceipt(candidates[0], attempt.base) : null;
        if (!receipt) { attempt.token = null; emit(id, { ...state, observationMissing: true, issue: candidates.length ? "contract" : undefined }); return; }
        attempt.token = null; emit(id, { ...state, phase: "observed", receipt, issue: undefined });
      } catch (error) { if (!active || attempts.get(id) !== attempt || attempt.token !== token) return; attempt.token = null; emit(id, { ...state, issue: errorIssue(error) ?? "network" }); }
    },
    acceptObserved(workflow: OrderWorkflowResponse) {
      const id = workflow.orderId, state = stateFor(id), attempt = attempts.get(id); if (!canAcceptObserved(workflow) || !state.receipt) return false;
      if (state.unresolved && attempt) uncertainHistory.set(id, Object.freeze([...(uncertainHistory.get(id) ?? []), attempt]));
      start(id, state.receipt, state.previousOutcomeUnknown || state.unresolved); return true;
    },
    cancel(id: string) { const state = stateFor(id); if (!active || state.phase !== "editing" && state.phase !== "prepared") return false; attempts.delete(id); emit(id, { ...idle, base: state.base, receipt: state.base, phase: "result", previousOutcomeUnknown: state.previousOutcomeUnknown }); return true; },
    denyAll: clear, activate() { active = true; }, dispose() { clear(); listeners.clear(); },
  };
}
export type BuyerReviewUpdates = ReturnType<typeof createBuyerReviewUpdates>;
