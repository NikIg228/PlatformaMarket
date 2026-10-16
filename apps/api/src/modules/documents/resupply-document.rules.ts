import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { discrepancySourceSchema, discrepancyStatementSchema, resupplyDocumentSnapshotSchema, type ResupplyDocumentSnapshot } from "@marketplace/schemas";

export const RESUPPLY_PREVIEW = "RESUPPLY_DOCUMENT_PREVIEW:";
export const resupplyDocumentConflict = (message: string) => new ConflictException({ code: "RESUPPLY_DOCUMENT_CONFLICT", message });
export const resupplyDocumentInclude = {
  supplierOrder: { include: { supplier: true, buyer: true } },
  shipment: { include: { items: true, resupplyShipment: { include: { items: true } } } },
} satisfies Prisma.OrderDiscrepancyInclude;
export type ResupplyDocumentClaim = Prisma.OrderDiscrepancyGetPayload<{ include: typeof resupplyDocumentInclude }>;

export function resupplyDocumentIssues(claim: ResupplyDocumentClaim) {
  const statement = discrepancyStatementSchema.parse(claim.statement), source = discrepancySourceSchema.parse(claim.source);
  const replacement = claim.shipment.resupplyShipment, issues: string[] = [], settlementIssues: string[] = [];
  if (claim.status !== "AGREED" || claim.resolution !== "RESUPPLY" || statement.kind !== "SHORTAGE") issues.push("Требуется согласованная допоставка по недостаче.");
  if (!replacement || replacement.resupplyDiscrepancyId !== claim.id) issues.push("Сначала зарегистрируйте связанную отправку допоставки.");
  if (["CANCELLED", "REJECTED", "RETURN_DISPUTE"].includes(claim.supplierOrder.status)) issues.push("Состояние заказа требует отдельного урегулирования.");
  const lines = source.lines.map(line => {
    const agreed = statement.lines.find(row => row.shipmentItemId === line.shipmentItemId);
    const original = claim.shipment.items.find(row => row.id === line.shipmentItemId);
    const extra = replacement?.items.find(row => row.supplierOrderItemId === line.orderItemId);
    const received = new Prisma.Decimal(agreed?.actualQuantity ?? "0"), shortage = new Prisma.Decimal(line.sentQuantity).minus(received);
    if (!agreed || !original || original.supplierOrderItemId !== line.orderItemId || !original.quantity.eq(line.sentQuantity) ||
        !original.deliveredQuantity.eq(received) || new Prisma.Decimal(agreed.damagedQuantity).gt(0) || shortage.lt(0)) issues.push("Исходные количества не соответствуют согласованной недостаче.");
    if (shortage.gt(0) && (!extra || !extra.quantity.eq(shortage))) issues.push("Состав допоставки не соответствует заявлению.");
    if (shortage.gt(0) && (!extra || !extra.deliveredQuantity.eq(shortage))) settlementIssues.push("Итоговый черновик доступен после полного получения допоставки.");
    return { orderItemId: line.orderItemId, name: line.name, uom: line.uom, originalQuantity: line.sentQuantity,
      originalReceivedQuantity: received.toString(), resupplyQuantity: Prisma.Decimal.max(shortage, 0).toString(), receivedQuantity: extra?.deliveredQuantity.toString() ?? "0" };
  }).filter(line => new Prisma.Decimal(line.resupplyQuantity).gt(0));
  if (!lines.length || source.lines.length !== statement.lines.length || source.lines.length !== claim.shipment.items.length ||
      replacement && replacement.items.length !== lines.length) issues.push("Состав партий изменился. Требуется сверка.");
  if (replacement?.status !== "DELIVERED") settlementIssues.push("Допоставка ещё не отмечена полностью полученной.");
  return { issues: [...new Set(issues)], settlementIssues: [...new Set(settlementIssues)], lines, source, replacement };
}

