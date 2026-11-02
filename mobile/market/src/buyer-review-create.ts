import { z } from "zod";
import { createVerifiedReviewSchema } from "../../../packages/schemas/src/trust-commerce";
import { errorResponseSchema, supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { MarketHttpError } from "./market-transport";
import type { ReadScope } from "./read-controller";

export type BuyerReviewInput = Readonly<z.output<typeof createVerifiedReviewSchema>>;
export type ReviewDimension = keyof BuyerReviewInput["dimensions"];
export const reviewDimensions = Object.freeze(Object.keys(createVerifiedReviewSchema.shape.dimensions.shape) as ReviewDimension[]);
export const reviewEligibleStatuses = ["DELIVERED", "PARTIALLY_FULFILLED", "RETURN_DISPUTE", "REJECTED", "CANCELLED"] as const;
/** A scoped request capability. Permission is decided by the existing server guard, never by this port. */
export type BuyerReviewCommandPort = Readonly<{
  canIssueKey: (scope: ReadScope) => boolean;
  nextKey: (scope: ReadScope) => string;
  create: (scope: ReadScope, orderId: string, input: BuyerReviewInput) => Promise<unknown>;
  update?: (scope: ReadScope, reviewId: string, input: import("./buyer-review-update").BuyerReviewUpdateInput) => Promise<unknown>;
  readPublished?: (scope: ReadScope, supplierOrganizationId: string) => Promise<unknown>;
}>;
export type BuyerReviewClient = { buyerReviewCommandPort?: BuyerReviewCommandPort };
export type ReviewDraft = Readonly<{ overallRating: number | null; dimensions: Readonly<Record<ReviewDimension, number | null>>; comment: string; productVariantId: string | null }>;
export type BuyerReviewIssue = "input" | "key" | "context" | "network" | "contract" | "authentication" | "denied" | "conflict" | "throttled";

const uuid = z.uuid();
const orderIdentity = supplierOrderResponseSchema.pick({ id: true, version: true, buyerOrganizationId: true, supplierOrganizationId: true, status: true }).strip();
export const receiptIdentity = z.object({ id: uuid, supplierOrderId: uuid, reviewerOrganizationId: uuid, reviewerUserId: uuid, supplierOrganizationId: uuid, productVariantId: uuid.nullable(), targetKey: z.string(), idempotencyKey: createVerifiedReviewSchema.shape.idempotencyKey }).strip();
export const receiptSchema = receiptIdentity.extend({ overallRating: createVerifiedReviewSchema.shape.overallRating, dimensions: createVerifiedReviewSchema.shape.dimensions, comment: z.string().nullable(), status: z.enum(["PENDING", "PUBLISHED", "HIDDEN", "DISPUTED"]), editDeadline: z.iso.datetime({ offset: true }), version: z.number().int().positive(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }) });
export type BuyerReviewReceipt = Readonly<z.output<typeof receiptSchema>>;
export type BuyerReviewState = Readonly<{
  phase: "idle" | "editing" | "prepared" | "pending" | "unknown" | "rejected" | "result" | "existing";
  open: boolean; draft: ReviewDraft; unresolved: boolean; issue?: BuyerReviewIssue; input?: BuyerReviewInput; receipt?: BuyerReviewReceipt;
}>;
type Attempt = { input: BuyerReviewInput; orderId: string; orderVersion: number; supplierOrganizationId: string; source: OrderWorkflowResponse; pending: object | null; uncertain: boolean; blocked: boolean };
const blankDraft: ReviewDraft = Object.freeze({ overallRating: null, dimensions: Object.freeze(Object.fromEntries(reviewDimensions.map(key => [key, null])) as Record<ReviewDimension, null>), comment: "", productVariantId: null });
const idle: BuyerReviewState = Object.freeze({ phase: "idle", open: false, draft: blankDraft, unresolved: false });
function targetKey(input: BuyerReviewInput) { return input.productVariantId ? `PRODUCT:${input.productVariantId}` : "SUPPLIER"; }
function frozenInput(input: z.output<typeof createVerifiedReviewSchema>): BuyerReviewInput { return Object.freeze({ ...input, dimensions: Object.freeze({ ...input.dimensions }) }); }

