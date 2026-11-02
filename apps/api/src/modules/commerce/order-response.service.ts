import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { orderResponseCalendarSchema } from "@marketplace/schemas";
import { BackgroundQueueService } from "../../platform/jobs/background-queue.service";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { supplierResponseDeadline } from "./supplier-calendar-rules";
import { responseStageEffect, responseSupportCase } from "./order-response-effects";

@Injectable()
export class OrderResponseService implements OnModuleInit {
  private readonly logger = new Logger(OrderResponseService.name);
  private running = false;
  private afterId: string | null = null;
  constructor(private readonly prisma: PrismaService, private readonly queue: BackgroundQueueService) {}

  onModuleInit() { this.queue.register("orders.response", async () => this.tick()); }

  @Cron("0 * * * * *")
  async scheduledTick() {
    if (!await this.queue.enqueue("orders.response", {}, { jobId: `orders-response-${Math.floor(Date.now() / 60000)}` })) await this.tick();
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const eligible: Prisma.SupplierOrderWhereInput = { status: "AWAITING_CONFIRMATION", responseReceivedAt: null,
        responseEscalatedAt: null, responseStartedAt: { lte: new Date(now.getTime() - 45 * 60000) },
        responseDeadlineAt: { not: null }, checkout: { status: "COMPLETED" } };
      const batch = () => this.prisma.supplierOrder.findMany({ where: { ...eligible, ...(this.afterId ? { id: { gt: this.afterId } } : {}) },
        select: { id: true }, orderBy: { id: "asc" }, take: 100 });
      let orders = await batch();
      if (!orders.length && this.afterId) { this.afterId = null; orders = await batch(); }
      for (const order of orders) {
        try { await this.processOrder(order.id, now); }
        catch (error) { this.logger.error(`Response timer failed for ${order.id}: ${error instanceof Error ? error.name : "Error"}`); }
        this.afterId = order.id;
      }
    } finally { this.running = false; }
  }

  async processOrder(orderId: string, now: Date) {
    if (!Number.isFinite(now.getTime())) throw new RangeError("Expected a valid evaluation time");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.supplierOrder.findUnique({ where: { id: orderId }, include: { checkout: { include: { cart: true } } } });
      if (!order || order.status !== "AWAITING_CONFIRMATION" || order.checkout.status !== "COMPLETED" || order.responseReceivedAt ||
          order.responseEscalatedAt || !order.responseStartedAt || !order.responseDeadlineAt) return;
      const { calendar } = orderResponseCalendarSchema.parse(order.responseCalendar);
      const reminderAt = supplierResponseDeadline(order.responseStartedAt, calendar, 45);
      if (now < reminderAt) return;
      const changes: Prisma.SupplierOrderUncheckedUpdateInput = {};
      if (!order.responseRemindedAt) {
        await responseStageEffect(tx, order, "REMINDER", now);
        changes.responseRemindedAt = now;
      }
      if (now >= order.responseDeadlineAt && !order.responseOverdueAt) {
        await responseStageEffect(tx, order, "OVERDUE", now);
        changes.responseOverdueAt = now;
      }
      if (now >= supplierResponseDeadline(order.responseStartedAt, calendar, 120)) {
        const requesterId = order.checkout.cart.createdById;
        if (!requesterId) throw new Error("Order response escalation requires the original requester");
        changes.responseSupportTicketId = await responseSupportCase(tx, order, requesterId, now);
        changes.responseEscalatedAt = now;
        await responseStageEffect(tx, order, "ESCALATED", now);
      }
      if (Object.keys(changes).length) await tx.supplierOrder.update({ where: { id: order.id }, data: changes });
    }, { timeout: 15000 });
  }
}
