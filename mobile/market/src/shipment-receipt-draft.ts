import { z } from "zod";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { shipmentResponseSchema, shipmentItemResponseSchema, supplierOrderResponseSchema, type ShipmentResponse } from "../../../packages/schemas/src/core-api";
import { workspaceOrderStatusSchema } from "../../../packages/schemas/src/workspace-reads";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

const shape = orderWorkflowCommandSchema.options.find(option => option.shape.action.value === "RECEIVE_SHIPMENT")?.shape;
if (!shape || !("shipmentId" in shape) || !("items" in shape)) throw new Error("Existing receipt fields missing");
const field = shape.items.element.shape.deliveredQuantity;
const root = orderWorkflowResponseSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true }).strip().extend({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, status: true, paymentStatus: true }).strip() });
const rows = z.object({ items: z.array(supplierOrderResponseSchema.shape.items.element.pick({ id: true }).strip()), shipments: z.array(shipmentResponseSchema.pick({ id: true, supplierOrderId: true, version: true, status: true }).strip().extend({ items: z.array(shipmentItemResponseSchema.pick({ id: true, shipmentId: true, supplierOrderItemId: true, quantity: true, deliveredQuantity: true, resupplyQuantity: true }).strip()) })).optional() });
export type ReceiptTarget = Readonly<{ orderId: string; orderVersion: number; orderStatus: string; buyerOrganizationId: string; shipmentId: string; shipmentVersion: number; shipmentStatus: string; shipmentNumber: string; itemId: string; orderItemId: string; lineNumber: number; quantity: string; deliveredQuantity: string; resupplyQuantity: string }>;
export type ReceiptIssue = { kind: "format" | "below" | "above" };
export type ReceiptEntry = Readonly<{ target: ReceiptTarget; available: boolean; started: boolean; text: string; checked: boolean; reviewing: boolean; issue: ReceiptIssue | null; discarded: boolean }>;
/** Exact nonnegative decimal comparison, with no Number conversion or arithmetic. */
export function compareReceiptCounts(a: string, b: string): -1 | 0 | 1 | null {
  if (!/^\d+(?:\.\d+)?$/.test(a) || !/^\d+(?:\.\d+)?$/.test(b)) return null;
  const [ai = "", af = ""] = a.split("."), [bi = "", bf = ""] = b.split("."), x = ai.replace(/^0+(?=\d)/, ""), y = bi.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length < y.length ? -1 : 1;
  if (x !== y) return x < y ? -1 : 1;
  const width = Math.max(af.length, bf.length), xf = af.padEnd(width, "0"), yf = bf.padEnd(width, "0"); return xf === yf ? 0 : xf < yf ? -1 : 1;
}
export function checkReceiptText(text: string, source: Pick<ReceiptTarget, "quantity" | "deliveredQuantity">): ReceiptIssue | null {
  const normalized = text.trim().replace(",", "."); if (!field.safeParse(normalized).success) return { kind: "format" };
  const lower = compareReceiptCounts(normalized, source.deliveredQuantity), upper = compareReceiptCounts(normalized, source.quantity);
  return lower === null || upper === null ? { kind: "format" } : lower < 0 ? { kind: "below" } : upper > 0 ? { kind: "above" } : null;
}
const same = (a: ReceiptTarget, b: ReceiptTarget) => (Object.keys(a) as (keyof ReceiptTarget)[]).every(key => a[key] === b[key]);
const key = (target: Pick<ReceiptTarget, "orderId" | "itemId">) => `${target.orderId}/${target.itemId}`;
export function createShipmentReceiptDrafts(scope: ReadScope) {
  const bulkReviewedTargets = new WeakSet<ReceiptTarget>();
  const organizationId = scope.organizationId; let active = true, lastBody: unknown = null, lineTargets = new WeakMap<object, ReceiptTarget>(), shipIds = new WeakMap<object, string>(), activeTargets = new WeakSet<ReceiptTarget>(), targetRefs = new WeakMap<ReceiptTarget, { shipment: ShipmentResponse; item: ShipmentResponse["items"][number] }>();
  let snapshot: Readonly<{ entries: Readonly<Record<string, ReceiptEntry>> }> = Object.freeze({ entries: Object.freeze({}) }); const listeners = new Set<() => void>();
  const emit = (entries: Readonly<Record<string, ReceiptEntry>>) => { snapshot = Object.freeze({ entries: Object.freeze(entries) }); listeners.forEach(listener => listener()); };
  const put = (entry: ReceiptEntry) => emit({ ...snapshot.entries, [key(entry.target)]: Object.freeze(entry) });
  const blank = (target: ReceiptTarget, available: boolean, discarded: boolean): ReceiptEntry => ({ target: Object.freeze({ ...target }), available, discarded, started: false, text: target.deliveredQuantity, checked: false, reviewing: false, issue: null });
  const current = (target: ReceiptTarget) => { const entry = snapshot.entries[key(target)]; return active && activeTargets.has(target) && entry?.available && entry.target === target ? entry : null; };
  const sourceMatches = (body: unknown, target: ReceiptTarget) => { const ids = root.safeParse(body); return body === lastBody && ids.success && ids.data.orderId === target.orderId && ids.data.order.id === target.orderId && ids.data.version === target.orderVersion && ids.data.order.version === target.orderVersion && ids.data.status === target.orderStatus && ids.data.order.status === target.orderStatus && ids.data.paymentStatus === "PAID" && ids.data.order.paymentStatus === "PAID" && ids.data.order.buyerOrganizationId === organizationId; };
  const pause = () => { if (lastBody !== null) { lastBody = null; lineTargets = new WeakMap(); shipIds = new WeakMap(); activeTargets = new WeakSet(); targetRefs = new WeakMap(); emit(snapshot.entries); } };
  const invalidate = (orderId: string) => { const entries = { ...snapshot.entries }; let changed = false; for (const [id, entry] of Object.entries(entries)) if (entry.target.orderId === orderId && (entry.available || entry.started)) { entries[id] = Object.freeze(blank(entry.target, false, entry.started || entry.discarded)); changed = true; } if (changed) emit(entries); };
  const check = (target: ReceiptTarget) => { const entry = current(target); if (!entry?.started) return false; bulkReviewedTargets.delete(target); const issue = checkReceiptText(entry.text, target); put({ ...entry, checked: true, reviewing: false, issue }); return issue === null; };
  return {
    getSnapshot: () => snapshot, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, activate() { active = true; }, pause, invalidate,
    clear() { pause(); if (Object.keys(snapshot.entries).length) emit({}); }, close() { active = false; pause(); if (Object.keys(snapshot.entries).length) emit({}); },
    syncWorkflow(body: unknown) {
      if (!active) return; const sameFrame = lastBody === body; const ids = root.safeParse(body); if (!ids.success) return; const w = ids.data;
      const older = Object.values(snapshot.entries).some(entry => entry.target.orderId === w.orderId && entry.target.orderVersion > w.version); if (older) { pause(); return; }
      pause();
      if (w.orderId !== w.order.id || w.version !== w.order.version || w.order.buyerOrganizationId !== organizationId || w.status !== w.order.status || w.paymentStatus !== "PAID" || w.order.paymentStatus !== "PAID" || !workspaceOrderStatusSchema.safeParse(w.status).success || ["CANCELLED", "REJECTED", "RETURN_DISPUTE"].includes(w.status)) { invalidate(w.orderId); return; }
      const parsed = rows.safeParse((body as { order: unknown }).order); if (!parsed.success) { invalidate(w.orderId); return; }
      const itemIds = new Set(parsed.data.items.map(item => item.id)), shipments = parsed.data.shipments ?? [];
      if (itemIds.size !== parsed.data.items.length || new Set(shipments.map(s => s.id)).size !== shipments.length || shipments.some(s => s.supplierOrderId !== w.orderId || new Set(s.items.map(i => i.id)).size !== s.items.length || s.items.some(i => i.shipmentId !== s.id || !itemIds.has(i.supplierOrderItemId)))) { invalidate(w.orderId); return; }
      const raw = body as { order: { shipments?: ShipmentResponse[] } }, entries = { ...snapshot.entries }, supplied = new Set<string>(); lastBody = body;
      for (const [sIndex, shipment] of shipments.entries()) {
        if (!["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(shipment.status)) continue;
        const original = raw.order.shipments![sIndex]!;
        for (const [index, item] of shipment.items.entries()) {
          // Missing resupply is UNKNOWN, never an implicit zero/permission.
          const ordered = compareReceiptCounts(item.quantity, item.deliveredQuantity);
          if (item.resupplyQuantity === undefined || compareReceiptCounts(item.resupplyQuantity, "0") !== 0 || compareReceiptCounts(item.deliveredQuantity, "0") === null || ordered === null || ordered < 0) continue;
          const name = shipmentResponseSchema.shape.shipmentNumber.safeParse(original.shipmentNumber); if (!name.success) continue;
          const target: ReceiptTarget = Object.freeze({ orderId: w.orderId, orderVersion: w.version, orderStatus: w.status, buyerOrganizationId: organizationId, shipmentId: shipment.id, shipmentVersion: shipment.version, shipmentStatus: shipment.status, shipmentNumber: name.data, itemId: item.id, orderItemId: item.supplierOrderItemId, lineNumber: index + 1, quantity: item.quantity, deliveredQuantity: item.deliveredQuantity, resupplyQuantity: item.resupplyQuantity });
          const id = key(target), previous = entries[id]; supplied.add(id);
          if (previous && previous.target.orderVersion === target.orderVersion && previous.target.shipmentVersion > target.shipmentVersion) continue;
          const reusable = previous?.available && same(previous.target, target);
          const entry = reusable ? !sameFrame && bulkReviewedTargets.has(previous.target) ? Object.freeze({ ...previous, reviewing: false }) : previous : Object.freeze(blank(target, true, previous?.started === true || previous?.discarded === true));
          if (!sameFrame && previous) bulkReviewedTargets.delete(previous.target); entries[id] = entry;
          lineTargets.set(original.items[index]!, entry.target); shipIds.set(original, shipment.id); activeTargets.add(entry.target); targetRefs.set(entry.target, { shipment: original, item: original.items[index]! });
        }
      }
      for (const [id, entry] of Object.entries(entries)) if (entry.target.orderId === w.orderId && !supplied.has(id) && (entry.available || entry.started)) entries[id] = Object.freeze(blank(entry.target, false, entry.started || entry.discarded));
      emit(entries);
    },
    beginMany(body:unknown,shipment:ShipmentResponse):readonly ReceiptTarget[]|null {
      const candidates=shipment.items.map(item=>this.entryForLine(body,shipment,item));if(!candidates.length||candidates.some(entry=>entry===null))return null;const entries=candidates as ReceiptEntry[],next={...snapshot.entries};
      for(const entry of entries)if(!entry.started)next[key(entry.target)]=Object.freeze({...entry,started:true});emit(next);return Object.freeze(entries.map(entry=>entry.target));
    },
    reviewMany(targets:readonly ReceiptTarget[]):boolean {
      const first=targets[0],refs=first?targetRefs.get(first):undefined;if(!refs||targets.length!==refs.shipment.items.length||new Set(targets.map(target=>target.itemId)).size!==targets.length)return false;
      const entries=targets.map(target=>{const ref=targetRefs.get(target);return ref&&ref.shipment===refs.shipment&&this.entryForLine(lastBody,ref.shipment,ref.item)?.target===target?current(target):null;});if(entries.some(entry=>!entry?.started))return false;
      const values=entries as ReceiptEntry[],issues=values.map(entry=>checkReceiptText(entry.text,entry.target)),valid=issues.every(issue=>issue===null),next={...snapshot.entries};values.forEach((entry,index)=>{if(valid)bulkReviewedTargets.add(entry.target);else bulkReviewedTargets.delete(entry.target);next[key(entry.target)]=Object.freeze({...entry,checked:true,reviewing:valid,issue:issues[index]!});});emit(next);return valid;
    },
    editMany(targets:readonly ReceiptTarget[]):void {const entries=targets.map(current);if(entries.some(entry=>!entry?.started))return;const next={...snapshot.entries};for(const entry of entries as ReceiptEntry[]){bulkReviewedTargets.delete(entry.target);next[key(entry.target)]=Object.freeze({...entry,reviewing:false});}emit(next);},
    entryForLine(body: unknown, shipment: ShipmentResponse, item: ShipmentResponse["items"][number]): ReceiptEntry | null { const target = lineTargets.get(item); return target && sourceMatches(body, target) && shipIds.get(shipment) === target.shipmentId && shipment.version === target.shipmentVersion && shipment.status === target.shipmentStatus && item.quantity === target.quantity && item.deliveredQuantity === target.deliveredQuantity && item.resupplyQuantity === target.resupplyQuantity ? current(target) : null; },
    entryForTarget: current, sourceMatches,
    begin(body: unknown, shipment: ShipmentResponse, item: ShipmentResponse["items"][number]): ReceiptTarget | null { const entry = this.entryForLine(body, shipment, item); if (!entry) return null; if (!entry.started) put({ ...entry, started: true }); return entry.target; },
    change(target: ReceiptTarget, text: string) { const entry = current(target); if (!entry?.started || typeof text !== "string") return false; bulkReviewedTargets.delete(target); put({ ...entry, text, checked: false, reviewing: false, issue: null }); return true; }, check,
    review(target: ReceiptTarget) { if (!check(target)) return false; put({ ...current(target)!, reviewing: true }); return true; }, edit(target: ReceiptTarget) { const entry = current(target); if (entry?.started) { bulkReviewedTargets.delete(target); put({ ...entry, reviewing: false }); } },
    cancel(target: ReceiptTarget) { const entry = current(target), refs = targetRefs.get(target); if (!entry || !refs) return; const next = Object.freeze(blank(target, true, false)); activeTargets.delete(target); activeTargets.add(next.target); targetRefs.set(next.target, refs); lineTargets.set(refs.item, next.target); put(next); },
  };
}
export type ShipmentReceiptDrafts = ReturnType<typeof createShipmentReceiptDrafts>;
