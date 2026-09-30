import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { BackgroundQueueService } from "../../platform/jobs/background-queue.service";
import { InventoryService } from "./inventory.service";
import { lockInventoryBalances } from "./lot-eligibility";
import { expirableOrderStatuses, orderCanExpire } from "./reservation-lifecycle";

const include = { items: { include: { reservation: { include: { externalReservation: true } } } }, transferClaims: true, paymentAllocation: true, shipments: true };

@Injectable()
export class ReservationExpiryService implements OnModuleInit {
  private readonly logger = new Logger(ReservationExpiryService.name);
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly queue: BackgroundQueueService) {}

  onModuleInit() { this.queue.register("inventory.expiry", async () => this.tick()); }
  @Cron("*/30 * * * * *")
  async scheduledTick() {
    if (!await this.queue.enqueue("inventory.expiry", {}, { jobId: `inventory-expiry-${Math.floor(Date.now() / 30000)}` })) await this.tick();
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.expireBatch(new Date());
      if (result.orders || result.standalone) this.logger.log(`Expired local reservations: orders=${result.orders}, standalone=${result.standalone}`);
      return result;
    } finally { this.running = false; }
  }

  async expireBatch(now: Date, limit = 25, supplierOrganizationId?: string) {
    const take = Math.min(Math.max(Math.floor(limit), 1), 25);
    const orders = await this.prisma.supplierOrder.findMany({ where: {
      supplierOrganizationId,
      status: { in: [...expirableOrderStatuses] }, paymentStatus: "UNPAID", paymentAllocation: { is: null }, transferClaims: { none: {} }, shipments: { none: {} },
      checkout: { status: { in: ["COMPLETED", "FAILED"] } },
      items: { some: { reservation: { is: { status: "ACTIVE", expiresAt: { lte: now } } } },
        none: { reservation: { is: { OR: [{ status: "CONSUMED" }, { externalReservation: { isNot: null } }] } } } },
    }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take, select: { id: true } });
    let expiredOrders = 0, standalone = 0;
    for (const { id } of orders) if (await this.expireOrder(id, now)) expiredOrders++;
    const reservations = await this.prisma.inventoryReservation.findMany({ where: {
      supplierOrganizationId,
      status: "ACTIVE", expiresAt: { lte: now }, supplierOrderItemId: null, externalReservation: { is: null },
    }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take, select: { id: true } });
    for (const { id } of reservations) if (await this.expireStandalone(id, now)) standalone++;
    return { orders: expiredOrders, standalone };
  }

  async expireOrder(orderId: string, now: Date) {
    return this.retryOnNextTick(() => this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
      let order = await tx.supplierOrder.findUnique({ where: { id: orderId }, include: { ...include, checkout: true } });
      if (!order || !["COMPLETED", "FAILED"].includes(order.checkout.status) || !orderCanExpire(order, now)) return false;
      await lockInventoryBalances(tx, order.items.flatMap(item => item.reservation ? [item.reservation.inventoryBalanceId] : []));
      order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: { ...include, checkout: true } });
      if (!orderCanExpire(order, now)) return false;
      for (const item of order.items) if (item.reservation?.status === "ACTIVE") await this.release(tx, item.reservation.id, order.supplierOrganizationId);
      await tx.supplierOrderItem.updateMany({ where: { supplierOrderId: order.id }, data: { status: "CANCELLED", decisionReason: "Срок локального резерва истёк до заявления оплаты" } });
      await tx.supplierOrder.update({ where: { id: order.id }, data: { status: order.status === "REJECTED" ? "REJECTED" : "CANCELLED", version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: null, organizationId: order.supplierOrganizationId, action: "order.reservation.expired", entityType: "SupplierOrder", entityId: order.id, after: { reason: "RESERVATION_EXPIRED", evaluatedAt: now.toISOString() } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierOrder", aggregateId: order.id, eventType: "OrderReservationExpired", payload: { supplierOrganizationId: order.supplierOrganizationId, buyerOrganizationId: order.buyerOrganizationId, orderId: order.id, reason: "RESERVATION_EXPIRED" } } });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }));
  }

  async expireStandalone(reservationId: string, now: Date) {
    return this.retryOnNextTick(() => this.prisma.$transaction(async tx => {
      const identity = await tx.inventoryReservation.findUnique({ where: { id: reservationId }, select: { inventoryBalanceId: true } });
      if (!identity) return false;
      await lockInventoryBalances(tx, [identity.inventoryBalanceId]);
      const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: reservationId }, include: { externalReservation: true } });
      if (reservation.status !== "ACTIVE" || reservation.expiresAt > now || reservation.supplierOrderItemId || reservation.externalReservation) return false;
      await this.release(tx, reservation.id, reservation.supplierOrganizationId);
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }));
  }

  private async release(tx: Prisma.TransactionClient, id: string, organizationId: string) {
    await this.inventory.releaseReservationInTransaction(tx, id, { actorId: null, organizationId });
    await tx.inventoryReservation.update({ where: { id }, data: { status: "EXPIRED" } });
    await tx.auditLog.create({ data: { actorId: null, organizationId, action: "inventory.reservation.expired", entityType: "InventoryReservation", entityId: id, after: { status: "EXPIRED", reason: "TTL" } } });
    await tx.outboxEvent.create({ data: { aggregateType: "InventoryReservation", aggregateId: id, eventType: "InventoryReservationExpired", payload: { supplierOrganizationId: organizationId, reservationId: id } } });
  }

  private async retryOnNextTick(action: () => Promise<boolean>) {
    try { return await action(); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" ||
        (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))) return false;
      throw error;
    }
  }
}
