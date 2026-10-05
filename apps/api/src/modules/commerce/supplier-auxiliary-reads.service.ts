import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { workspacePageQuerySchema, workspaceInventoryQuerySchema } from "@marketplace/schemas";
import { z } from "zod";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { workspaceOrderBy, workspacePage } from "./workspace-page";
import { workspaceOfferSelect } from "./workspace-read-selects";

type Query = z.output<typeof workspacePageQuerySchema>;

@Injectable()
export class SupplierAuxiliaryReadsService {
  constructor(private readonly db: PrismaService) {}

  private async authorize(organizationId: string) {
    const capability = await this.db.organizationCapability.findUnique({ where: {
      organizationId_capability: { organizationId, capability: "SUPPLIER" },
    } });
    if (!capability) throw new ForbiddenException("Organization cannot use this workspace");
  }
  private async balance(organizationId: string, balanceId: string) {
    await this.authorize(organizationId);
    const row = await this.db.inventoryBalance.findFirst({
      where: { id: balanceId, supplierOrganizationId: organizationId }, select: { id: true },
    });
    if (!row) throw new NotFoundException("Inventory balance not found in this workspace");
  }
  async correctionOffers(organizationId: string, query: Query) {
    await this.authorize(organizationId);
    const page = workspacePage([organizationId, "correction-offers", query.q, query.limit], query.cursor);
    const rows = await this.db.supplierOffer.findMany({
      where: { ...page.where, supplierOrganizationId: organizationId,
        ...(query.q ? { productVariant: { product: { canonicalName: { contains: query.q, mode: "insensitive" as const } } } } : {}) },
      select: { id: true, createdAt: true, productVariant: workspaceOfferSelect.productVariant },
      orderBy: [...workspaceOrderBy], take: query.limit + 1,
    });
    return page.finish(rows, query.limit);
  }
  async inventory(organizationId: string, query: z.output<typeof workspaceInventoryQuerySchema>) {
    await this.authorize(organizationId);
    const page = workspacePage([organizationId, "inventory", query.q, query.limit, query.warehouseId], query.cursor);
    const where: Prisma.InventoryBalanceWhereInput = { ...page.where, supplierOrganizationId: organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.q ? { OR: [
        { warehouse: { name: { contains: query.q, mode: "insensitive" } } },
        { productVariant: { product: { canonicalName: { contains: query.q, mode: "insensitive" } } } },
      ] } : {}) };
    const rows = await this.db.inventoryBalance.findMany({ where,
      select: { id: true, offerId: true, createdAt: true, updatedAt: true,
        warehouse: { select: { id: true, name: true } }, productVariant: { select: { product: { select: { canonicalName: true } } } },
        quantityOnHand: true, quantityAvailable: true, quantityReserved: true, safetyStock: true, freshnessStatus: true },
      orderBy: [...workspaceOrderBy], take: query.limit + 1,
    });
    return page.finish(rows, query.limit);
  }
  async lots(organizationId: string, balanceId: string, query: Query) {
    await this.balance(organizationId, balanceId);
    const page = workspacePage([organizationId, balanceId, "lots", query.q, query.limit], query.cursor);
    const rows = await this.db.inventoryLot.findMany({
      where: { ...page.where, supplierOrganizationId: organizationId, inventoryBalanceId: balanceId,
        ...(query.q ? { lotNumber: { contains: query.q, mode: "insensitive" as const } } : {}) },
      select: { id: true, createdAt: true, lotNumber: true, status: true, quantityAvailable: true, expirationDate: true },
      orderBy: [...workspaceOrderBy], take: query.limit + 1,
    });
    return page.finish(rows, query.limit);
  }
  async reservations(organizationId: string, balanceId: string, query: Query) {
    await this.balance(organizationId, balanceId);
    const page = workspacePage([organizationId, balanceId, "reservations", query.q, query.limit], query.cursor);
    const rows = await this.db.inventoryReservation.findMany({
      where: { ...page.where, supplierOrganizationId: organizationId, inventoryBalanceId: balanceId, status: "ACTIVE" },
      select: { id: true, createdAt: true, quantity: true, expiresAt: true,
        supplierOrderItem: { select: { supplierOrder: { select: { id: true, orderNumber: true, supplierOrganizationId: true } } } } },
      orderBy: [...workspaceOrderBy], take: query.limit + 1,
    });
    const result = page.finish(rows, query.limit);
    return { ...result, items: result.items.map(({ supplierOrderItem, ...row }) => {
      const order = supplierOrderItem?.supplierOrder;
      return { ...row, order: order?.supplierOrganizationId === organizationId ? { id: order.id, orderNumber: order.orderNumber } : null };
    }) };
  }
  async overrides(organizationId: string, query: Query) {
    await this.authorize(organizationId);
    const page = workspacePage([organizationId, "overrides", query.q, query.limit], query.cursor);
    const rows = await this.db.dataOverride.findMany({
      where: { ...page.where, supplierOrganizationId: organizationId,
        ...(query.q ? { reason: { contains: query.q, mode: "insensitive" as const } } : {}) },
      select: { id: true, createdAt: true, reason: true, status: true, validUntil: true },
      orderBy: [...workspaceOrderBy], take: query.limit + 1,
    });
    return page.finish(rows, query.limit);
  }
}
