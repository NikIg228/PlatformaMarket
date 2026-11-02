import { z } from "zod";
import { documentArchiveItemSchema, documentArchivePageResponseSchema, errorResponseSchema, supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema, orderWorkflowResultSchema, type OrderWorkflowResponse, type OrderWorkflowResult } from "../../../packages/schemas/src/order-workflow";
import { positiveMinorAmountSchema, nonnegativeMinorAmountSchema } from "../../../packages/schemas/src/manual-payments";
import type { NativeManualTransferPort, ManualTransferInput } from "./native-manual-transfer";
import type { BuyerWorkflowKeys } from "./order-workflow-command-fixture";
import type { ReadScope } from "./read-controller";
const docRootSchema = documentArchiveItemSchema.pick({ id: true, ownerOrganizationId: true, kind: true }).extend({ supplierOrder: documentArchiveItemSchema.shape.supplierOrder.unwrap().pick({ id: true, buyerOrganizationId: true, supplierOrganizationId: true }).strip().nullable() }).strip();
const docMetadataSchema = documentArchiveItemSchema.pick({ id: true, ownerOrganizationId: true, kind: true, source: true, status: true, immutableAt: true, amountMinor: true, currency: true, fileName: true, checksumSha256: true, documentNumber: true, title: true, version: true, updatedAt: true, supplierOrder: true, paymentIntent: true, paymentTransaction: true, refund: true }).strip();
export type TransferDocument = Readonly<z.output<typeof docMetadataSchema> & { amountMinor: string; currency: string }>;
export type TransferFields = Readonly<{ paidDate: string; paidTime: string; comment: string; declared: boolean }>;
export type TransferFieldIssue = "format" | "future" | "required" | "maximum";
export type TransferFieldErrors = Readonly<Partial<Record<keyof TransferFields, TransferFieldIssue>>>;
export type ManualTransferIssue = "authentication" | "denied" | "not-found" | "conflict" | "validation" | "contract" | "network" | "context" | "key" | "busy";
export type ProofPage = Readonly<{ items: readonly TransferDocument[]; cursor?: string; nextCursor: string | null; ids: readonly string[] }>;
export type ManualTransferState = Readonly<{ phase: "idle" | "loading" | "choosing" | "editing" | "prepared" | "key-error" | "pending" | "unknown" | "receipt" | "rejected" | "reading" | "review" | "read-error" | "observed"; raw: TransferFields; errors: TransferFieldErrors; invoice?: TransferDocument; page?: ProofPage; pageIndex?: number; proof?: TransferDocument; paidAt?: string; input?: ManualTransferInput; receipt?: OrderWorkflowResult; latest?: OrderWorkflowResponse; issue?: ManualTransferIssue; unresolved: boolean; acknowledged: boolean }>;
const fields: TransferFields = Object.freeze({ paidDate: "", paidTime: "", comment: "", declared: false });
const idle: ManualTransferState = Object.freeze({ phase: "idle", raw: fields, errors: Object.freeze({}), unresolved: false, acknowledged: false });
const allowedStatuses = new Set(["AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "PARTIALLY_FULFILLED", "DELIVERED"]);
const workflowRoot = orderWorkflowResponseSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true, invoiceDocumentId: true }).extend({ order: supplierOrderResponseSchema.pick({ id: true, version: true, buyerOrganizationId: true, supplierOrganizationId: true, status: true, paymentStatus: true, currency: true, subtotalAmountMinor: true }).strip() });
const receiptRoot = orderWorkflowResultSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true, eventId: true }).strip();
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
/** Human date/time are interpreted in the device zone; preview always displays the resulting zone/offset. */
export function parseTransferTime(paidDate: string, paidTime: string, now: number): { paidAt?: string; errors: TransferFieldErrors } {
  const date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(paidDate.trim()), time = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(paidTime.trim()), errors: Partial<Record<keyof TransferFields, TransferFieldIssue>> = {};
  if (!date) errors.paidDate = paidDate.trim() ? "format" : "required"; if (!time) errors.paidTime = paidTime.trim() ? "format" : "required";
  if (!date || !time) return { errors: Object.freeze(errors) };
  const day = Number(date[1]), month = Number(date[2]) - 1, year = Number(date[3]), hours = Number(time[1]), minutes = Number(time[2]), seconds = Number(time[3] ?? "0"), value = new Date(0);
  value.setFullYear(year, month, day); value.setHours(hours, minutes, seconds, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month || value.getDate() !== day) errors.paidDate = "format";
  if (value.getHours() !== hours || value.getMinutes() !== minutes || value.getSeconds() !== seconds || !Number.isFinite(now)) errors.paidTime = "format";
  if (!Object.keys(errors).length && value.getTime() > now + 60_000) errors.paidTime = "future";
  return Object.keys(errors).length ? { errors: Object.freeze(errors) } : { paidAt: value.toISOString(), errors: Object.freeze({}) };
}
function rejection(error: unknown): ManualTransferIssue | null {
  try { if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return null; const parsed = errorResponseSchema.safeParse(error.payload); if (!parsed.success || parsed.data.statusCode !== error.status) return null; return error.status === 400 ? "validation" : error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 ? "not-found" : error.status === 409 ? "conflict" : null; } catch { return null; }
}
function sameOrder(root: z.output<typeof docRootSchema>, workflow: OrderWorkflowResponse) { return root.supplierOrder?.id === workflow.orderId && root.supplierOrder.buyerOrganizationId === workflow.order.buyerOrganizationId && root.supplierOrder.supplierOrganizationId === workflow.order.supplierOrganizationId; }
function decodeInvoice(body: unknown, workflow: OrderWorkflowResponse): TransferDocument | null {
  try { const root = docRootSchema.parse(body); if (root.id !== workflow.invoiceDocumentId || root.ownerOrganizationId !== workflow.order.supplierOrganizationId || root.kind !== "INVOICE" || !sameOrder(root, workflow)) return null;
    const value = docMetadataSchema.parse(body); if (value.id !== root.id || value.ownerOrganizationId !== root.ownerOrganizationId || !sameOrder(value, workflow) || !["UPLOADED", "GENERATED"].includes(value.source) || !["GENERATED", "SIGNED", "AWAITING_SIGNATURE"].includes(value.status) || !value.immutableAt || value.paymentIntent || value.paymentTransaction || value.refund || value.currency !== workflow.order.currency || value.amountMinor !== workflow.order.subtotalAmountMinor || !nonnegativeMinorAmountSchema.safeParse(value.amountMinor).success) return null;
    return freeze(value as TransferDocument);
  } catch { return null; }
}
function decodeProofPage(body: unknown, workflow: OrderWorkflowResponse, cursor?: string): ProofPage | null {
  try {
    const root = documentArchivePageResponseSchema.extend({ items: docRootSchema.array().max(25) }).parse(body), ids = root.items.map(row => row.id);
    if (new Set(ids).size !== ids.length || root.items.some(row => row.kind !== "PAYMENT_PROOF" || !sameOrder(row, workflow)) || root.nextCursor !== null && (root.items.length !== 25 || root.nextCursor !== ids.at(-1) || root.nextCursor === cursor)) return null;
    const raw = (body as { items: unknown[] }).items, items: TransferDocument[] = [];
    for (const [index, binding] of root.items.entries()) {
      if (binding.ownerOrganizationId !== workflow.order.buyerOrganizationId) continue;
      const value = docMetadataSchema.parse(raw[index]); if (value.id !== binding.id || value.ownerOrganizationId !== binding.ownerOrganizationId || value.kind !== "PAYMENT_PROOF" || !sameOrder(value, workflow)) return null;
      if (value.source !== "UPLOADED" || !["GENERATED", "SIGNED", "AWAITING_SIGNATURE"].includes(value.status) || !value.immutableAt || !value.checksumSha256 || !/^[a-f0-9]{64}$/i.test(value.checksumSha256) || value.paymentIntent || value.paymentTransaction || value.refund || value.currency !== workflow.order.currency || !positiveMinorAmountSchema.safeParse(value.amountMinor).success || workflow.claims.some(claim => claim.documentId === value.id)) continue;
      items.push(freeze(value as TransferDocument));
    }
    return Object.freeze({ items: Object.freeze(items), ids: Object.freeze(ids), ...(cursor === undefined ? {} : { cursor }), nextCursor: root.nextCursor });
  } catch { return null; }
}
type Context = { source: OrderWorkflowResponse; signature: string; invoice: TransferDocument; pages: ProofPage[]; pageIndex: number };
type Review = Readonly<{ status: string; paymentStatus: string; priorEventIds: readonly string[]; source: OrderWorkflowResponse; signature: string; invoice: TransferDocument; proof: TransferDocument; paidAt: string; comment: string; raw: TransferFields }>;
type Attempt = { review: Review; input: ManualTransferInput; pending: object | null };
type Operation = { state: ManualTransferState; context: Context | null; review: Review | null; attempt: Attempt | null; sequence: number; observedSignature?: string };
/** Existing-proof factual declaration only; server owns file cleanliness, accepted grants and transfer review. */
export function createManualTransferCommands(scope: ReadScope, port: NativeManualTransferPort | undefined, currentWorkflow: (id: string) => OrderWorkflowResponse | null, reloadWorkflow: (id: string) => Promise<OrderWorkflowResponse | undefined>, keys: BuyerWorkflowKeys, otherOrderLocked: (id: string) => boolean = () => false, now: () => number = Date.now) {
  const owner = Object.freeze({ ...scope }), operations = new Map<string, Operation>(), listeners = new Set<() => void>(); let active = true, snapshot: Readonly<Record<string, ManualTransferState>> = Object.freeze({});
  const stateFor = (id: string) => snapshot[id] ?? idle;
  const opFor = (id: string) => { let op = operations.get(id); if (!op) { op = { state: idle, context: null, review: null, attempt: null, sequence: 0 }; operations.set(id, op); } return op; };
  const emit = (id: string, op: Operation, state: ManualTransferState) => { op.state = Object.freeze(state); snapshot = Object.freeze({ ...snapshot, [id]: op.state }); listeners.forEach(fn => fn()); };
  const own = (workflow: OrderWorkflowResponse, eligible = false) => {
    try { const parsed = workflowRoot.safeParse(workflow); if (!active || !parsed.success || currentWorkflow(workflow.orderId) !== workflow) return false; const value = parsed.data;
      if (value.orderId !== value.order.id || value.version !== value.order.version || value.status !== value.order.status || value.paymentStatus !== value.order.paymentStatus || value.order.buyerOrganizationId !== owner.organizationId || value.order.supplierOrganizationId === owner.organizationId) return false;
      if (!eligible) return true;
      return value.invoiceDocumentId !== null && allowedStatuses.has(value.status) && ["UNPAID", "PAID"].includes(value.paymentStatus) && workflow.order.paymentAllocation == null && workflow.reservationState?.status !== "DUE" && !(workflow.returns ?? []).some(record => !["REJECTED", "REFUND_RECEIVED"].includes(record.status));
    } catch { return false; }
  };
  const supports = (workflow: OrderWorkflowResponse) => { try { return own(workflow) && port?.available(owner) === true; } catch { return false; } };
  const signature = (workflow: OrderWorkflowResponse) => JSON.stringify([workflow.orderId, workflow.version, workflow.status, workflow.paymentStatus, workflow.invoiceDocumentId, workflow.order.buyerOrganizationId, workflow.order.supplierOrganizationId, workflow.order.currency, workflow.order.subtotalAmountMinor, workflow.claims.map(claim => claim.documentId)]);
  const contextCurrent = (workflow: OrderWorkflowResponse, context: Context | null) => !!context && context.source === workflow && own(workflow, true) && signature(workflow) === context.signature;
  const authority = () => keys.authorityIssue();
  const observeAuthority = () => keys.subscribe(() => { if (!active) return; snapshot = Object.freeze({ ...snapshot }); listeners.forEach(fn => fn()); });
  let unsubscribeAuthority = observeAuthority();
  const canLoad = (workflow: OrderWorkflowResponse) => supports(workflow) && own(workflow, true) && !authority() && !otherOrderLocked(workflow.orderId) && !["loading", "pending", "reading", "prepared", "key-error"].includes(stateFor(workflow.orderId).phase) && !stateFor(workflow.orderId).unresolved && (!stateFor(workflow.orderId).receipt || stateFor(workflow.orderId).acknowledged) && !(stateFor(workflow.orderId).phase === "rejected" && ["conflict", "not-found"].includes(stateFor(workflow.orderId).issue ?? "") && !stateFor(workflow.orderId).acknowledged);
  const uncertain = (id: string, op: Operation, problem?: ManualTransferIssue) => emit(id, op, { ...op.state, phase: "unknown", unresolved: true, acknowledged: false, issue: problem, receipt: undefined });
  const readPage = async (workflow: OrderWorkflowResponse, op: Operation, context: Context, cursor: string) => {
    const sequence = ++op.sequence; emit(workflow.orderId, op, { ...op.state, phase: "loading", issue: undefined });
    try { const body = await port!.proofs(owner, workflow.orderId, cursor); if (!active || op.sequence !== sequence || !contextCurrent(workflow, context)) return;
      const page = decodeProofPage(body, workflow, cursor); if (!page || context.pages.some(previous => previous.cursor === cursor || page.ids.some(id => previous.ids.includes(id)))) { emit(workflow.orderId, op, { ...op.state, phase: "read-error", issue: "contract" }); return; }
      context.pages.push(page); context.pageIndex++; emit(workflow.orderId, op, { ...op.state, phase: "choosing", page, pageIndex: context.pageIndex, issue: undefined });
    } catch (error) { if (active && op.sequence === sequence) emit(workflow.orderId, op, { ...op.state, phase: "read-error", issue: rejection(error) ?? "network" }); }
    finally { if (active && op.sequence === sequence && op.state.phase === "loading") emit(workflow.orderId, op, { ...op.state, phase: "read-error", issue: "context", page: undefined }); }
  };
  const canChoose = (workflow: OrderWorkflowResponse, proof: TransferDocument) => { const op = operations.get(workflow.orderId); return supports(workflow) && !!op && !authority() && op.state.phase === "choosing" && contextCurrent(workflow, op.context) && op.context!.pages[op.context!.pageIndex]!.items.includes(proof); };
  const canConfirm = (workflow: OrderWorkflowResponse) => {
    const op = operations.get(workflow.orderId), review = op?.review; try { return supports(workflow) && !authority() && !otherOrderLocked(workflow.orderId) && !!op && ["prepared", "key-error"].includes(op.state.phase) && !!review && review.source === workflow && own(workflow, true) && signature(workflow) === review.signature && Date.parse(review.paidAt) <= now() + 60_000 && port!.canIssueKey(owner); } catch { return false; }
  };
  const canReplay = (workflow: OrderWorkflowResponse) => { const op = operations.get(workflow.orderId); return supports(workflow) && !authority() && !otherOrderLocked(workflow.orderId) && !!op?.attempt && op.state.unresolved && !op.attempt.pending && !["loading", "pending", "reading"].includes(op.state.phase); };
  const send = async (workflow: OrderWorkflowResponse, op: Operation, attempt: Attempt) => {
    const id = workflow.orderId, token = {}, sequence = ++op.sequence; attempt.pending = token; emit(id, op, { ...op.state, phase: "pending", issue: undefined, acknowledged: false, latest: undefined });
    try { const body = await port!.submit(owner, id, attempt.input); if (!active || op.sequence !== sequence || op.attempt !== attempt || attempt.pending !== token) return; attempt.pending = null;
      const current = currentWorkflow(id); if (!current || !own(current)) { uncertain(id, op, "context"); return; }
      const binding = receiptRoot.safeParse(body);
      if (!binding.success || binding.data.orderId !== id || binding.data.version !== attempt.input.expectedVersion + 1 || binding.data.status !== attempt.review.status || binding.data.paymentStatus !== attempt.review.paymentStatus || attempt.review.priorEventIds.includes(binding.data.eventId)) { uncertain(id, op, "contract"); return; }
      const parsed = orderWorkflowResultSchema.safeParse(body); if (!parsed.success || parsed.data.orderId !== binding.data.orderId || parsed.data.version !== binding.data.version || parsed.data.eventId !== binding.data.eventId || parsed.data.status !== binding.data.status || parsed.data.paymentStatus !== binding.data.paymentStatus || parsed.data.cartId !== undefined || !keys.acceptEvent(id, parsed.data.eventId, attempt.input.idempotencyKey)) { uncertain(id, op, "contract"); return; }
      emit(id, op, { ...op.state, phase: "receipt", receipt: freeze(parsed.data), unresolved: false, issue: undefined });
    } catch (error) { if (!active || op.sequence !== sequence || op.attempt !== attempt) return; attempt.pending = null; const problem = rejection(error); if (!problem || op.state.unresolved) uncertain(id, op, problem ?? "network"); else emit(id, op, { ...op.state, phase: "rejected", issue: problem }); if (problem === "authentication" || problem === "denied") keys.denyAuthority(problem); }
  };
  return {
    getSnapshot: () => snapshot, stateFor, supports, canLoad, canChoose, canConfirm, canReplay, authorityIssue: authority,
    keyAvailable() { try { return active && port?.canIssueKey(owner) === true; } catch { return false; } },
    hasCurrentContext(workflow: OrderWorkflowResponse) { return contextCurrent(workflow, operations.get(workflow.orderId)?.context ?? null); },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    blocksOtherCommands(id: string) { const state = stateFor(id); return active && (!!authority() || ["prepared", "key-error", "pending", "receipt", "reading", "review"].includes(state.phase) || state.phase === "read-error" && !!operations.get(id)?.attempt || state.unresolved && !state.acknowledged); },
    async load(workflow: OrderWorkflowResponse) {
      if (!canLoad(workflow)) return; const id = workflow.orderId, op = opFor(id), sequence = ++op.sequence, sourceSignature = signature(workflow); op.context = null; op.review = null; op.attempt = null;
      const raw = op.state.receipt && op.state.acknowledged && !op.state.unresolved ? fields : op.state.raw;
      emit(id, op, { ...idle, raw, phase: "loading" });
      try { const invoiceBody = await port!.invoice(owner, workflow.invoiceDocumentId!); if (!active || op.sequence !== sequence || !own(workflow, true) || signature(workflow) !== sourceSignature) return;
        const invoice = decodeInvoice(invoiceBody, workflow); if (!invoice) { emit(id, op, { ...op.state, phase: "read-error", issue: "contract" }); return; }
        const proofBody = await port!.proofs(owner, id); if (!active || op.sequence !== sequence || !own(workflow, true) || signature(workflow) !== sourceSignature) return;
        const page = decodeProofPage(proofBody, workflow); if (!page) { emit(id, op, { ...op.state, phase: "read-error", issue: "contract" }); return; }
        op.context = { source: workflow, signature: sourceSignature, invoice, pages: [page], pageIndex: 0 }; emit(id, op, { ...op.state, phase: "choosing", invoice, page, pageIndex: 0, issue: undefined });
      } catch (error) { if (active && op.sequence === sequence) emit(id, op, { ...op.state, phase: "read-error", issue: rejection(error) ?? "network" }); }
      finally { if (active && op.sequence === sequence && op.state.phase === "loading") emit(id, op, { ...op.state, phase: "read-error", issue: "context" }); }
    },
    canNext(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); return !!op && op.state.phase === "choosing" && contextCurrent(workflow, op.context) && !!op.state.page?.nextCursor; },
    async next(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); if (!op || !this.canNext(workflow) || !op.context) return; const context = op.context, cached = context.pages[context.pageIndex + 1]; if (cached) { context.pageIndex++; emit(workflow.orderId, op, { ...op.state, page: cached, pageIndex: context.pageIndex }); } else await readPage(workflow, op, context, op.state.page!.nextCursor!); },
    canPrevious(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); return !!op && op.state.phase === "choosing" && contextCurrent(workflow, op.context) && op.context!.pageIndex > 0; },
    previous(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); if (!op?.context || !this.canPrevious(workflow)) return false; op.context.pageIndex--; emit(workflow.orderId, op, { ...op.state, page: op.context.pages[op.context.pageIndex], pageIndex: op.context.pageIndex }); return true; },
    choose(workflow: OrderWorkflowResponse, proof: TransferDocument) { const op = operations.get(workflow.orderId); if (!op || !canChoose(workflow, proof) || otherOrderLocked(workflow.orderId)) return false; op.review = null; emit(workflow.orderId, op, { ...op.state, phase: "editing", proof, errors: Object.freeze({}), raw: Object.freeze({ ...op.state.raw, declared: false }), issue: undefined }); return true; },
    change(id: string, field: "paidDate" | "paidTime" | "comment", value: string) { const op = operations.get(id); if (!active || !op || op.state.phase !== "editing" || typeof value !== "string") return false; const errors = { ...op.state.errors }; delete errors[field]; emit(id, op, { ...op.state, raw: Object.freeze({ ...op.state.raw, [field]: value }), errors: Object.freeze(errors), issue: undefined }); return true; },
    declare(id: string, value: boolean) { const op = operations.get(id); if (!active || !op || op.state.phase !== "editing" || typeof value !== "boolean") return false; const errors = { ...op.state.errors }; delete errors.declared; emit(id, op, { ...op.state, raw: Object.freeze({ ...op.state.raw, declared: value }), errors: Object.freeze(errors), issue: undefined }); return true; },
    prepare(workflow: OrderWorkflowResponse) { const id = workflow.orderId, op = operations.get(id); if (!active || !op || op.state.phase !== "editing" || !op.context || !op.state.proof) return false;
      if (!contextCurrent(workflow, op.context) || otherOrderLocked(id) || authority()) { emit(id, op, { ...op.state, issue: authority() ?? "context" }); return false; }
      const checked = parseTransferTime(op.state.raw.paidDate, op.state.raw.paidTime, now()), errors = { ...checked.errors }; if (!op.state.raw.declared) errors.declared = "required"; if (op.state.raw.comment.trim().length > 2000) errors.comment = "maximum";
      if (Object.keys(errors).length || !checked.paidAt) { emit(id, op, { ...op.state, errors: Object.freeze(errors) }); return false; }
      op.review = Object.freeze({ status: workflow.status, paymentStatus: workflow.paymentStatus, priorEventIds: Object.freeze(workflow.events.map(event => event.id)), source: workflow, signature: op.context.signature, invoice: op.context.invoice, proof: op.state.proof, paidAt: checked.paidAt, comment: op.state.raw.comment.trim(), raw: op.state.raw }); emit(id, op, { ...op.state, phase: "prepared", paidAt: checked.paidAt, errors: Object.freeze({}), issue: undefined }); return true;
    },
    edit(id: string) { const op = operations.get(id); if (!active || !op || !["prepared", "key-error", "rejected"].includes(op.state.phase) || op.state.unresolved || op.state.phase === "rejected" && op.state.issue !== "validation") return false; op.review = null; op.attempt = null; emit(id, op, { ...op.state, phase: "editing", input: undefined, issue: undefined }); return true; },
    cancel(id: string) { const op = operations.get(id); if (!active || !op || !["editing", "prepared", "key-error"].includes(op.state.phase)) return false; op.review = null; op.attempt = null; emit(id, op, { ...op.state, phase: "choosing", proof: undefined, input: undefined, errors: Object.freeze({}), raw: Object.freeze({ ...op.state.raw, declared: false }), issue: undefined }); return true; },
    async confirm(workflow: OrderWorkflowResponse) { if (!canConfirm(workflow)) return; const id = workflow.orderId, op = opFor(id), review = op.review!; let key: string; try { key = port!.nextKey(owner); } catch { emit(id, op, { ...op.state, phase: "key-error", issue: "key" }); return; }
      const input: ManualTransferInput = Object.freeze({ action: "REPORT_TRANSFER", expectedVersion: review.source.version, idempotencyKey: key, documentId: review.proof.id, invoiceDocumentId: review.invoice.id, amountMinor: review.proof.amountMinor, paidAt: review.paidAt, comment: review.comment }); const attempt: Attempt = { review, input, pending: null }; op.attempt = attempt; emit(id, op, { ...op.state, input }); await send(workflow, op, attempt);
    },
    async replay(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); if (op?.attempt && canReplay(workflow)) await send(workflow, op, op.attempt); },
    canReadCurrent(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); return supports(workflow) && !!op?.attempt && !["pending", "reading", "loading"].includes(op.state.phase) && (op.state.unresolved || !!op.state.receipt || op.state.issue === "conflict" || op.state.issue === "not-found"); },
    async readCurrent(workflow: OrderWorkflowResponse) {
      const op = operations.get(workflow.orderId); if (!op?.attempt || !this.canReadCurrent(workflow)) return; const id = workflow.orderId, sequence = ++op.sequence; emit(id, op, { ...op.state, phase: "reading", latest: undefined, issue: undefined });
      try { const latest = await reloadWorkflow(id); if (!active || op.sequence !== sequence) return;
        if (!latest || !own(latest) || latest.version < (op.state.receipt?.version ?? op.attempt.input.expectedVersion)) { emit(id, op, { ...op.state, phase: "read-error", issue: "context" }); return; }
        op.observedSignature = signature(latest); emit(id, op, { ...op.state, phase: "review", latest, acknowledged: false });
      } catch (error) { if (active && op.sequence === sequence) emit(id, op, { ...op.state, phase: "read-error", issue: rejection(error) ?? "network" }); }
    },
    canAcknowledge(workflow: OrderWorkflowResponse) { const state = stateFor(workflow.orderId); return supports(workflow) && state.phase === "review" && state.latest === workflow && operations.get(workflow.orderId)?.observedSignature === signature(workflow); },
    acknowledge(workflow: OrderWorkflowResponse) { const op = operations.get(workflow.orderId); if (!op || !this.canAcknowledge(workflow)) return false; emit(workflow.orderId, op, { ...op.state, phase: "observed", acknowledged: true }); return true; },
    activate() { if (!active) { active = true; unsubscribeAuthority = observeAuthority(); } },
    close() { active = false; unsubscribeAuthority(); for (const op of operations.values()) { op.sequence++; op.attempt = null; op.review = null; op.context = null; } operations.clear(); snapshot = Object.freeze({}); listeners.forEach(fn => fn()); listeners.clear(); },
  };
}
export type ManualTransferCommands = ReturnType<typeof createManualTransferCommands>;
