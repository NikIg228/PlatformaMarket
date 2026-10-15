import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DiscrepancySource, DiscrepancyStatement, OrderDiscrepancyCommand, OrderDiscrepancyResult } from "@marketplace/schemas";

export const discrepancyEligibleStatuses = ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED"];
export function validateDiscrepancyStatement(statement: DiscrepancyStatement, source: DiscrepancySource) {
  if (statement.lines.length !== source.lines.length) throw new ConflictException("Укажите факт по каждой строке отправления");
  let shortage = false, damaged = false, excess = false, received = false;
  for (const line of statement.lines) {
    const original = source.lines.find(item => item.shipmentItemId === line.shipmentItemId);
    if (!original) throw new ConflictException("Строка не относится к выбранному отправлению");
    const actual = new Prisma.Decimal(line.actualQuantity), defect = new Prisma.Decimal(line.damagedQuantity), sent = new Prisma.Decimal(original.sentQuantity);
    if (defect.gt(actual)) throw new ConflictException("Повреждённое количество превышает фактическое");
    shortage ||= actual.lt(sent); damaged ||= defect.gt(0); excess ||= actual.gt(sent); received ||= actual.gt(0);
  }
  if ((statement.kind === "SHORTAGE" && !shortage) || (statement.kind === "DAMAGED" && !damaged) ||
    (statement.kind === "NOT_RECEIVED" && received) || (statement.kind === "EXCESS" && !excess))
    throw new ConflictException("Тип расхождения не соответствует указанным количествам");
  if (["SHORTAGE", "NOT_RECEIVED"].includes(statement.kind) && !["RESUPPLY", "REDUCTION"].includes(statement.requestedResolution))
    throw new ConflictException("Для недостачи выберите допоставку или уменьшение обязательства");
  if (statement.kind === "RECEIPT_ERROR" && !source.sourceReceiptEventId)
    throw new ConflictException("Для исправления укажите исходное событие получения");
}

export function discrepancyTransition(status: string, statement: DiscrepancyStatement, input: OrderDiscrepancyCommand): { status: OrderDiscrepancyResult["status"]; resolution?: DiscrepancyStatement["requestedResolution"] } {
  if ((input.action === "SAVE" || input.action === "SUBMIT") && status === "DRAFT") return { status: input.action === "SAVE" ? "DRAFT" : "SUBMITTED" };
  if (input.action === "RESPOND" && status === "SUBMITTED") {
    if (input.decision === "AGREE" && input.resolution !== statement.requestedResolution)
      throw new ConflictException("Другой вариант требует встречного предложения клинике");
    if (input.decision !== "REJECT" && ["SHORTAGE", "NOT_RECEIVED"].includes(statement.kind) && !["RESUPPLY", "REDUCTION"].includes(input.resolution))
      throw new ConflictException("Для недостачи выберите допоставку или уменьшение обязательства");
    return { status: input.decision === "REJECT" ? "REJECTED" : input.decision === "COUNTER" ? "RESOLUTION_PROPOSED" : "AGREED", ...(input.decision !== "REJECT" ? { resolution: input.resolution } : {}) };
  }
  if (input.action === "DECIDE" && status === "RESOLUTION_PROPOSED") return { status: input.accepted ? "AGREED" : "REJECTED" };
  throw new ConflictException("Действие недоступно в текущем состоянии заявления");
}
