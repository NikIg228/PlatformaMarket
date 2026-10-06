import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { workspaceOrderQuerySchema, workspacePageQuerySchema, workspaceOfferQuerySchema } from "@marketplace/schemas";
import { z } from "zod";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { workspacePage, workspaceOrderBy } from "./workspace-page";
import { workspaceCartInclude, workspaceOfferSelect } from "./workspace-read-selects";
import { recoveredCartId } from "./cart-recovery";
import { orderAttention } from "./workspace-order-attention";

@Injectable()
export class WorkspaceReadsService {
  constructor(private readonly db: PrismaService) {}
  private async authorize(organizationId: string, capability: "BUYER" | "SUPPLIER") {
    const allowed = await this.db.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId, capability } } });
    if (!allowed) throw new ForbiddenException("Organization cannot use this workspace");
  }
  async orders(organizationId: string, role: "buyer" | "supplier", query: z.output<typeof workspaceOrderQuerySchema>) {
    await this.authorize(organizationId, role === "buyer" ? "BUYER" : "SUPPLIER");
    const page = workspacePage([organizationId, role, "orders", query.q, query.status, query.limit, query.group], query.cursor);
    const filters: Prisma.SupplierOrderWhereInput[] = [...page.where.AND];
    if (query.group === "attention") filters.push(orderAttention(role, organizationId));
    if (query.group === "active") filters.push({ status: { notIn: ["DELIVERED", "CANCELLED", "REJECTED"] } });
    if (query.group === "completed") filters.push({ status: "DELIVERED" });
    if (query.group === "cancelled") filters.push({ status: { in: ["CANCELLED", "REJECTED"] } });
    const where: Prisma.SupplierOrderWhereInput = {
      AND: filters, ...(role === "buyer" ? { buyerOrganizationId: organizationId } : { supplierOrganizationId: organizationId }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: [{ orderNumber: { contains: query.q, mode: "insensitive" } }, { [role === "buyer" ? "supplier" : "buyer"]: { displayName: { contains: query.q, mode: "insensitive" } } }] } : {}),
    };
    const rows = await this.db.supplierOrder.findMany({ where, orderBy: [...workspaceOrderBy], take: query.limit + 1,
      select: { id: true, orderNumber: true, status: true, paymentStatus: true, subtotalAmountMinor: true, currency: true, createdAt: true,
        manualInvoiceDocumentId: true,
        transferClaims: { select: { status: true }, take: 1, where: { status: { not: "CONFIRMED" } } },
        manualReturns: { select: { id: true }, take: 1, where: { status: { notIn: ["REJECTED", "REFUND_RECEIVED"] } } },
        supplier: { select: { id: true, displayName: true } }, buyer: { select: { id: true, displayName: true } }, _count: { select: { items: true, transferClaims: { where: { status: "CONFIRMED" } } } } } });
    const result = page.finish(rows, query.limit);
    return { ...result, items: result.items.map(({ _count, transferClaims, manualReturns, manualInvoiceDocumentId, ...row }) => {
      const terminal = ["CANCELLED", "REJECTED", "DELIVERED"].includes(row.status);
      const nextAction = manualReturns.length ? "Посмотреть возврат" : terminal ? null
        : role === "supplier" ? row.status === "AWAITING_CONFIRMATION" ? "Подтвердить состав"
          : transferClaims.length ? transferClaims[0].status === "NEEDS_INFORMATION" ? "Ожидается уточнение оплаты" : "Проверить перевод"
          : ["CONFIRMED", "AWAITING_PAYMENT"].includes(row.status) && !manualInvoiceDocumentId ? "Выставить счёт"
          : ["PAID", "ASSEMBLING", "READY_TO_SHIP"].includes(row.status) ? "Подготовить отгрузку" : null
        : row.status === "PARTIALLY_CONFIRMED" ? "Согласовать состав"
          : transferClaims.some(claim => claim.status === "NEEDS_INFORMATION") ? "Уточнить оплату"
          : row.status === "AWAITING_PAYMENT" && !transferClaims.length ? "Проверить счёт" : null;
      return { ...row, itemCount: _count.items, paymentReviewPending: transferClaims.length > 0,
        partiallyPaid: row.paymentStatus === "UNPAID" && _count.transferClaims > 0, hasOpenReturn: manualReturns.length > 0, nextAction };
    }) };
  }
  async offers(organizationId: string, query: z.output<typeof workspaceOfferQuerySchema>) {
    await this.authorize(organizationId, "SUPPLIER");
    const page = workspacePage([organizationId, "offers", query.q, query.limit, query.publication, query.attention], query.cursor);
    const now = new Date();
    const filters: Prisma.SupplierOfferWhereInput[] = [...page.where.AND];
    if (query.publication === "published") filters.push({ publication: { is: { marketplaceVisible: true } } });
    if (query.publication === "hidden") filters.push({ OR: [{ publication: { is: null } }, { publication: { is: { marketplaceVisible: false } } }] });
    if (query.attention) filters.push({ OR: [
      { prices: { none: { status: "ACTIVE" } } },
      { prices: { some: { status: "ACTIVE", freshnessExpiresAt: { lte: now } } } },
      { inventoryBalances: { none: {} } },
      { inventoryBalances: { some: { OR: [{ freshnessStatus: { not: "FRESH" } }, { freshnessExpiresAt: { lte: now } }] } } },
      { publication: { is: { blockedReason: { not: null } } } },
    ] });
    const rows = await this.db.supplierOffer.findMany({ where: { AND: filters, supplierOrganizationId: organizationId,
      ...(query.q ? { OR: [{ supplierSku: { contains: query.q, mode: "insensitive" } }, { productVariant: { product: { canonicalName: { contains: query.q, mode: "insensitive" } } } }] } : {}) },
      select: workspaceOfferSelect, orderBy: [...workspaceOrderBy], take: query.limit + 1 });
    return page.finish(rows, query.limit);
  }
  async offer(organizationId: string, id: string) {
    await this.authorize(organizationId, "SUPPLIER");
    const row = await this.db.supplierOffer.findFirst({ where: { id, supplierOrganizationId: organizationId }, select: workspaceOfferSelect });
    if (!row) throw new NotFoundException("Offer not found in this workspace");
    return row;
  }
  async carts(organizationId: string, query: z.output<typeof workspacePageQuerySchema>) {
    await this.authorize(organizationId, "BUYER");
    const page = workspacePage([organizationId, "failed-carts", query.limit], query.cursor);
    const [current, rows] = await Promise.all([
      this.db.cart.findFirst({ where: { buyerOrganizationId: organizationId, status: "ACTIVE", checkout: { is: null } }, orderBy: [...workspaceOrderBy], include: workspaceCartInclude }),
      this.db.cart.findMany({ where: { ...page.where, buyerOrganizationId: organizationId, status: "ABANDONED", checkout: { status: "FAILED" } }, orderBy: [...workspaceOrderBy], take: query.limit + 1, include: workspaceCartInclude }),
    ]);
    const result = page.finish(rows, query.limit);
    const recovered = await this.db.cart.findMany({ where: { buyerOrganizationId: organizationId, id: { in: result.items.map(row => recoveredCartId(row.id)) } }, select: { id: true } });
    const ids = new Set(recovered.map(row => row.id));
    return { current, ...result, items: result.items.map(row => ({ ...row, recoveredCartId: ids.has(recoveredCartId(row.id)) ? recoveredCartId(row.id) : null })) };
  }
  async cart(organizationId: string, id: string) {
    await this.authorize(organizationId, "BUYER");
    const row = await this.db.cart.findFirst({ where: { id, buyerOrganizationId: organizationId }, include: workspaceCartInclude });
    if (!row) throw new NotFoundException("Cart not found in this workspace");
    return row;
  }
  async summary(organizationId: string) {
    await this.authorize(organizationId, "SUPPLIER");
    const [orders, offers, publishedOffers] = await this.db.$transaction([
      this.db.supplierOrder.count({ where: { supplierOrganizationId: organizationId } }),
      this.db.supplierOffer.count({ where: { supplierOrganizationId: organizationId } }),
      this.db.supplierOffer.count({ where: { supplierOrganizationId: organizationId, publication: { marketplaceVisible: true } } }),
    ], { isolationLevel: "RepeatableRead" });
    return { orders, offers, publishedOffers };
  }
}