export function resupplyDocumentSnapshot(claim: ResupplyDocumentClaim, kind: ResupplyDocumentSnapshot["kind"],
  version: number, preparedBy: ResupplyDocumentSnapshot["preparedBy"], preparedAt = new Date().toISOString()) {
  const data = resupplyDocumentIssues(claim);
  const issues = [...data.issues, ...(kind === "SETTLEMENT" ? data.settlementIssues : [])];
  if (issues.length || !data.replacement) throw resupplyDocumentConflict(issues.join(" "));
  const order = claim.supplierOrder, extra = data.replacement;
  return resupplyDocumentSnapshotSchema.parse({ templateVersion: "PM_RESUPPLY_WORKING_DRAFT_V1", kind,
    orderId: order.id, orderNumber: order.orderNumber, discrepancyId: claim.id, exceptionVersion: claim.version,
    supplier: { id: order.supplierOrganizationId, name: order.supplier.legalName ?? order.supplier.displayName },
    buyer: { id: order.buyerOrganizationId, name: order.buyer.legalName ?? order.buyer.displayName },
    sourceShipmentId: claim.shipmentId, sourceShipmentNumber: data.source.shipmentNumber,
    sourceDocumentId: data.source.documentId, sourceDocumentVersion: data.source.documentVersion, sourceDocumentChecksum: data.source.documentChecksum,
    resupplyShipmentId: extra.id, resupplyShipmentNumber: extra.shipmentNumber, resupplyVersion: extra.version,
    dispatchedAt: extra.dispatchedAt?.toISOString() ?? null, deliveredAt: extra.deliveredAt?.toISOString() ?? null,
    carrierName: extra.carrierName, trackingNumber: extra.trackingNumber,
    reason: discrepancyStatementSchema.parse(claim.statement).reason, number: `RD-${claim.id}-${kind}`, version, preparedAt, preparedBy, lines: data.lines });
}

export function resupplyPreviewCurrent(snapshot: ResupplyDocumentSnapshot, claim: ResupplyDocumentClaim) {
  try { return JSON.stringify(snapshot) === JSON.stringify(resupplyDocumentSnapshot(claim, snapshot.kind, snapshot.version, snapshot.preparedBy, snapshot.preparedAt)); }
  catch { return false; }
}

export function resupplyDocumentText(s: ResupplyDocumentSnapshot) {
  return ["РАБОЧИЙ ЧЕРНОВИК. ФОРМА НЕ УТВЕРЖДЕНА. НЕ ПОДПИСАНО.",
    "Не является документальным закрытием поставки. Полномочия подписантов и ЭЦП не проверены.",
    `Номер: ${s.number}; редакция ${s.version}; подготовлен ${s.preparedAt}`,
    `Заказ: ${s.orderNumber}. Заявление: ${s.discrepancyId}, редакция ${s.exceptionVersion}.`,
    `Поставщик: ${s.supplier.name}. Клиника: ${s.buyer.name}.`,
    `Исходная партия: ${s.sourceShipmentNumber}. Накладная: ${s.sourceDocumentId ?? "отсутствует"}; версия ${s.sourceDocumentVersion ?? "—"}; SHA256 ${s.sourceDocumentChecksum ?? "—"}.`,
    `Причина: ${s.reason}`,
    `Допоставка: ${s.resupplyShipmentNumber}. Отправлена: ${s.dispatchedAt ?? "не зафиксировано"}. Получена полностью: ${s.deliveredAt ?? "не зафиксировано"}.`,
    `Перевозчик: ${s.carrierName ?? "не указан"}. Трек: ${s.trackingNumber ?? "не указан"}.`,
    ...s.lines.map((line, index) => `${index + 1}. ${line.name} (${line.uom}). Исходно: ${line.originalQuantity}; получено исходно: ${line.originalReceivedQuantity}; допоставка: ${line.resupplyQuantity}; получено по допоставке: ${line.receivedQuantity}.`),
    s.kind === "SETTLEMENT" ? "По зафиксированным количествам недостача восполнена. Документальное урегулирование НЕ завершено." : "Фактические события приведены из истории отправления. Этот черновик их не создаёт и не заменяет подписи сторон.",
    "Сумма сделки сохранена. Новый счёт, оплата и списание товара этим документом не создаются.",
    `Подготовил(а): ${s.preparedBy.name}. Подписи поставщика и клиники отсутствуют.`,
    "Реквизиты и план подписей требуют утверждённой формы. РАБОЧИЙ ЧЕРНОВИК — НЕ ПОДПИСАНО."].join("\n\n");
}
