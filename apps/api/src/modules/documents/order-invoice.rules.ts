import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { orderInvoiceSnapshotSchema, orderLineVat, organizationRequisitesRevisionSchema,
  type OrderInvoiceIssue, type OrderInvoiceSnapshot, type OrganizationRequisitesRevision } from "@marketplace/schemas";
import { organizationRequisitesSource } from "../organizations/organization-requisites.service";
import { requisitesDate, requisitesReadiness } from "../organizations/organization-requisites.rules";
import { orderReservationState } from "../inventory/reservation-lifecycle";

export const invoiceOrderInclude = {
  items: { include: { reservation: { include: { externalReservation: true } }, productVariant: { include: { product: true, saleUnit: true } }, offer: { include: { packaging: true } } }, orderBy: { id: "asc" as const } },
  transferClaims: true, paymentAllocation: true,
} satisfies Prisma.SupplierOrderInclude;
export type InvoiceOrder = Prisma.SupplierOrderGetPayload<{ include: typeof invoiceOrderInclude }>;
export const invoiceConflict = (message: string, issues?: OrderInvoiceIssue[]) => new ConflictException({ code: "ORDER_INVOICE_CONFLICT", message, ...(issues ? { details: { issues } } : {}) });

export function invoiceLifecycleIssue(order: Pick<InvoiceOrder, "status" | "paymentStatus" | "manualInvoiceDocumentId" | "transferClaims" | "paymentAllocation" | "items">): string | null {
  const replacement = !order.manualInvoiceDocumentId && order.transferClaims.length > 0 && order.transferClaims.every(claim => claim.status === "CONFIRMED");
  if (order.paymentAllocation || (!["UNPAID", "PAID"].includes(order.paymentStatus))) return "Оплата уже обрабатывается или подтверждена";
  if (!(order.status === "CONFIRMED" || order.status === "AWAITING_PAYMENT" || order.status === "PAID" && replacement)
    || order.transferClaims.length > 0 && !replacement) return "Согласуйте состав заказа; заявленный перевод блокирует замену счёта";
  if (orderReservationState(order).status === "DUE" || orderReservationState(order).status === "EXPIRED") return "Срок резерва истёк. Счёт нельзя выставить";
  return null;
}

export async function invoiceRequisites(db: Prisma.TransactionClient, organizationId: string, party: "SUPPLIER" | "BUYER") {
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, include: { capabilities: true } });
  const source = await organizationRequisitesSource(db, organization);
  const head = await db.organizationRequisites.findUnique({ where: { organizationId } });
  const stored = head?.version ? await db.organizationRequisitesRevision.findUnique({ where: { organizationId_version: { organizationId, version: head.version } } }) : null;
  const current = stored ? organizationRequisitesRevisionSchema.parse({
    id: stored.id, version: stored.version, fields: stored.fields, source: stored.source,
    createdAt: stored.createdAt.toISOString(), createdBy: { id: stored.createdById, displayName: stored.createdByName },
    confirmedAt: stored.confirmedAt?.toISOString() ?? null, confirmedBy: stored.confirmedById ? { id: stored.confirmedById, displayName: stored.confirmedByName } : null,
  }) : null;
  const readiness = requisitesReadiness(source, current);
  const issues: OrderInvoiceIssue[] = readiness.issues
    .filter(issue => party !== "BUYER" || !["BANK_ACCOUNT_REQUIRED", "TAX_STATUS_REQUIRED"].includes(issue.code))
    .map(issue => ({ party, code: issue.code, message: issue.message }));
  if (organization.status !== "ACTIVE") issues.push({ party, code: "ORGANIZATION_INACTIVE", message: "Организация недоступна для выставления счёта" });
  return { current, issues };
}

export function invoiceLines(order: InvoiceOrder): { lines: OrderInvoiceSnapshot["lines"]; issues: OrderInvoiceIssue[] } {
  const issues: OrderInvoiceIssue[] = [];
  const lines = order.items.filter(item => item.acceptedQuantity.gt(0)).map(item => {
    const tax = orderLineVat(item.offerSnapshot, item.totalPriceMinor.toString());
    const gift = Boolean(item.giftForItemId) && item.totalPriceMinor.eq(0);
    if (!tax && !gift) issues.push({ party: "ORDER", code: "TAX_REQUIRED", message: `Уточните налоговые условия позиции «${item.productVariant.product.canonicalName}» в заказе` });
    return { id: item.id, name: item.productVariant.product.canonicalName,
      article: item.productVariant.sku ?? "", unit: item.offer.packaging?.name ?? item.productVariant.saleUnit?.nameRu ?? "",
      quantity: item.acceptedQuantity.toString(), unitPriceMinor: item.unitPriceMinor.toString(), totalMinor: item.totalPriceMinor.toString(), tax, gift };
  });
  if (!lines.length || lines.reduce((sum, line) => sum + BigInt(line.totalMinor), 0n).toString() !== order.subtotalAmountMinor.toString()) {
    issues.push({ party: "ORDER", code: "AMOUNT_CONFLICT", message: "Суммы позиций не совпадают с согласованным итогом заказа" });
  }
  if (order.currency !== "KZT") issues.push({ party: "ORDER", code: "CURRENCY_UNSUPPORTED", message: "Для этого шаблона требуется заказ в тенге" });
  return { lines, issues };
}

export function invoiceSnapshot(order: InvoiceOrder, supplier: OrganizationRequisitesRevision, buyer: OrganizationRequisitesRevision,
  number: string, version: number, bankAccountId?: string): OrderInvoiceSnapshot {
  const bankAccount = supplier.fields.bankAccounts.find(account => account.id === (bankAccountId ?? supplier.fields.defaultBankAccountId));
  if (!bankAccount || bankAccount.currency !== order.currency) throw invoiceConflict("Выберите подтверждённый счёт поставщика в валюте заказа");
  const { lines, issues } = invoiceLines(order);
  if (issues.length) throw invoiceConflict("Проверьте условия заказа", issues);
  return orderInvoiceSnapshotSchema.parse({ templateVersion: "PM_INVOICE_V1", orderId: order.id, orderNumber: order.orderNumber,
    orderVersion: order.version, number, version, date: requisitesDate(), supplier, buyer, bankAccount, lines,
    currency: order.currency, totalMinor: order.subtotalAmountMinor.toString(),
    baseMinor: lines.reduce((sum, line) => sum + BigInt(line.tax?.baseMinor ?? "0"), 0n).toString(),
    vatMinor: lines.reduce((sum, line) => sum + BigInt(line.tax?.vatMinor ?? "0"), 0n).toString() });
}
