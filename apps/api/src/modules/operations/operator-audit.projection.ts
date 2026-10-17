import type { OperatorAuditEntry } from "@marketplace/schemas";

// Only bounded, typed business facts are exposed. Free text, nested snapshots,
// credentials, contacts, documents and unknown fields remain private by default.
const statuses = new Set(["ACTIVE", "INACTIVE", "ARCHIVED", "PENDING", "PROCESSING", "PUBLISHED", "FAILED", "DEAD_LETTER", "COMPLETED", "CANCELLED", "DRAFT", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "SUBMITTED", "APPROVED", "REJECTED", "ACCEPTED", "DECLINED", "CONFIRMED", "AWAITING_CONFIRMATION", "PARTIALLY_CONFIRMED", "PAID", "UNPAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_DELIVERED", "AGREED", "RESOLUTION_PROPOSED", "GENERATED", "SIGNED", "SUPERSEDED", "RESTRICTED", "BLOCKED", "PASSED", "VALIDATED", "ROLLED_BACK", "LOW", "NORMAL", "HIGH", "CRITICAL", "REVIEWED", "PENDING_REVIEW"]);
type Rule = { label: string; valid: (value: unknown) => boolean };
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const decimal = (value: unknown) => typeof value === "string" && /^-?\d{1,24}(\.\d{1,6})?$/.test(value) || integer(value);
const status = (value: unknown) => typeof value === "string" && statuses.has(value);
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) && Number.isFinite(Date.parse(value));
const rules: Record<string, Rule> = {
  status: { label: "Статус", valid: status }, paymentStatus: { label: "Оплата", valid: status }, reviewStatus: { label: "Рассмотрение", valid: status },
  previousStatus: { label: "Предыдущий статус", valid: status }, priority: { label: "Приоритет", valid: status },
  version: { label: "Редакция", valid: integer }, attempts: { label: "Попытки", valid: integer }, maxAttempts: { label: "Лимит попыток", valid: integer },
  assigneeId: { label: "ID ответственного", valid: uuid }, orderId: { label: "ID заказа", valid: uuid }, shipmentId: { label: "ID партии", valid: uuid },
  discrepancyId: { label: "ID расхождения", valid: uuid }, eventId: { label: "ID события", valid: uuid },
  amountMinor: { label: "Сумма (minor units)", valid: decimal }, totalAmountMinor: { label: "Итог (minor units)", valid: decimal },
  quantity: { label: "Количество", valid: decimal }, availableAt: { label: "Доступно с", valid: date }, dueAt: { label: "Срок", valid: date },
  currency: { label: "Валюта", valid: value => typeof value === "string" && ["KZT", "USD", "EUR", "RUB"].includes(value) },
};
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function auditChanges(beforeValue: unknown, afterValue: unknown): Pick<OperatorAuditEntry, "changes" | "redacted"> {
  const before = record(beforeValue), after = record(afterValue), changes: OperatorAuditEntry["changes"] = [];
  let redacted = beforeValue != null && before !== beforeValue || afterValue != null && after !== afterValue;
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const rule = Object.hasOwn(rules, field) ? rules[field] : undefined, left = before[field], right = after[field];
    if (!rule || left != null && !rule.valid(left) || right != null && !rule.valid(right)) { redacted = true; continue; }
    if (left === right) continue;
    changes.push({ field, label: rule.label, before: left == null ? null : String(left), after: right == null ? null : String(right) });
  }
  return { changes, redacted };
}
export function auditObjectHref(entityType: string, entityId: string, permissions: Set<string>): string | null {
  if (!uuid(entityId)) return null;
  const routes: Record<string, [string, string, string]> = {
    Organization: ["organization.view", "organizations", "orgId"], SupplierOrder: ["order.confirm", "orders", "orderId"],
    SupportTicket: ["support.ticket.view", "support", "ticketId"],
  };
  const route = Object.hasOwn(routes, entityType) ? routes[entityType] : undefined;
  if (route && permissions.has(route[0])) return `/admin?section=${route[1]}&${route[2]}=${entityId}`;
  if (entityType === "OrderDiscrepancy" && permissions.has("order.confirm")) return `/admin?section=orders&queueType=DOCUMENT_EXCEPTION&object=${entityId}`;
  if (entityType === "ImportBatch" && permissions.has("import.manage")) return `/admin?section=imports&queueType=IMPORT_ATTENTION&object=${entityId}`;
  return null;
}
