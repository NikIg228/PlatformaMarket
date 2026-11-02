import { z } from "zod";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema, supplierOrderItemResponseSchema, shipmentResponseSchema, shipmentItemResponseSchema } from "../../../packages/schemas/src/core-api";
import { workspaceOrderStatusSchema } from "../../../packages/schemas/src/workspace-reads";
import { compareReceiptCounts } from "./shipment-receipt-draft";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

const shape = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === "REQUEST_RETURN")?.shape;
if (!shape || !("kind" in shape) || !("reason" in shape) || !("items" in shape) || !shape.kind.safeParse("GOODS").success) throw new Error("Existing goods-return fields missing");
// Actual field validators only. Never add action/version/idempotency or expose output.
const fields = z.object({ kind: shape.kind, reason: shape.reason, items: shape.items });
const root = orderWorkflowResponseSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true }).strip().extend({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, status: true, paymentStatus: true }).strip() });
const bindings = z.object({ items: z.array(supplierOrderItemResponseSchema.pick({ id: true, supplierOrderId: true }).strip()), shipments: z.array(shipmentResponseSchema.pick({ id: true, supplierOrderId: true }).strip().extend({ items: z.array(shipmentItemResponseSchema.pick({ id: true, shipmentId: true, supplierOrderItemId: true }).strip()) })).optional() });
function boundToOrder(data: z.infer<typeof bindings>, orderId: string) {
  const itemIds = new Set(data.items.map(item => item.id)), shipments = data.shipments ?? [], lines = shipments.flatMap(shipment => shipment.items);
  return itemIds.size === data.items.length && data.items.every(item => item.supplierOrderId === orderId) && new Set(shipments.map(shipment => shipment.id)).size === shipments.length && new Set(lines.map(item => item.id)).size === lines.length && shipments.every(shipment => shipment.supplierOrderId === orderId && shipment.items.every(item => item.shipmentId === shipment.id && itemIds.has(item.supplierOrderItemId)));
}
const source = z.object({ items: z.array(supplierOrderItemResponseSchema.pick({ id: true, supplierOrderId: true, quantity: true, acceptedQuantity: true }).strip()), shipments: z.array(shipmentResponseSchema.pick({ id: true, supplierOrderId: true, version: true, status: true, dispatchedAt: true }).strip().extend({ items: z.array(shipmentItemResponseSchema.pick({ id: true, shipmentId: true, supplierOrderItemId: true }).strip()) })).optional() });
type Dispatch = Readonly<{ id: string; version: number; status: string; dispatchedAt: string }>;
export type GoodsReturnTarget = Readonly<{ orderId: string; orderVersion: number; orderStatus: string; buyerOrganizationId: string; orderNumber: string; itemId: string; lineNumber: number; quantity: string; acceptedQuantity: string; dispatches: readonly Dispatch[] }>;
export type GoodsReturnField = "reason" | "quantityText" | "condition";
export type GoodsReturnIssue = Readonly<{ kind: "minimum" | "maximum"; count: string } | { kind: "format" | "positive" }>;
export type GoodsReturnErrors = Readonly<Partial<Record<GoodsReturnField | "form", GoodsReturnIssue>>>;
export type GoodsReturnEntry = Readonly<{ target: GoodsReturnTarget; kind: "GOODS"; available: boolean; started: boolean; reason: string; quantityText: string; condition: string; checked: boolean; reviewing: boolean; errors: GoodsReturnErrors; discarded: boolean }>;
export function checkGoodsReturnFields(itemId: string, reason: string, quantityText: string, condition: string): GoodsReturnErrors {
  const parsed = fields.safeParse({ kind: "GOODS", reason, items: [{ orderItemId: itemId, quantity: quantityText.trim().replace(",", "."), condition }] }); if (parsed.success) return Object.freeze({});
  const errors: Partial<Record<GoodsReturnField | "form", GoodsReturnIssue>> = {};
  for (const issue of parsed.error.issues) {
    const name = issue.path[0] === "reason" ? "reason" : issue.path[0] === "items" && issue.path[2] === "quantity" ? "quantityText" : issue.path[0] === "items" && issue.path[2] === "condition" ? "condition" : "form";
    if (!errors[name]) errors[name] = Object.freeze(issue.code === "too_small" ? { kind: "minimum", count: String(issue.minimum) } : issue.code === "too_big" ? { kind: "maximum", count: String(issue.maximum) } : name === "quantityText" ? { kind: "positive" } : { kind: "format" });
  }
  return Object.freeze(errors);
}
const key = (target: Pick<GoodsReturnTarget, "orderId" | "itemId">) => `${target.orderId}/${target.itemId}`;
const same = (a: GoodsReturnTarget, b: GoodsReturnTarget) => JSON.stringify(a) === JSON.stringify(b);
export function createGoodsReturnDrafts(scope: ReadScope) {
  const organizationId = scope.organizationId; let active = true, lastBody: unknown = null, itemTargets = new WeakMap<object, GoodsReturnTarget>(), activeTargets = new WeakSet<GoodsReturnTarget>(), targetRefs = new WeakMap<GoodsReturnTarget, object>();
  let snapshot: Readonly<{ entries: Readonly<Record<string, GoodsReturnEntry>> }> = Object.freeze({ entries: Object.freeze({}) }); const listeners = new Set<() => void>();
  const emit = (entries: Readonly<Record<string, GoodsReturnEntry>>) => { snapshot = Object.freeze({ entries: Object.freeze(entries) }); listeners.forEach(listener => listener()); };
  const put = (entry: GoodsReturnEntry) => emit({ ...snapshot.entries, [key(entry.target)]: Object.freeze(entry) });
  const blank = (target: GoodsReturnTarget, available: boolean, discarded: boolean): GoodsReturnEntry => ({ target: Object.freeze({ ...target }), kind: "GOODS", available, discarded, started: false, reason: "", quantityText: "", condition: "", checked: false, reviewing: false, errors: Object.freeze({}) });
  const current = (target: GoodsReturnTarget) => { const entry = snapshot.entries[key(target)]; return active && activeTargets.has(target) && entry?.available && entry.target === target ? entry : null; };
  const sourceMatches = (body: unknown, target: GoodsReturnTarget) => { const ids = root.safeParse(body); return body === lastBody && ids.success && ids.data.orderId === target.orderId && ids.data.order.id === target.orderId && ids.data.version === target.orderVersion && ids.data.order.version === target.orderVersion && ids.data.status === target.orderStatus && ids.data.order.status === target.orderStatus && ids.data.paymentStatus === "PAID" && ids.data.order.paymentStatus === "PAID" && ids.data.order.buyerOrganizationId === organizationId; };
  const pause = () => { if (lastBody !== null) { lastBody = null; itemTargets = new WeakMap(); activeTargets = new WeakSet(); targetRefs = new WeakMap(); emit(snapshot.entries); } };
  const invalidate = (orderId: string) => { const entries = { ...snapshot.entries }; let changed = false; for (const [id, entry] of Object.entries(entries)) if (entry.target.orderId === orderId && (entry.available || entry.started)) { entries[id] = Object.freeze(blank(entry.target, false, entry.started || entry.discarded)); changed = true; } if (changed) emit(entries); };
  const check = (target: GoodsReturnTarget) => { const entry = current(target); if (!entry?.started) return false; const errors = checkGoodsReturnFields(target.itemId, entry.reason, entry.quantityText, entry.condition); put({ ...entry, checked: true, reviewing: false, errors }); return !Object.keys(errors).length; };
  return {
    getSnapshot: () => snapshot, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, activate() { active = true; }, pause, invalidate,
    clear() { pause(); if (Object.keys(snapshot.entries).length) emit({}); }, close() { active = false; pause(); if (Object.keys(snapshot.entries).length) emit({}); },
    syncWorkflow(body: unknown) {
      if (!active) return; const ids = root.safeParse(body); if (!ids.success) return; const w = ids.data;
      if (Object.values(snapshot.entries).some(entry => entry.target.orderId === w.orderId && entry.target.orderVersion > w.version)) { pause(); return; } pause();
      if (w.orderId !== w.order.id || w.version !== w.order.version || w.order.buyerOrganizationId !== organizationId || w.status !== w.order.status || w.paymentStatus !== "PAID" || w.order.paymentStatus !== "PAID" || !workspaceOrderStatusSchema.safeParse(w.status).success || ["CANCELLED", "REJECTED", "RETURN_DISPUTE"].includes(w.status)) { invalidate(w.orderId); return; }
      const raw = body as { order: { items: object[] } }, associated = bindings.safeParse(raw.order); if (!associated.success || !boundToOrder(associated.data, w.orderId)) { invalidate(w.orderId); return; }
      const parsed = source.safeParse(raw.order); if (!parsed.success) { invalidate(w.orderId); return; }
      const shipments = parsed.data.shipments ?? [];
      if (!boundToOrder(parsed.data, w.orderId)) { invalidate(w.orderId); return; }
      const label = supplierOrderResponseSchema.pick({ orderNumber: true }).strip().safeParse(raw.order); if (!label.success) { invalidate(w.orderId); return; }
      const entries = { ...snapshot.entries }, supplied = new Set<string>(); lastBody = body;
      for (const [index, item] of parsed.data.items.entries()) {
        if (item.acceptedQuantity === null || compareReceiptCounts(item.acceptedQuantity, "0") !== 1) continue;
        const dispatches = shipments.filter(shipment => shipment.status !== "CANCELLED" && shipment.dispatchedAt !== null && shipment.items.some(line => line.supplierOrderItemId === item.id)).map(shipment => Object.freeze({ id: shipment.id, version: shipment.version, status: shipment.status, dispatchedAt: shipment.dispatchedAt! })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        if (!dispatches.length) continue;
        const target: GoodsReturnTarget = Object.freeze({ orderId: w.orderId, orderVersion: w.version, orderStatus: w.status, buyerOrganizationId: organizationId, orderNumber: label.data.orderNumber, itemId: item.id, lineNumber: index + 1, quantity: item.quantity, acceptedQuantity: item.acceptedQuantity, dispatches: Object.freeze(dispatches) });
        const id = key(target), previous = entries[id]; supplied.add(id);
        if (previous?.target.orderVersion === target.orderVersion && dispatches.some(next => (previous.target.dispatches.find(old => old.id === next.id)?.version ?? next.version) > next.version)) continue;
        const entry = previous?.available && same(previous.target, target) ? previous : Object.freeze(blank(target, true, previous?.started === true || previous?.discarded === true)); entries[id] = entry; itemTargets.set(raw.order.items[index]!, entry.target); activeTargets.add(entry.target); targetRefs.set(entry.target, raw.order.items[index]!);
      }
      for (const [id, entry] of Object.entries(entries)) if (entry.target.orderId === w.orderId && !supplied.has(id) && (entry.available || entry.started)) entries[id] = Object.freeze(blank(entry.target, false, entry.started || entry.discarded)); emit(entries);
    },
    entryForItem(body: unknown, item: { id: string; supplierOrderId: string; quantity: string; acceptedQuantity: string | null }): GoodsReturnEntry | null { const target = itemTargets.get(item); return target && sourceMatches(body, target) && item.id === target.itemId && item.supplierOrderId === target.orderId && item.quantity === target.quantity && item.acceptedQuantity === target.acceptedQuantity ? current(target) : null; },
    entryForTarget: current, sourceMatches,
    begin(body: unknown, item: { id: string; supplierOrderId: string; quantity: string; acceptedQuantity: string | null }): GoodsReturnTarget | null { const entry = this.entryForItem(body, item); if (!entry) return null; if (!entry.started) put({ ...entry, started: true }); return entry.target; },
    change(target: GoodsReturnTarget, field: GoodsReturnField, text: string) { const entry = current(target); if (!entry?.started || !["reason", "quantityText", "condition"].includes(field) || typeof text !== "string") return false; put({ ...entry, [field]: text, checked: false, reviewing: false, errors: Object.freeze({}) }); return true; }, check,
    review(target: GoodsReturnTarget) { if (!check(target)) return false; put({ ...current(target)!, reviewing: true }); return true; }, edit(target: GoodsReturnTarget) { const entry = current(target); if (entry?.started) put({ ...entry, reviewing: false }); },
    cancel(target: GoodsReturnTarget) { const entry = current(target), item = targetRefs.get(target); if (!entry || !item) return; const next = Object.freeze(blank(target, true, false)); activeTargets.delete(target); activeTargets.add(next.target); itemTargets.set(item, next.target); targetRefs.set(next.target, item); put(next); },
  };
}
export type GoodsReturnDrafts = ReturnType<typeof createGoodsReturnDrafts>;
