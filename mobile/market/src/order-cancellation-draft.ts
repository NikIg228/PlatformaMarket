import { z } from "zod";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

const commandShape = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === "CANCEL")?.shape;
if (!commandShape || !("transferNotMade" in commandShape)) throw new Error("Existing CANCEL field schema missing");
// Only actual form fields. No action/version/idempotency key or command payload.
const fields = z.object({ reason: commandShape.reason, transferNotMade: commandShape.transferNotMade });
const identity = orderWorkflowResponseSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true }).strip().extend({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, status: true, paymentStatus: true }).strip() });
const label = supplierOrderResponseSchema.pick({ orderNumber: true }).strip();
export type CancellationTarget = Readonly<{ orderId: string; buyerOrganizationId: string; version: number; status: string; paymentStatus: string; orderNumber: string }>;
export type CancellationErrors = Readonly<{ reason?: { kind: "minimum" | "maximum"; count: string } | { kind: "format" }; transferNotMade?: { kind: "confirmation" } }>;
export type CancellationEntry = Readonly<{ target: CancellationTarget; available: boolean; started: boolean; reason: string; transferNotMade: boolean; checked: boolean; reviewing: boolean; errors: CancellationErrors; discarded: boolean }>;
export function checkCancellationFields(reason: string, transferNotMade: boolean): CancellationErrors {
  const parsed = fields.safeParse({ reason, transferNotMade }); if (parsed.success) return Object.freeze({});
  const errors: { reason?: CancellationErrors["reason"]; transferNotMade?: { kind: "confirmation" } } = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === "transferNotMade") errors.transferNotMade = { kind: "confirmation" };
    else if (issue.path[0] === "reason" && !errors.reason) errors.reason = issue.code === "too_small" ? { kind: "minimum", count: String(issue.minimum) } : issue.code === "too_big" ? { kind: "maximum", count: String(issue.maximum) } : { kind: "format" };
  }
  return Object.freeze(errors);
}
function context(body: unknown, organizationId: string): CancellationTarget | null {
  const parsed = identity.safeParse(body); if (!parsed.success) return null; const w = parsed.data;
  if (w.orderId !== w.order.id || w.version !== w.order.version || w.status !== w.order.status || w.paymentStatus !== w.order.paymentStatus || w.order.buyerOrganizationId !== organizationId) return null;
  // This is a source-known subset for LOCAL PREPARATION, not eligibility. The
  // GET omits paymentAllocation/reservations; server permission/guards stay open.
  if (w.paymentStatus !== "UNPAID" || !["AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT"].includes(w.status)) return null;
  const name = label.safeParse((body as { order: unknown }).order); if (!name.success) return null;
  return Object.freeze({ orderId: w.orderId, buyerOrganizationId: organizationId, version: w.version, status: w.status, paymentStatus: w.paymentStatus, orderNumber: name.data.orderNumber });
}
const matches = (a: CancellationTarget, b: CancellationTarget) => (Object.keys(a) as (keyof CancellationTarget)[]).every(key => a[key] === b[key]);
export function createOrderCancellationDrafts(scope: ReadScope) {
  const organizationId = scope.organizationId; let active = true, snapshot: Readonly<{ entries: Readonly<Record<string, CancellationEntry>> }> = Object.freeze({ entries: Object.freeze({}) });
  const listeners = new Set<() => void>();
  const emit = (entries: Readonly<Record<string, CancellationEntry>>) => { snapshot = Object.freeze({ entries: Object.freeze(entries) }); listeners.forEach(listener => listener()); };
  const put = (entry: CancellationEntry) => emit({ ...snapshot.entries, [entry.target.orderId]: Object.freeze(entry) });
  const blank = (target: CancellationTarget, available: boolean, discarded: boolean): CancellationEntry => ({ target: Object.freeze({ ...target }), available, discarded, started: false, reason: "", transferNotMade: false, checked: false, reviewing: false, errors: Object.freeze({}) });
  const current = (target: CancellationTarget) => { const entry = snapshot.entries[target.orderId]; return active && entry?.available && entry.target === target ? entry : null; };
  const entryFor = (body: unknown) => { const target = context(body, organizationId), entry = target && snapshot.entries[target.orderId]; return active && target && entry && matches(entry.target, target) ? entry : null; };
  const invalidate = (id: string) => { const entry = snapshot.entries[id]; if (entry && (entry.available || entry.started)) put(blank(entry.target, false, entry.started || entry.discarded)); };
  const check = (target: CancellationTarget) => { const entry = current(target); if (!entry?.started) return false; const errors = checkCancellationFields(entry.reason, entry.transferNotMade); put({ ...entry, checked: true, reviewing: false, errors }); return !Object.keys(errors).length; };
  return {
    getSnapshot: () => snapshot, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, entryFor,
    entryForTarget: (target: CancellationTarget) => current(target),
    activate() { active = true; }, clear() { if (Object.keys(snapshot.entries).length) emit({}); }, close() { active = false; if (Object.keys(snapshot.entries).length) emit({}); }, invalidate,
    syncWorkflow(body: unknown) {
      if (!active) return; const ids = identity.safeParse(body); if (!ids.success) return;
      const previous = snapshot.entries[ids.data.orderId]; if (previous && ids.data.version < previous.target.version) return;
      const target = context(body, organizationId); if (!target) { invalidate(ids.data.orderId); return; }
      if (!previous || !previous.available || !matches(previous.target, target)) put(blank(target, true, previous?.started === true || previous?.discarded === true));
    },
    begin(body: unknown): CancellationTarget | null { const entry = entryFor(body); if (!entry?.available) return null; if (!entry.started) put({ ...entry, started: true }); return entry.target; },
    setReason(target: CancellationTarget, reason: string) { const entry = current(target); if (!entry?.started || typeof reason !== "string") return false; put({ ...entry, reason, checked: false, reviewing: false, errors: Object.freeze({}) }); return true; },
    setDeclaration(target: CancellationTarget, transferNotMade: boolean) { const entry = current(target); if (!entry?.started || typeof transferNotMade !== "boolean") return false; put({ ...entry, transferNotMade, checked: false, reviewing: false, errors: Object.freeze({}) }); return true; },
    check,
    review(target: CancellationTarget) { if (!check(target)) return false; const entry = current(target)!; put({ ...entry, reviewing: true }); return true; },
    edit(target: CancellationTarget) { const entry = current(target); if (entry?.started) put({ ...entry, reviewing: false }); },
    cancel(target: CancellationTarget) { const entry = current(target); if (entry) put(blank(entry.target, true, false)); },
  };
}
export type OrderCancellationDrafts = ReturnType<typeof createOrderCancellationDrafts>;
