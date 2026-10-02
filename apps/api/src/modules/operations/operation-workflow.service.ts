import { membershipPermission } from "../access-control/access-mode";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { OperationAssignment, OperationAssignmentResult, OperationQueueType } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { workflowCommand } from "../support/workflow-command";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { environment } from "../../platform/config/environment";

export function assignmentView(item: { id: string; version: number; priority: string; assigneeId: string | null; dueAt: Date | null; reason: string; updatedAt: Date; assignee: { displayName: string } | null }): OperationAssignmentResult {
  return { id: item.id, version: item.version, priority: item.priority, assigneeId: item.assigneeId, assigneeName: item.assignee?.displayName ?? null, dueAt: item.dueAt?.toISOString() ?? null, reason: item.reason, updatedAt: item.updatedAt.toISOString() };
}

@Injectable()
export class OperationWorkflowService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  private async authorize(context: SupplierActorContext, write = false) {
    if (!await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "MARKETPLACE_OPERATOR" } } }) || !await this.access.hasAll(context.actorId, context.organizationId, [write ? "support.ticket.manage" : "organization.view"])) throw new ForbiddenException("Operator workflow permission is required");
  }

  async assignees(context: SupplierActorContext) {
    await this.authorize(context);
    const members = await this.prisma.organizationMembership.findMany({ where: { organizationId: context.organizationId, status: "ACTIVE", user: { status: "ACTIVE" }, ...membershipPermission(context.organizationId, "support.ticket.manage") }, select: { user: { select: { id: true, displayName: true } } }, orderBy: { user: { displayName: "asc" } }, take: 100 });
    return members.map(item => item.user);
  }

  async object(type: OperationQueueType, id: string, context: SupplierActorContext) {
    await this.authorize(context);
    if (type === "PROMOTION_REVIEW" && environment().DEPLOYMENT_PROFILE !== "go_live") throw new NotFoundException("Queue object not found");
    const fields: { label: string; value: string }[] = [];
    const field = (label: string, value: unknown) => fields.push({ label, value: value instanceof Date ? value.toISOString() : value == null ? "Не указано" : String(value) });
    let title = "";
    if (type === "ORGANIZATION_REVIEW") {
      const item = await this.prisma.supplierTermsAcceptance.findUnique({ where: { id }, select: { admissionStatus: true, acceptedAt: true, organization: { select: { displayName: true } } } });
      if (item) { title = item.organization.displayName; field("Статус", item.admissionStatus); field("Акцепт", item.acceptedAt); }
    } else if (type === "PROMOTION_REVIEW") {
      const item = await this.prisma.promotion.findUnique({ where: { id }, select: { name: true, moderationStatus: true, status: true, endsAt: true } });
      if (item) { title = item.name; field("Модерация", item.moderationStatus); field("Статус", item.status); field("До", item.endsAt); }
    } else if (type === "CATALOG_REVIEW") {
      const item = await this.prisma.productCandidate.findUnique({ where: { id }, select: { proposedName: true, proposedSku: true, status: true, createdAt: true } });
      if (item) { title = item.proposedName; field("Артикул", item.proposedSku); field("Статус", item.status); field("Создана", item.createdAt); }
    } else if (type === "COMPLIANCE_REVIEW") {
      const item = await this.prisma.complianceCheck.findUnique({ where: { id }, select: { status: true, riskLevel: true, reasons: true, evaluatedAt: true } });
      if (item) { title = "Проверка допуска"; field("Статус", item.status); field("Риск", item.riskLevel); field("Причины", Array.isArray(item.reasons) ? item.reasons.filter(value => typeof value === "string").join("; ") : "Требуется проверка"); field("Проверено", item.evaluatedAt); }
    } else if (type === "INTEGRATION_RECONCILIATION") {
      const item = await this.prisma.integrationReconciliationEntry.findUnique({ where: { id }, select: { kind: true, status: true, externalRef: true, detectedAt: true } });
      if (item) { title = "Расхождение данных"; field("Тип", item.kind); field("Статус", item.status); field("Внешняя ссылка", item.externalRef); field("Обнаружено", item.detectedAt); }
    } else if (type === "IMPORT_ATTENTION") {
      const item = await this.prisma.importBatch.findUnique({ where: { id }, select: { fileName: true, status: true, totalRows: true, processedRows: true, errorRows: true } });
      if (item) { title = item.fileName; field("Статус", item.status); field("Строк", item.totalRows); field("Обработано", item.processedRows); field("Ошибки", item.errorRows); }
    } else if (type === "AGREEMENT_SIGNATURE") {
      const item = await this.prisma.marketplaceAgreement.findUnique({ where: { id }, select: { agreementNumber: true, status: true, createdAt: true } });
      if (item) { title = `Договор ${item.agreementNumber}`; field("Статус", item.status); field("Создан", item.createdAt); }
    } else if (type === "SUPPLIER_CONFIRMATION") {
      const item = await this.prisma.supplierOrder.findUnique({ where: { id }, select: { orderNumber: true, status: true, paymentStatus: true, buyer: { select: { displayName: true } }, supplier: { select: { displayName: true } }, createdAt: true } });
      if (item) { title = `Заказ ${item.orderNumber}`; field("Статус", item.status); field("Оплата", item.paymentStatus); field("Клиника", item.buyer.displayName); field("Поставщик", item.supplier.displayName); field("Создан", item.createdAt); }
    } else {
      const item = await this.prisma.inventoryBalance.findUnique({ where: { id }, select: { quantityAvailable: true, freshnessStatus: true, freshnessExpiresAt: true, warehouse: { select: { name: true } }, offer: { select: { supplierSku: true } } } });
      if (item) { title = `Остаток ${item.offer?.supplierSku ?? id}`; field("Склад", item.warehouse.name); field("Доступно", item.quantityAvailable); field("Актуальность", item.freshnessStatus); field("Подтверждено до", item.freshnessExpiresAt); }
    }
    if (!title) throw new NotFoundException("Queue object not found");
    return { id, queueType: type, title, fields };
  }

  private async requireObject(type: OperationQueueType, id: string) {
    if (type === "PROMOTION_REVIEW" && environment().DEPLOYMENT_PROFILE !== "go_live") throw new NotFoundException("Queue object not found");
    const select = { id: true } as const;
    const record = type === "ORGANIZATION_REVIEW" ? await this.prisma.supplierTermsAcceptance.findUnique({ where: { id }, select })
      : type === "PROMOTION_REVIEW" ? await this.prisma.promotion.findUnique({ where: { id }, select })
      : type === "CATALOG_REVIEW" ? await this.prisma.productCandidate.findUnique({ where: { id }, select })
      : type === "COMPLIANCE_REVIEW" ? await this.prisma.complianceCheck.findUnique({ where: { id }, select })
      : type === "INTEGRATION_RECONCILIATION" ? await this.prisma.integrationReconciliationEntry.findUnique({ where: { id }, select })
      : type === "IMPORT_ATTENTION" ? await this.prisma.importBatch.findUnique({ where: { id }, select })
      : type === "AGREEMENT_SIGNATURE" ? await this.prisma.marketplaceAgreement.findUnique({ where: { id }, select })
      : type === "SUPPLIER_CONFIRMATION" ? await this.prisma.supplierOrder.findUnique({ where: { id }, select })
      : await this.prisma.inventoryBalance.findUnique({ where: { id }, select });
    if (!record) throw new NotFoundException("Queue object not found");
  }

  async assign(type: OperationQueueType, id: string, input: OperationAssignment, context: SupplierActorContext) {
    await this.authorize(context, true);
    await this.requireObject(type, id);
    if (input.assigneeId && !await this.access.hasAll(input.assigneeId, context.organizationId, ["support.ticket.manage"])) throw new ConflictException("Assignee must be an active operator in your organization");
    return this.prisma.$transaction(tx => workflowCommand(tx, `operation.assign:${context.organizationId}:${context.actorId}`, input.idempotencyKey, { type, id, ...input }, async () => {
      const where = { operatorOrganizationId: context.organizationId, queueType: type, entityId: id };
      const previous = await tx.operationAssignment.findUnique({ where: { operatorOrganizationId_queueType_entityId: where } });
      if ((previous?.version ?? 0) !== input.expectedVersion) throw new ConflictException("Assignment changed; refresh the queue");
      const data = { priority: input.priority, reason: input.reason, dueAt: input.dueAt ? new Date(input.dueAt) : null, assigneeId: input.assigneeId };
      if (previous) {
        const result = await tx.operationAssignment.updateMany({ where: { id: previous.id, version: input.expectedVersion }, data: { ...data, version: { increment: 1 } } });
        if (result.count !== 1) throw new ConflictException("Assignment changed; refresh the queue");
      } else {
        const result = await tx.operationAssignment.createMany({ data: [{ ...where, ...data }], skipDuplicates: true });
        if (result.count !== 1) throw new ConflictException("Assignment changed; refresh the queue");
      }
      const assignment = await tx.operationAssignment.findUniqueOrThrow({ where: { operatorOrganizationId_queueType_entityId: where }, include: { assignee: { select: { displayName: true } } } });
      await tx.auditLog.create({ data: { ...context, action: "operation.assignment.updated", entityType: "OperationAssignment", entityId: assignment.id, before: previous ? { priority: previous.priority, assigneeId: previous.assigneeId, dueAt: previous.dueAt?.toISOString(), version: previous.version } : undefined, after: { ...input, queueType: type, entityId: id, version: assignment.version } } });
      return assignmentView(assignment);
    }));
  }

  async history(type: OperationQueueType, id: string, context: SupplierActorContext) {
    await this.authorize(context);
    const assignment = await this.prisma.operationAssignment.findUnique({ where: { operatorOrganizationId_queueType_entityId: { operatorOrganizationId: context.organizationId, queueType: type, entityId: id } } });
    if (!assignment) return [];
    return this.prisma.auditLog.findMany({ where: { organizationId: context.organizationId, entityType: "OperationAssignment", entityId: assignment.id }, select: { id: true, action: true, actorId: true, createdAt: true, before: true, after: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
  }
}
