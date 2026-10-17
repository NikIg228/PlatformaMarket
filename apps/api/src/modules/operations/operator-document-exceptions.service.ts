import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { discrepancySourceSchema, discrepancyStatementSchema, operatorDocumentExceptionSchema, operatorExceptionReviewResultSchema,
  type OperatorExceptionReview, type OperatorExceptionReviewResult } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";

@Injectable()
export class OperatorDocumentExceptionsService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService) {}

  private async authorize(context: AuthorityActorContext, write = false) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm", ...(write ? ["support.ticket.manage"] : [])])) throw new ForbiddenException("Insufficient permissions");
  }

  async get(id: string, context: AuthorityActorContext) {
    await this.authorize(context);
    const [canViewDocuments, canViewSupport, canPublish] = await Promise.all(["document.view", "support.ticket.view", "support.ticket.manage"].map(permission => this.access.hasAll(context.actorId, context.organizationId, [permission])));
    return this.prisma.$transaction(async tx => {
      const claim = await tx.orderDiscrepancy.findFirst({ where: { id, status: { not: "DRAFT" } }, select: {
        id: true, version: true, status: true, statement: true, source: true, resolution: true,
        supplierOrder: { select: { id: true, orderNumber: true, version: true,
          buyer: { select: { id: true, displayName: true } }, supplier: { select: { id: true, displayName: true } } } },
        shipment: { select: { id: true, shipmentNumber: true, version: true, status: true, items: { select: { id: true, deliveredQuantity: true } } } },
        events: { where: { action: { notIn: ["CREATE", "SAVE"] } }, orderBy: { version: "asc" },
          select: { id: true, action: true, createdAt: true, version: true, details: true } },
      } });
      if (!claim) throw new NotFoundException("Document exception not found");
      const reviewed = claim.events.some(event => event.version === claim.version && event.action === "OPERATOR_REVIEW");
      const source = discrepancySourceSchema.parse(claim.source), statement = discrepancyStatementSchema.parse(claim.statement);
      const links = canViewSupport ? await tx.supportLink.findMany({ where: { OR: [
        { entityType: "OrderDiscrepancy", entityId: id }, { entityType: "SupplierOrder", entityId: claim.supplierOrder.id },
      ] }, select: { ticketId: true } }) : [];
      const ticketIds = [...new Set(links.map(link => link.ticketId))];
      const tickets = ticketIds.length ? await tx.supportTicket.findMany({ where: { id: { in: ticketIds } },
        select: { id: true, number: true, subject: true, status: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }) : [];
      return operatorDocumentExceptionSchema.parse({
        id: claim.id, version: claim.version, status: claim.status, kind: statement.kind, reason: statement.reason, resolution: claim.resolution,
        order: { id: claim.supplierOrder.id, number: claim.supplierOrder.orderNumber, version: claim.supplierOrder.version },
        shipment: { id: claim.shipment.id, number: claim.shipment.shipmentNumber, version: claim.shipment.version, status: claim.shipment.status },
        buyer: { id: claim.supplierOrder.buyer.id, name: claim.supplierOrder.buyer.displayName },
        supplier: { id: claim.supplierOrder.supplier.id, name: claim.supplierOrder.supplier.displayName },
        sourceDocument: canViewDocuments && source.documentId && source.documentVersion ? { id: source.documentId, version: source.documentVersion } : null,
        canViewDocuments, canViewSupport, canPublish: canPublish && !reviewed, reviewStatus: reviewed ? "REVIEWED" : "PENDING",
        lines: source.lines.map(line => {
          const reported = statement.lines.find(row => row.shipmentItemId === line.shipmentItemId);
          return { id: line.shipmentItemId, name: line.name, uom: line.uom, sentQuantity: line.sentQuantity,
            reportedQuantity: reported?.actualQuantity ?? line.recordedReceivedQuantity, damagedQuantity: reported?.damagedQuantity ?? "0",
            receivedQuantity: claim.shipment.items.find(row => row.id === line.shipmentItemId)?.deliveredQuantity.toString() ?? line.recordedReceivedQuantity };
        }),
        events: claim.events.map(event => {
          const details = event.details && typeof event.details === "object" && !Array.isArray(event.details) ? event.details : {};
          return { id: event.id, action: event.action, at: event.createdAt.toISOString(), version: event.version,
            reason: typeof details.reason === "string" ? details.reason : null,
            nextStep: event.action === "OPERATOR_REVIEW" && typeof details.nextStep === "string" ? details.nextStep : null,
            decision: typeof details.decision === "string" ? details.decision : null,
            accepted: typeof details.accepted === "boolean" ? details.accepted : null };
        }), tickets,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async publish(id: string, input: OperatorExceptionReview, context: AuthorityActorContext): Promise<OperatorExceptionReviewResult> {
    await this.authorize(context, true);
    const requestHash = createHash("sha256").update(JSON.stringify({ id, ...input })).digest("hex");
    const conflict = () => new ConflictException({ code: "OPERATOR_EXCEPTION_CONFLICT", message: "Данные изменились. Обновите расхождение и сравните историю перед публикацией." });
    return this.prisma.$transaction(async tx => {
      const reference = await tx.orderDiscrepancy.findFirst({ where: { id, status: { not: "DRAFT" } }, select: { supplierOrderId: true } });
      if (!reference) throw new NotFoundException("Document exception not found");
      // Share the party workflow lock so a concurrent answer cannot be overwritten.
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${reference.supplierOrderId}::uuid FOR UPDATE`;
      const replay = await tx.orderDiscrepancyEvent.findUnique({ where: { supplierOrderId_organizationId_idempotencyKey: {
        supplierOrderId: reference.supplierOrderId, organizationId: context.organizationId, idempotencyKey: input.idempotencyKey,
      } } });
      if (replay) {
        if (replay.actorId !== context.actorId || replay.requestHash !== requestHash || replay.action !== "OPERATOR_REVIEW") throw conflict();
        return operatorExceptionReviewResultSchema.parse(replay.result);
      }
      const claim = await tx.orderDiscrepancy.findFirst({ where: { id, status: { not: "DRAFT" } }, include: {
        supplierOrder: { select: { version: true, buyerOrganizationId: true, supplierOrganizationId: true } },
        shipment: { select: { version: true } }, events: { orderBy: { version: "desc" }, take: 1, select: { action: true } },
      } });
      if (!claim) throw new NotFoundException("Document exception not found");
      if (claim.version !== input.expectedExceptionVersion || claim.supplierOrder.version !== input.expectedOrderVersion ||
        claim.shipment.version !== input.expectedShipmentVersion || claim.events[0]?.action === "OPERATOR_REVIEW") throw conflict();
      const updated = await tx.orderDiscrepancy.updateMany({ where: { id, version: input.expectedExceptionVersion }, data: { version: { increment: 1 } } });
      if (updated.count !== 1) throw conflict();
      const result = operatorExceptionReviewResultSchema.parse({ orderId: claim.supplierOrderId, discrepancyId: id,
        version: claim.version + 1, status: claim.status, eventId: randomUUID(), reviewStatus: "REVIEWED" });
      await tx.orderDiscrepancyEvent.create({ data: { id: result.eventId, supplierOrderId: claim.supplierOrderId, discrepancyId: id,
        ...context, version: result.version, action: "OPERATOR_REVIEW", idempotencyKey: input.idempotencyKey, requestHash,
        details: { reason: input.reason, nextStep: input.nextStep, reviewedExceptionVersion: claim.version }, result: { ...result } } });
      await tx.auditLog.create({ data: { ...context, action: "operation.document_exception.reviewed", entityType: "OrderDiscrepancy", entityId: id,
        before: { version: claim.version, status: claim.status }, after: { ...result } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierOrder", aggregateId: claim.supplierOrderId, eventType: "OrderDiscrepancyChanged",
        payload: { ...result, action: "OPERATOR_REVIEW", buyerOrganizationId: claim.supplierOrder.buyerOrganizationId, supplierOrganizationId: claim.supplierOrder.supplierOrganizationId } } });
      return result;
    }, { timeout: 15000 });
  }
}
