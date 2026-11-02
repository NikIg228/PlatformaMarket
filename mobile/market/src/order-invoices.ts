import { z } from "zod";
import { orderInvoicesResponseSchema, orderInvoiceViewSchema, type OrderInvoicesResponse, type OrderInvoiceView } from "../../../packages/schemas/src/order-invoice";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type NativeOrderInvoiceClient = { nativeOrderInvoices?: (scope: ReadScope, orderId: string) => Promise<unknown> };
export class OrderInvoiceReadError extends Error { constructor(readonly code: "scope" | "input") { super("Order invoice reading is unavailable"); this.name = "OrderInvoiceReadError"; } }
export function bindNativeOrderInvoiceReads(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean): Readonly<Required<NativeOrderInvoiceClient>> {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new OrderInvoiceReadError("scope"));
  return Object.freeze({ async nativeOrderInvoices(candidate, orderId) { lifetime.assert(candidate); const id = z.uuid().safeParse(orderId); if (!id.success) throw new OrderInvoiceReadError("input"); try { const body = await read(`/supplier-orders/${encodeURIComponent(id.data)}/invoices`); lifetime.assert(candidate); return body; } catch (error) { lifetime.assert(candidate); throw error; } } });
}
export type OrderInvoiceIssue = "authentication" | "denied" | "unavailable" | "throttled" | "contract" | "network";
export type OrderInvoiceState = Readonly<{ phase: "idle" | "loading" | "ready" | "empty" | "error"; value?: OrderInvoicesResponse; selected?: OrderInvoiceView; changed?: boolean; currentNotRepresented?: boolean; issue?: OrderInvoiceIssue }>;
const idle: OrderInvoiceState = Object.freeze({ phase: "idle" });
const rootSchema = orderInvoicesResponseSchema.pick({ orderId: true, orderVersion: true, currentDocumentId: true, canPrepare: true }).strip();
const invoiceRootSchema = orderInvoiceViewSchema.pick({ documentId: true, number: true, version: true, status: true, confirmedAt: true }).extend({ snapshot: z.object({ orderId: z.uuid(), orderNumber: z.string(), orderVersion: z.number().int().positive(), number: z.string(), version: z.number().int().positive(), currency: z.literal("KZT") }).strip() }).strip();
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function decode(body: unknown, workflow: OrderWorkflowResponse): OrderInvoicesResponse | null {
  try {
    const root = rootSchema.parse(body); if (root.orderId !== workflow.orderId || root.orderVersion < workflow.version || root.canPrepare) return null;
    const rows = z.object({ invoices: invoiceRootSchema.array() }).strip().parse(body).invoices;
    if (new Set(rows.map(row => row.documentId)).size !== rows.length || new Set(rows.map(row => row.version)).size !== rows.length || rows.some(row => !["CONFIRMED", "SUPERSEDED"].includes(row.status) || row.confirmedAt === null || row.snapshot.orderId !== workflow.orderId || row.snapshot.orderNumber !== workflow.order.orderNumber || row.snapshot.number !== row.number || row.snapshot.version !== row.version || row.snapshot.orderVersion > root.orderVersion || row.snapshot.currency !== workflow.order.currency)) return null;
    const parsed = orderInvoicesResponseSchema.parse(body);
    if ((Object.keys(root) as (keyof typeof root)[]).some(key => parsed[key] !== root[key])) return null;
    for (const [index, row] of parsed.invoices.entries()) {
      const before = rows[index]!;
      if (row.documentId !== before.documentId || row.number !== before.number || row.version !== before.version || row.status !== before.status || row.confirmedAt !== before.confirmedAt || row.snapshot.orderId !== before.snapshot.orderId || row.snapshot.orderVersion !== before.snapshot.orderVersion) return null;
      const chosen = row.snapshot.bankAccount, rawBank = ((body as OrderInvoicesResponse).invoices[index]!).snapshot.bankAccount;
      if ((Object.keys(chosen) as (keyof typeof chosen)[]).some(key => rawBank[key] !== chosen[key])) return null;
      const bank = row.snapshot.supplier.fields.bankAccounts.find(account => account.id === chosen.id);
      if (!bank || (Object.keys(chosen) as (keyof typeof chosen)[]).some(key => chosen[key] !== bank[key])) return null;
    }
    return freeze(parsed);
  } catch { return null; }
}
function issue(error: unknown): OrderInvoiceIssue {
  try { if (typeof error === "object" && error !== null && "status" in error && "payload" in error) { const parsed = errorResponseSchema.safeParse(error.payload); if (!parsed.success || parsed.data.statusCode !== error.status) return "contract"; return error.status === 401 ? "authentication" : error.status === 403 ? "denied" : error.status === 404 ? "unavailable" : error.status === 429 ? "throttled" : "network"; } } catch { return "contract"; } return "network";
}
/** Own BUYER confirmed preparation metadata only. Opening a snapshot never issues an invoice or performs payment. */
export function createOrderInvoiceReads(scope: ReadScope, port: NativeOrderInvoiceClient["nativeOrderInvoices"], currentWorkflow: (id: string) => OrderWorkflowResponse | null) {
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>(), requests = new Map<string, object>(), frames = new Map<string, OrderWorkflowResponse>();
  let active = true, snapshot: Readonly<Record<string, OrderInvoiceState>> = Object.freeze({});
  const stateFor = (id: string) => snapshot[id] ?? idle;
  const emit = (id: string, state: OrderInvoiceState) => { snapshot = Object.freeze({ ...snapshot, [id]: Object.freeze(state) }); listeners.forEach(fn => fn()); };
  const supports = (workflow: OrderWorkflowResponse) => { try { return active && typeof port === "function" && currentWorkflow(workflow.orderId) === workflow && workflow.order.id === workflow.orderId && workflow.order.version === workflow.version && workflow.order.buyerOrganizationId === owner.organizationId && workflow.order.supplierOrganizationId !== owner.organizationId; } catch { return false; } };
  const canRead = (workflow: OrderWorkflowResponse) => supports(workflow) && !requests.has(workflow.orderId);
  const viewFor = (workflow: OrderWorkflowResponse) => supports(workflow) && frames.get(workflow.orderId) === workflow ? stateFor(workflow.orderId) : undefined;
  const canSelect = (workflow: OrderWorkflowResponse, row: OrderInvoiceView) => { const state = viewFor(workflow); return !!state && !state.changed && !requests.has(workflow.orderId) && !!state.value?.invoices.includes(row); };
  return {
    stateFor, supports, canRead, viewFor, canSelect, getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async read(workflow: OrderWorkflowResponse) {
      if (!canRead(workflow)) return; const id = workflow.orderId, token = {}; requests.set(id, token); frames.set(id, workflow); emit(id, { phase: "loading" });
      try { const body = await port!(owner, id); if (!active || requests.get(id) !== token || !supports(workflow)) return;
        const value = decode(body, workflow); requests.delete(id); if (!value) { emit(id, { phase: "error", issue: "contract" }); return; }
        const changed = value.orderVersion !== workflow.version || value.currentDocumentId !== workflow.invoiceDocumentId;
        emit(id, { phase: value.invoices.length ? "ready" : "empty", value, changed, currentNotRepresented: value.currentDocumentId !== null && !value.invoices.some(row => row.documentId === value.currentDocumentId) });
      } catch (error) { if (!active || requests.get(id) !== token || !supports(workflow)) return; requests.delete(id); emit(id, { phase: "error", issue: issue(error) }); }
      finally { if (requests.get(id) === token) { requests.delete(id); if (active) { frames.delete(id); emit(id, idle); } } }
    },
    select(workflow: OrderWorkflowResponse, row: OrderInvoiceView) { if (!canSelect(workflow, row)) return false; emit(workflow.orderId, { ...stateFor(workflow.orderId), selected: row }); return true; },
    hide(workflow: OrderWorkflowResponse) { if (!supports(workflow) || requests.has(workflow.orderId)) return false; emit(workflow.orderId, { ...stateFor(workflow.orderId), selected: undefined }); return true; },
    activate() { active = true; },
    close() { active = false; requests.clear(); frames.clear(); snapshot = Object.freeze({}); listeners.forEach(fn => fn()); listeners.clear(); },
  };
}
export type OrderInvoiceReads = ReturnType<typeof createOrderInvoiceReads>;