function receiptFor(body: unknown, owner: ReadScope, attempt: Attempt): BuyerReviewReceipt | null {
  try {
    const identity = receiptIdentity.safeParse(body);
    if (!identity.success) return null;
    const root = identity.data;
    if (root.supplierOrderId !== attempt.orderId || root.reviewerOrganizationId !== owner.organizationId || root.reviewerUserId !== owner.userId || root.supplierOrganizationId !== attempt.supplierOrganizationId || root.productVariantId !== (attempt.input.productVariantId ?? null) || root.targetKey !== targetKey(attempt.input) || root.idempotencyKey !== attempt.input.idempotencyKey) return null;
    const parsed = receiptSchema.safeParse(body); if (!parsed.success) return null;
    const value = parsed.data;
    if ((Object.keys(root) as (keyof typeof root)[]).some(key => value[key] !== root[key]) || value.overallRating !== attempt.input.overallRating || value.comment !== (attempt.input.comment ?? null) || reviewDimensions.some(key => value.dimensions[key] !== attempt.input.dimensions[key])) return null;
    return Object.freeze({ ...value, dimensions: Object.freeze({ ...value.dimensions }) });
  } catch { return null; }
}
function rejection(error: unknown): BuyerReviewIssue | null {
  if (!(error instanceof MarketHttpError)) return null;
  try {
    const body = errorResponseSchema.safeParse(error.payload);
    if (!body.success || body.data.statusCode !== error.status) return null;
    return error.status === 400 ? "input" : error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 || error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : null;
  } catch { return null; }
}

