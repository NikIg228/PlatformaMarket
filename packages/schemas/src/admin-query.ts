/** Read-only URL state. Never conveys identity, authority or commands. */
export const adminSections = ["analytics", "overview", "organizations", "access", "catalog", "imports", "orders", "support", "security", "settings"] as const;
export const adminQueueTypes = ["ORGANIZATION_REVIEW", "PROMOTION_REVIEW", "CATALOG_REVIEW", "COMPLIANCE_REVIEW", "INTEGRATION_RECONCILIATION", "IMPORT_ATTENTION", "AGREEMENT_SIGNATURE", "SUPPLIER_CONFIRMATION", "STALE_INVENTORY"] as const;
export type AdminSection = typeof adminSections[number];
export type AdminQueueType = typeof adminQueueTypes[number];
export type AdminQuery = {
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
  queueOffset: number;
  orgId?: string;
  orgQ: string;
  orgStatus: "" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  orgCapability: "" | "BUYER" | "SUPPLIER" | "IMPORTER" | "LOGISTICS_PROVIDER" | "SERVICE_PROVIDER" | "MARKETPLACE_OPERATOR" | "PAYMENT_PARTNER";
  orgOffset: number;
};
export const defaultAdminQuery: AdminQuery = { section: "overview", supportMode: "tickets", supportStatus: "", supportQ: "", supportSort: "queue", supportOffset: 0, conversationFilter: "ALL", conversationOffset: 0, queueKind: "ALL", queueOffset: 0, orgQ: "", orgStatus: "", orgCapability: "", orgOffset: 0 };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unsafe = /[\\#\u0000-\u001f\u007f]/;

export function parseAdminQuery(search: string): AdminQuery | undefined {
  if (search.length > 4096 || unsafe.test(search)) return;
  const params = new URLSearchParams(search);
  const result = { ...defaultAdminQuery };
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1 || (!["supportQ", "orgQ"].includes(key) && unsafe.test(value))) return;
    if (key === "section" && adminSections.includes(value as AdminSection)) result.section = value as AdminSection;
    else if ((key === "queueType" || key === "queueKind") && adminQueueTypes.includes(value as AdminQueueType)) result[key] = value as AdminQueueType;
    else if (key === "queueKind" && value === "ALL") result.queueKind = value;
    else if (["object", "ticketId", "conversationId"].includes(key) && uuid.test(value)) result[key as "object" | "ticketId" | "conversationId"] = value;
    else if (key === "supportMode" && (value === "tickets" || value === "conversations")) result.supportMode = value;
    else if (key === "supportStatus" && ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"].includes(value)) result.supportStatus = value as AdminQuery["supportStatus"];
    else if (key === "supportQ" && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result.supportQ = value.trim();
    else if (key === "orgQ" && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value)) result.orgQ = value.trim();
    else if (key === "orgId" && uuid.test(value)) result.orgId = value;
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
  return { ...state, section, object: undefined, queueType: undefined, ticketId: undefined, conversationId: undefined, orgId: undefined };
}
