/** Read-only URL state. Never conveys identity, authority or commands. */
import { operatorOrderStatuses, operatorOrderPaymentStatuses } from "./operator-order-status";
export const adminSections = ["analytics", "overview", "organizations", "access", "catalog", "imports", "orders", "support", "security", "settings"] as const;
export const adminQueueTypes = ["ORGANIZATION_REVIEW", "PROMOTION_REVIEW", "CATALOG_REVIEW", "COMPLIANCE_REVIEW", "INTEGRATION_RECONCILIATION", "IMPORT_ATTENTION", "AGREEMENT_SIGNATURE", "SUPPLIER_CONFIRMATION", "STALE_INVENTORY", "DOCUMENT_EXCEPTION"] as const;
export type AdminSection = typeof adminSections[number];
export type AdminQueueType = typeof adminQueueTypes[number];
export type AdminQuery = {
  controlView: "audit" | "technical";
  trustView: "incidents" | "reputation"; trustIncidentOffset: number; trustSupplierOffset: number;
  auditOrganization: string; auditActor: string; auditEntityType: string; auditEntityId: string; auditAction: string; auditFrom: string; auditTo: string; auditOffset: number;
  outboxEventType: string; outboxEventId: string; outboxOffset: number;
  section: AdminSection;
  queueType?: AdminQueueType;
  object?: string;
  ticketId?: string;
  conversationId?: string;
  supportMode: "tickets" | "conversations";
  supportStatus: "" | "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
  supportQ: string;
  supportSort: "queue" | "recent";
  supportOffset: number;
  conversationFilter: "ALL" | "UNREAD" | "ORDERS";
  conversationOffset: number;
  queueKind: "ALL" | AdminQueueType;
  queueQ: string;
  queuePriority: "" | "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  queueAssignment: "ALL" | "MINE" | "UNASSIGNED" | "ASSIGNED";
  queueDue: "ALL" | "OVERDUE" | "SCHEDULED" | "UNSCHEDULED";
  queueSort: "queue" | "oldest" | "recent";
  queueOffset: number;
  orgId?: string;
  orgQ: string;
  orgStatus: "" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  orgCapability: "" | "BUYER" | "SUPPLIER" | "IMPORTER" | "LOGISTICS_PROVIDER" | "SERVICE_PROVIDER" | "MARKETPLACE_OPERATOR" | "PAYMENT_PARTNER";
  orgOffset: number;
  orderId?: string;
  orderQ: string;
  orderBuyer: string;
  orderSupplier: string;
  orderStatus: "" | typeof operatorOrderStatuses[number];
  orderPaymentStatus: "" | typeof operatorOrderPaymentStatuses[number];
  orderFrom: string;
  orderTo: string;
  orderOffset: number;
};
export const defaultAdminQuery: AdminQuery = { trustView: "incidents", trustIncidentOffset: 0, trustSupplierOffset: 0, controlView: "audit", auditOrganization: "", auditActor: "", auditEntityType: "", auditEntityId: "", auditAction: "", auditFrom: "", auditTo: "", auditOffset: 0, outboxEventType: "", outboxEventId: "", outboxOffset: 0, section: "overview", supportMode: "tickets", supportStatus: "", supportQ: "", supportSort: "queue", supportOffset: 0, conversationFilter: "ALL", conversationOffset: 0, queueKind: "ALL", queueQ: "", queuePriority: "", queueAssignment: "ALL", queueDue: "ALL", queueSort: "queue", queueOffset: 0, orgQ: "", orgStatus: "", orgCapability: "", orgOffset: 0, orderQ: "", orderBuyer: "", orderSupplier: "", orderStatus: "", orderPaymentStatus: "", orderFrom: "", orderTo: "", orderOffset: 0 };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unsafe = /[\\#\u0000-\u001f\u007f]/;

export function parseAdminQuery(search: string): AdminQuery | undefined {
  if (search.length > 4096 || unsafe.test(search)) return;
  const params = new URLSearchParams(search);
  const result = { ...defaultAdminQuery };
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1 || (!["supportQ", "orgQ", "orderQ", "orderBuyer", "orderSupplier", "queueQ"].includes(key) && unsafe.test(value))) return;
    if (key === "controlView" && ["audit", "technical"].includes(value)) result.controlView = value as AdminQuery["controlView"];
    else if (key === "trustView" && ["incidents", "reputation"].includes(value)) result.trustView = value as AdminQuery["trustView"];
    else if ((key === "auditOrganization" || key === "auditActor" || key === "outboxEventId") && uuid.test(value)) result[key] = value;
    else if ((key === "auditEntityType" || key === "auditEntityId" || key === "auditAction" || key === "outboxEventType") && value.length <= (key === "outboxEventType" ? 120 : 160) && !unsafe.test(value)) result[key] = value.trim();
    else if ((key === "auditFrom" || key === "auditTo") && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) result[key] = value;
    else if ((key === "auditOffset" || key === "outboxOffset" || key === "trustIncidentOffset" || key === "trustSupplierOffset") && /^(0|[1-9]\d{0,6})$/.test(value) && Number(value) <= 1000000 && Number(value) % 25 === 0) result[key] = Number(value);
    else if (key === "section" && adminSections.includes(value as AdminSection)) result.section = value as AdminSection;
    else if ((key === "queueType" || key === "queueKind") && adminQueueTypes.includes(value as AdminQueueType)) result[key] = value as AdminQueueType;
    else if (key === "queueKind" && value === "ALL") result.queueKind = value;
    else if (key === "queueQ" && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result.queueQ = value.trim();
    else if (key === "queuePriority" && ["CRITICAL", "HIGH", "NORMAL", "LOW"].includes(value)) result.queuePriority = value as AdminQuery["queuePriority"];
    else if (key === "queueAssignment" && ["ALL", "MINE", "UNASSIGNED", "ASSIGNED"].includes(value)) result.queueAssignment = value as AdminQuery["queueAssignment"];
    else if (key === "queueDue" && ["ALL", "OVERDUE", "SCHEDULED", "UNSCHEDULED"].includes(value)) result.queueDue = value as AdminQuery["queueDue"];
    else if (key === "queueSort" && ["queue", "oldest", "recent"].includes(value)) result.queueSort = value as AdminQuery["queueSort"];
    else if (["object", "ticketId", "conversationId"].includes(key) && uuid.test(value)) result[key as "object" | "ticketId" | "conversationId"] = value;
    else if (key === "supportMode" && (value === "tickets" || value === "conversations")) result.supportMode = value;
    else if (key === "supportStatus" && ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"].includes(value)) result.supportStatus = value as AdminQuery["supportStatus"];
    else if (key === "supportQ" && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result.supportQ = value.trim();
    else if (key === "orgQ" && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result.orgQ = value.trim();
    else if (key === "orgId" && uuid.test(value)) result.orgId = value;
    else if (key === "orderId" && uuid.test(value)) result.orderId = value;
    else if ((key === "orderQ" || key === "orderBuyer" || key === "orderSupplier") && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result[key] = value.trim();
    else if (key === "orderStatus" && operatorOrderStatuses.includes(value as AdminQuery["orderStatus"] & typeof operatorOrderStatuses[number])) result.orderStatus = value as AdminQuery["orderStatus"];
    else if (key === "orderPaymentStatus" && operatorOrderPaymentStatuses.includes(value as typeof operatorOrderPaymentStatuses[number])) result.orderPaymentStatus = value as AdminQuery["orderPaymentStatus"];
    else if ((key === "orderFrom" || key === "orderTo") && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value) result[key] = value;
    else if (key === "orderOffset" && /^(0|[1-9]\d{0,6})$/.test(value) && Number(value) <= 1000000 && Number(value) % 25 === 0) result.orderOffset = Number(value);
    else if (key === "orgStatus" && ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(value)) result.orgStatus = value as AdminQuery["orgStatus"];
    else if (key === "orgCapability" && ["BUYER", "SUPPLIER", "IMPORTER", "LOGISTICS_PROVIDER", "SERVICE_PROVIDER", "MARKETPLACE_OPERATOR", "PAYMENT_PARTNER"].includes(value)) result.orgCapability = value as AdminQuery["orgCapability"];
    else if (key === "orgOffset" && /^(0|[1-9]\d{0,6})$/.test(value) && Number(value) <= 1000000 && Number(value) % 25 === 0) result.orgOffset = Number(value);
    else if (key === "supportSort" && (value === "queue" || value === "recent")) result.supportSort = value;
    else if (key === "conversationFilter" && ["ALL", "UNREAD", "ORDERS"].includes(value)) result.conversationFilter = value as AdminQuery["conversationFilter"];
    else if (key === "conversationOffset" && /^(0|[1-9]\d{0,5})$/.test(value) && Number(value) <= 99990 && Number(value) % 30 === 0) result.conversationOffset = Number(value);
    else if ((key === "supportOffset" || key === "queueOffset") && /^(0|[1-9]\d{0,6})$/.test(value) && Number(value) <= 100000 && Number(value) % 50 === 0) result[key] = Number(value);
    else return;
  }
  if (Boolean(result.queueType) !== Boolean(result.object)) return;
  if ((result.ticketId || result.conversationId) && result.section !== "support") return;
  if (result.orgId && result.section !== "organizations") return;
  if (result.orderId && result.section !== "orders") return;
  if (result.orderFrom && result.orderTo && result.orderFrom > result.orderTo) return;
  if (result.auditFrom && result.auditTo && result.auditFrom > result.auditTo) return;
  if (result.section === "orders" && result.queueType === "SUPPLIER_CONFIRMATION") {
    if (result.orderId && result.orderId !== result.object) return;
    result.orderId = result.object;
  }
  if (result.section === "orders" && ["AGREEMENT_SIGNATURE", "ORGANIZATION_REVIEW"].includes(result.queueType ?? "")) {
    if (result.orderId) return;
    result.section = "organizations";
  }
  // Existing mixed links remain valid. The conversation is the visible target.
  if (result.conversationId) { result.ticketId = undefined; result.supportMode = "conversations"; }
  else if (result.ticketId) result.supportMode = "tickets";
  return result;
}

export function serializeAdminQuery(state: AdminQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === "" || (key !== "section" && value === defaultAdminQuery[key as keyof AdminQuery])) continue;
    params.set(key, String(value));
  }
  const parsed = parseAdminQuery(params.toString());
  if (!parsed) throw new Error("Invalid Admin navigation state");
  if (parsed.conversationId) params.delete("ticketId");
  return `?${params}`;
}

export function adminSectionQuery(state: AdminQuery, section: AdminSection): AdminQuery {
  return { ...state, section, object: undefined, queueType: undefined, ticketId: undefined, conversationId: undefined, orgId: undefined, orderId: undefined };
}