/** Sequential distinct source targets; one unresolved intent per order retains its original body/key. */
export function createBuyerReviewCommands(scope: ReadScope, port: BuyerReviewCommandPort | undefined, currentWorkflow: (orderId: string) => OrderWorkflowResponse | null, updateTargetLocked: (id: string) => boolean = () => false) {
  let active = true;
  const owner = Object.freeze({ ...scope });
  const listeners = new Set<() => void>(), attempts = new Map<string, Attempt>(), issued = new Set<string>();
  const known = new Map<string, Map<string, BuyerReviewReceipt>>();
  let snapshot: Readonly<Record<string, BuyerReviewState>> = Object.freeze({});
  const stateFor = (id: string): BuyerReviewState => Object.hasOwn(snapshot, id) ? snapshot[id]! : idle;
  const emit = (id: string, value: BuyerReviewState) => { snapshot = Object.freeze({ ...snapshot, [id]: Object.freeze(value) }); listeners.forEach(listener => listener()); };
  function own(workflow: OrderWorkflowResponse, eligible: boolean) {
    try {
      if (!active || !uuid.safeParse(workflow.orderId).success || currentWorkflow(workflow.orderId) !== workflow) return null;
      const root = orderIdentity.safeParse(workflow.order);
      if (!root.success || root.data.id !== workflow.orderId || root.data.version !== workflow.version || root.data.buyerOrganizationId !== owner.organizationId || eligible && !(reviewEligibleStatuses as readonly string[]).includes(root.data.status)) return null;
      return root.data;
    } catch { return null; }
  }
  function variant(workflow: OrderWorkflowResponse, id: string | null | undefined): boolean {
    try { return id == null || uuid.safeParse(id).success && workflow.order.items.some(item => item.supplierOrderId === workflow.orderId && item.productVariantId === id); } catch { return false; }
  }
  const capability = () => { try { return active && typeof port?.create === "function" && port.canIssueKey(owner) === true; } catch { return false; } };
  function knownReceipts(workflow: OrderWorkflowResponse): readonly BuyerReviewReceipt[] { if (!own(workflow, false)) return Object.freeze([]); return Object.freeze([...(known.get(workflow.orderId)?.values() ?? [])].filter(row => row.supplierOrganizationId === workflow.order.supplierOrganizationId && variant(workflow, row.productVariantId))); }
  function remember(row: BuyerReviewReceipt): BuyerReviewReceipt | null { let rows = known.get(row.supplierOrderId); if (!rows) { rows = new Map(); known.set(row.supplierOrderId, rows); } const previous = rows.get(row.targetKey); if (previous && (previous.id !== row.id || previous.idempotencyKey !== row.idempotencyKey) || [...rows.values()].some(other => other.id === row.id && other.targetKey !== row.targetKey)) return null; if (previous && previous.version > row.version) return previous; rows.set(row.targetKey, row); return row; }
  const remainingTargets = (workflow: OrderWorkflowResponse) => [null, ...new Set(workflow.order.items.filter(item => item.supplierOrderId === workflow.orderId && uuid.safeParse(item.productVariantId).success).map(item => item.productVariantId))].filter(value => !known.get(workflow.orderId)?.has(value ? `PRODUCT:${value}` : "SUPPLIER"));
  const targetAvailable = (workflow: OrderWorkflowResponse, value: string | null) => !!own(workflow, true) && variant(workflow, value) && !known.get(workflow.orderId)?.has(value ? `PRODUCT:${value}` : "SUPPLIER");
  const canOpen = (workflow: OrderWorkflowResponse) => !!own(workflow, stateFor(workflow.orderId).phase === "idle" && !knownReceipts(workflow).length) && (stateFor(workflow.orderId).phase !== "idle" || knownReceipts(workflow).length > 0 || capability());
  const canStartAnother = (workflow: OrderWorkflowResponse) => { const state = stateFor(workflow.orderId), attempt = attempts.get(workflow.orderId); return !!own(workflow, true) && capability() && ["result", "existing"].includes(state.phase) && !!state.receipt && !state.unresolved && !attempt?.pending && !attempt?.uncertain && !attempt?.blocked && !updateTargetLocked(workflow.orderId) && remainingTargets(workflow).length > 0; };

  function canOpenExisting(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt): boolean {
    try { const root = own(workflow, false), state = stateFor(workflow.orderId), attempt = attempts.get(workflow.orderId); if (!root || updateTargetLocked(workflow.orderId) || !["idle", "result", "existing"].includes(state.phase) || attempt?.pending || attempt?.uncertain || attempt?.blocked) return false;
      const identity = receiptIdentity.safeParse(candidate); if (!identity.success) return false; const row = identity.data;
      return row.supplierOrderId === workflow.orderId && row.supplierOrganizationId === root.supplierOrganizationId && row.reviewerOrganizationId === owner.organizationId && row.reviewerUserId === owner.userId && row.targetKey === (row.productVariantId ? `PRODUCT:${row.productVariantId}` : "SUPPLIER") && variant(workflow, row.productVariantId);
    } catch { return false; }
  }
  function unknown(id: string, attempt: Attempt, issue: BuyerReviewIssue) { attempt.uncertain = true; attempt.pending = null; emit(id, { ...stateFor(id), phase: "unknown", unresolved: true, issue, input: attempt.input }); }
  async function send(id: string, attempt: Attempt) {
    if (!active || !port || attempt.pending || attempt.blocked) return;
    const pending = {}; attempt.pending = pending;
    emit(id, { ...stateFor(id), phase: "pending", issue: undefined, input: attempt.input });
    try {
      const body = await port.create(owner, id, attempt.input);
      if (!active || attempts.get(id) !== attempt || attempt.pending !== pending) return;
      const current = currentWorkflow(id);
      const context = current ? own(current, false) : null;
      if (!context || context.supplierOrganizationId !== attempt.supplierOrganizationId) { unknown(id, attempt, "context"); return; }
      const receipt = receiptFor(body, owner, attempt);
      if (!receipt) { unknown(id, attempt, "contract"); return; }
      if (!remember(receipt)) { unknown(id, attempt, "contract"); return; }
      attempt.uncertain = false; attempt.pending = null;
      emit(id, { ...stateFor(id), phase: "result", unresolved: false, issue: undefined, input: attempt.input, receipt });
    } catch (error) {
      if (!active || attempts.get(id) !== attempt || attempt.pending !== pending) return;
      const issue = rejection(error);
      if (issue === "authentication" || issue === "denied") attempt.blocked = true;
      if (!issue || attempt.uncertain) { unknown(id, attempt, issue ?? "network"); return; }
      attempt.pending = null;
      emit(id, { ...stateFor(id), phase: "rejected", unresolved: false, issue, input: attempt.input });
    } finally { if (attempt.pending === pending) attempt.pending = null; }
  }
  return {
    getSnapshot: () => snapshot, stateFor, canOpen, canOpenExisting, knownReceipts, targetAvailable, canStartAnother,
    startAnother(workflow: OrderWorkflowResponse) { if (!canStartAnother(workflow)) return false; const productVariantId = remainingTargets(workflow)[0]!; attempts.delete(workflow.orderId); emit(workflow.orderId, { ...idle, phase: "editing", open: true, draft: Object.freeze({ ...blankDraft, productVariantId }) }); return true; },
    canSelectKnown(workflow: OrderWorkflowResponse, row: BuyerReviewReceipt) { return knownReceipts(workflow).includes(row) && canOpenExisting(workflow, row); },
    selectKnown(workflow: OrderWorkflowResponse, row: BuyerReviewReceipt) { return this.canSelectKnown(workflow, row) && this.openExisting(workflow, row); },
    openExisting(workflow: OrderWorkflowResponse, candidate: BuyerReviewReceipt) { if (!canOpenExisting(workflow, candidate)) return false; const parsed = receiptSchema.safeParse(candidate); if (!parsed.success) return false; const receipt = remember(Object.freeze({ ...parsed.data, dimensions: Object.freeze({ ...parsed.data.dimensions }) })); if (!receipt) return false; attempts.delete(workflow.orderId); emit(workflow.orderId, { ...idle, phase: "existing", open: true, receipt }); return true; },
    supports(workflow: OrderWorkflowResponse) { return active && typeof port?.create === "function" && !!own(workflow, stateFor(workflow.orderId).phase === "idle" && !knownReceipts(workflow).length); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(workflow: OrderWorkflowResponse) { if (!canOpen(workflow)) return false; const state = stateFor(workflow.orderId), rows = knownReceipts(workflow); if (state.phase === "idle" && rows.length) { const receipt = rows.at(-1)!; emit(workflow.orderId, { ...idle, phase: "existing", open: true, receipt }); } else emit(workflow.orderId, { ...state, phase: state.phase === "idle" ? "editing" : state.phase, open: true }); return true; },
    isOpen: (id: string) => active && stateFor(id).open,
    hide(id: string) { const state = stateFor(id); if (!active || state.phase === "pending") return false; emit(id, { ...state, open: false }); return true; },
    setRating(id: string, field: "overallRating" | ReviewDimension, value: number) {
      const state = stateFor(id); if (!active || state.phase !== "editing" || !Number.isInteger(value) || value < 1 || value > 5 || field !== "overallRating" && !reviewDimensions.includes(field)) return false;
      const draft = field === "overallRating" ? { ...state.draft, overallRating: value } : { ...state.draft, dimensions: Object.freeze({ ...state.draft.dimensions, [field]: value }) };
      emit(id, { ...state, draft: Object.freeze(draft), issue: undefined }); return true;
    },
    setComment(id: string, comment: string) { const state = stateFor(id); if (!active || state.phase !== "editing" || typeof comment !== "string") return false; emit(id, { ...state, draft: Object.freeze({ ...state.draft, comment }), issue: undefined }); return true; },
    setTarget(workflow: OrderWorkflowResponse, productVariantId: string | null) { const state = stateFor(workflow.orderId); if (!own(workflow, true) || state.phase !== "editing" || !targetAvailable(workflow, productVariantId)) return false; emit(workflow.orderId, { ...state, draft: Object.freeze({ ...state.draft, productVariantId }), issue: undefined }); return true; },
    prepare(workflow: OrderWorkflowResponse) {
      const id = workflow.orderId, state = stateFor(id), root = own(workflow, true);
      if (!root || state.phase !== "editing" || !capability() || !targetAvailable(workflow, state.draft.productVariantId)) return false;
      const draft = createVerifiedReviewSchema.omit({ idempotencyKey: true }).strict().safeParse(state.draft);
      if (!draft.success) { emit(id, { ...state, issue: "input" }); return false; }
      let input: BuyerReviewInput;
      try { const key = port!.nextKey(owner); input = frozenInput(createVerifiedReviewSchema.strict().parse({ ...draft.data, idempotencyKey: key })); if (input.idempotencyKey !== key || issued.has(key)) throw Error("Unavailable review key"); issued.add(key); }
      catch { emit(id, { ...state, issue: "key" }); return false; }
      if (!own(workflow, true)) { emit(id, { ...state, issue: "context" }); return false; }
      attempts.set(id, { input, orderId: id, orderVersion: root.version, supplierOrganizationId: root.supplierOrganizationId, source: workflow, pending: null, uncertain: false, blocked: false });
      emit(id, { ...state, phase: "prepared", input, issue: undefined }); return true;
    },
    edit(id: string) { const state = stateFor(id), attempt = attempts.get(id); if (!active || state.phase !== "prepared" && !(state.phase === "rejected" && state.issue === "input") || attempt?.uncertain || attempt?.pending || attempt?.blocked) return false; attempts.delete(id); emit(id, { ...state, phase: "editing", input: undefined, issue: undefined }); return true; },
    canConfirm(workflow: OrderWorkflowResponse) { const id = workflow.orderId, attempt = attempts.get(id), root = own(workflow, true); return active && stateFor(id).phase === "prepared" && !!attempt && !attempt.pending && !attempt.blocked && !!root && root.version === attempt.orderVersion && root.supplierOrganizationId === attempt.supplierOrganizationId && attempt.source === workflow && variant(workflow, attempt.input.productVariantId); },
    async confirm(workflow: OrderWorkflowResponse) { if (!this.canConfirm(workflow)) return; const attempt = attempts.get(workflow.orderId); if (attempt) await send(workflow.orderId, attempt); },
    canRetry(workflow: OrderWorkflowResponse) { const id = workflow.orderId, attempt = attempts.get(id), root = own(workflow, true); return active && stateFor(id).phase === "unknown" && !!attempt?.uncertain && !attempt.pending && !attempt.blocked && !!root && root.supplierOrganizationId === attempt.supplierOrganizationId && variant(workflow, attempt.input.productVariantId); },
    async retry(workflow: OrderWorkflowResponse) { if (!this.canRetry(workflow)) return; const attempt = attempts.get(workflow.orderId); if (attempt) await send(workflow.orderId, attempt); },
    cancel(id: string) { const state = stateFor(id); if (!active || state.phase !== "editing" && state.phase !== "prepared") return false; attempts.delete(id); emit(id, idle); return true; },
    cancelRejected(id: string) { const state = stateFor(id), attempt = attempts.get(id); if (!active || state.phase !== "rejected" || !["input", "conflict", "throttled"].includes(state.issue ?? "") || state.unresolved || attempt?.uncertain || attempt?.pending || attempt?.blocked || updateTargetLocked(id)) return false; attempts.delete(id); emit(id, idle); return true; },
    denyAll() { active = false; known.clear(); attempts.clear(); issued.clear(); snapshot = Object.freeze({}); listeners.forEach(listener => listener()); },
    activate() { active = true; },
    dispose() { active = false; known.clear(); attempts.clear(); issued.clear(); snapshot = Object.freeze({}); listeners.forEach(listener => listener()); listeners.clear(); },
  };
}
export type BuyerReviewCreateCommands = ReturnType<typeof createBuyerReviewCommands>;
