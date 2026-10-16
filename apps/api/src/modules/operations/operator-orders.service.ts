import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { discrepancySourceSchema, discrepancyStatementSchema, operatorOrderDetailSchema, type OperatorOrders, type OperatorOrdersQuery } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";
import { AccessControlService } from "../access-control/access-control.service";
import { OrderWorkflowService } from "../commerce/order-workflow.service";
import { resupplyInclude, resupplyView } from "../commerce/order-resupply.rules";

const party = { id: true, displayName: true, legalName: true, bin: true } as const;
const selection = { id: true, orderNumber: true, buyer: { select: party }, supplier: { select: party }, status: true, paymentStatus: true,
  subtotalAmountMinor: true, currency: true, createdAt: true, updatedAt: true, version: true } as const satisfies Prisma.SupplierOrderSelect;
const organizationSearch = (value: string): Prisma.OrganizationWhereInput => ({ OR: [{ displayName: { contains: value, mode: "insensitive" } }, { legalName: { contains: value, mode: "insensitive" } }, { bin: { contains: value } }] });

@Injectable()
export class OperatorOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService, private readonly workflow: OrderWorkflowService) {}

  private async authorize(context: AuthorityActorContext) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm"])) throw new ForbiddenException("Insufficient permissions");
  }

  async list(query: OperatorOrdersQuery, context: AuthorityActorContext): Promise<OperatorOrders> {
    await this.authorize(context);
    const where: Prisma.SupplierOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}), ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.buyer ? { buyer: { is: organizationSearch(query.buyer) } } : {}),
      ...(query.supplier ? { supplier: { is: organizationSearch(query.supplier) } } : {}),
      ...(query.q ? { OR: [{ orderNumber: { contains: query.q, mode: "insensitive" } }, { buyer: { is: organizationSearch(query.q) } }, { supplier: { is: organizationSearch(query.q) } }] } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt: {
        ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00+05:00`) } : {}),
        ...(query.dateTo ? { lt: new Date(new Date(`${query.dateTo}T00:00:00+05:00`).getTime() + 86400000) } : {}),
      } } : {}),
    };
    return this.prisma.$transaction(async tx => {
      const total = await tx.supplierOrder.count({ where });
      const rows = await tx.supplierOrder.findMany({ where, select: selection, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: query.offset, take: query.limit });
      return { items: rows.map(row => ({ ...row, subtotalAmountMinor: row.subtotalAmountMinor.toFixed(0), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })), total, offset: query.offset, limit: query.limit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async detail(id: string, context: AuthorityActorContext) {
    await this.authorize(context);
    // Existing workflow owns payment/fulfillment facts and party write restrictions.
    const workflow = await this.workflow.get(id, context);
    const [canViewDocuments, canViewSupport] = await Promise.all(["document.view", "support.ticket.view"].map(permission => this.access.hasAll(context.actorId, context.organizationId, [permission])));
    const extra = await this.prisma.$transaction(async tx => {
      const claims = await tx.orderDiscrepancy.findMany({ where: { supplierOrderId: id, status: { not: "DRAFT" } }, include: { events: { where: { action: { notIn: ["CREATE", "SAVE"] } }, orderBy: { version: "asc" } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      const shipments = claims.length ? await tx.shipment.findMany({ where: { supplierOrderId: id, id: { in: claims.map(claim => claim.shipmentId) } }, include: resupplyInclude }) : [];
      const discrepancies = claims.map(claim => {
        const statement = discrepancyStatementSchema.parse(claim.statement), source = discrepancySourceSchema.parse(claim.source);
        const shipment = shipments.find(item => item.id === claim.shipmentId);
        const resupply = shipment ? resupplyView(workflow.order, claim, shipment) : null;
        return { id: claim.id, shipmentId: claim.shipmentId, version: claim.version, status: claim.status,
          previousDiscrepancyId: claim.previousDiscrepancyId, resolution: claim.resolution, kind: statement.kind, reason: statement.reason,
          sourceDocumentId: canViewDocuments ? source.documentId : null, sourceDocumentVersion: canViewDocuments ? source.documentVersion : null,
          createdAt: claim.createdAt.toISOString(), updatedAt: claim.updatedAt.toISOString(),
          resupply: resupply ? { ...resupply, canDispatch: false } : null,
          events: claim.events.map(event => ({ id: event.id, version: event.version, action: event.action, actorId: event.actorId, organizationId: event.organizationId, createdAt: event.createdAt.toISOString(), details: event.details })) };
      });
      const links = canViewSupport ? await tx.supportLink.findMany({ where: { entityType: "SupplierOrder", entityId: id }, select: { ticketId: true } }) : [];
      const ticketIds = [...new Set([...links.map(link => link.ticketId), ...workflow.claims.flatMap(claim => claim.supportTicketId ? [claim.supportTicketId] : [])])];
      const tickets = canViewSupport && ticketIds.length ? await tx.supportTicket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, number: true, subject: true, status: true, createdAt: true, updatedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }) : [];
      return { discrepancies, tickets };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    // Serialize through the established public schema (Prisma dates/decimals become strings).
    return operatorOrderDetailSchema.parse(JSON.parse(JSON.stringify({ workflow, ...extra, canWrite: false, canViewDocuments, canViewSupport })));
  }
}
