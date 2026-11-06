import { randomInt, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma, PrismaClient, type InventoryLot } from "@prisma/client";
import { expect, it } from "vitest";
import { createInventoryLotSchema } from "@marketplace/schemas";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { SupplierAccessService } from "../suppliers/supplier-access.service";
import { DataFreshnessService } from "./data-freshness.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("lot creation PostgreSQL: concurrent capacity, fresh balance, tenant denial and atomic rollback", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/dentmarket_audit_20260914" ||
    process.env.DATABASE_URL !== process.env.POSTGRES_TEST_DATABASE_URL) throw new Error("Isolated inventory test database required");
  target.searchParams.set("connection_limit", "8");
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  const supplierId = randomUUID(), otherId = randomUUID(), warehouseId = randomUUID(), productId = randomUUID();
  const context = { actorId: randomUUID(), organizationId: supplierId };
  const balanceIds: string[] = [], variantIds: string[] = [];
  const domain = (client: PrismaClient) => {
    const prisma = client as unknown as PrismaService;
    const access = new SupplierAccessService(prisma);
    return new InventoryService(prisma, access, new DataFreshnessService(prisma, access, new AccessControlService(prisma)));
  };
  const service = domain(db);
  const input = (inventoryBalanceId: string, quantityOnHand: number) => createInventoryLotSchema.parse({
    inventoryBalanceId, lotNumber: randomUUID(), quantityOnHand, status: "ACTIVE",
  });
  const balance = async (quantity: number) => {
    const variant = await db.productVariant.create({ data: { productId } });
    variantIds.push(variant.id);
    const row = await db.inventoryBalance.create({ data: { supplierOrganizationId: supplierId, warehouseId,
      productVariantId: variant.id, quantityOnHand: quantity, quantityAvailable: quantity } });
    balanceIds.push(row.id);
    return row;
  };
  const counts = async (id: string) => ({
    lots: await db.inventoryLot.count({ where: { inventoryBalanceId: id } }),
    audit: await db.auditLog.count({ where: { actorId: context.actorId, action: "inventory.lot.created" } }),
    outbox: await db.outboxEvent.count({ where: { eventType: "InventoryLotCreated", payload: { path: ["supplierOrganizationId"], equals: supplierId } } }),
  });
  const race = async (id: string, quantities: number[], updatedQuantity?: number) => {
    const pids: number[] = [];
    const client = new Proxy(db, { get: (targetDb, property, receiver) => property === "$transaction"
      ? (run: (tx: Prisma.TransactionClient) => Promise<InventoryLot>, options: { isolationLevel?: Prisma.TransactionIsolationLevel }) =>
        targetDb.$transaction(async tx => {
          pids.push((await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid);
          return run(tx);
        }, { ...options, timeout: 15_000 })
      : Reflect.get(targetDb, property, receiver) });
    const concurrentService = domain(client);
    let requests: Promise<PromiseSettledResult<InventoryLot>[]> | undefined;
    let blockerError: unknown;
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "InventoryBalance" WHERE id = ${id}::uuid FOR UPDATE`;
        if (updatedQuantity !== undefined) await tx.inventoryBalance.update({ where: { id }, data: { quantityOnHand: updatedQuantity, quantityAvailable: updatedQuantity } });
        requests = Promise.allSettled(quantities.map(quantity => concurrentService.createLot(supplierId, input(id, quantity), context)));
        // Prove both database sessions actually contend on the row before releasing it.
        const deadline = Date.now() + 5_000;
        let waiting = 0;
        do {
          if (pids.length === quantities.length) {
            waiting = (await db.$queryRaw<Array<{ count: number }>>`
              SELECT count(*)::int AS count FROM pg_stat_activity
              WHERE pid IN (${Prisma.join(pids)}) AND cardinality(pg_blocking_pids(pid)) > 0
            `)[0].count;
          }
          if (waiting === quantities.length) break;
          await delay(20);
        } while (Date.now() < deadline);
        expect(waiting).toBe(quantities.length);
      }, { timeout: 10_000 });
    } catch (error) { blockerError = error; }
    const result = await requests;
    if (blockerError) throw blockerError;
    return result!;
  };
  try {
    expect((await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    await db.organization.createMany({ data: [supplierId, otherId].map(id => ({ id, legalName: "Synthetic lot concurrency", displayName: "Synthetic lot concurrency", bin: String(randomInt(100_000_000_000, 999_999_999_999)) })) });
    await db.supplierProfile.create({ data: { organizationId: supplierId } });
    await db.warehouse.create({ data: { id: warehouseId, supplierOrganizationId: supplierId, code: randomUUID(), name: "Synthetic lot concurrency" } });
    await db.product.create({ data: { id: productId, canonicalName: "Synthetic lot concurrency", slug: randomUUID(), productType: "CONSUMABLE" } });

    const over = await balance(10), beforeOver = await counts(over.id);
    const oversubscribed = await race(over.id, [7, 7]);
    expect(oversubscribed.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = oversubscribed.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.getStatus()).toBe(400);
    expect(rejected.reason.message).toContain("Total lot quantity cannot exceed warehouse balance");
    expect((await db.inventoryLot.aggregate({ where: { inventoryBalanceId: over.id }, _sum: { quantityOnHand: true } }))._sum.quantityOnHand?.toString()).toBe("7");
    expect(await counts(over.id)).toEqual({ lots: 1, audit: beforeOver.audit + 1, outbox: beforeOver.outbox + 1 });

    const fits = await balance(10);
    expect((await race(fits.id, [4, 6])).every(result => result.status === "fulfilled")).toBe(true);
    expect((await db.inventoryLot.aggregate({ where: { inventoryBalanceId: fits.id }, _sum: { quantityOnHand: true } }))._sum.quantityOnHand?.toString()).toBe("10");

    const changed = await balance(10), beforeChanged = await counts(changed.id);
    const afterUpdate = await race(changed.id, [7], 6);
    expect(afterUpdate[0].status).toBe("rejected");
    expect((afterUpdate[0] as PromiseRejectedResult).reason.getStatus()).toBe(400);
    expect(await counts(changed.id)).toEqual(beforeChanged);

    const fractional = await balance(0.3);
    await service.createLot(supplierId, input(fractional.id, 0.1), context);
    await service.createLot(supplierId, input(fractional.id, 0.2), context);
    expect((await db.inventoryLot.aggregate({ where: { inventoryBalanceId: fractional.id }, _sum: { quantityOnHand: true } }))._sum.quantityOnHand?.toString()).toBe("0.3");

    const denied = await balance(10), beforeDenied = await counts(denied.id);
    await expect(service.createLot(supplierId, input(denied.id, 1), { ...context, organizationId: otherId })).rejects.toMatchObject({ status: 403 });
    await expect(service.createLot(otherId, input(denied.id, 1), { ...context, organizationId: otherId })).rejects.toMatchObject({ status: 404 });
    await expect(service.createLot(supplierId, { ...input(denied.id, 1), offerId: randomUUID() }, context)).rejects.toMatchObject({ status: 404 });
    const controller = new InventoryController(service, {} as never, {} as never);
    expect(() => controller.createLot(supplierId, { ...input(denied.id, 1), quantityOnHand: -1 }, context.actorId, supplierId)).toThrow();
    expect(await counts(denied.id)).toEqual(beforeDenied);

    const rollback = await balance(10), beforeRollback = await counts(rollback.id);
    const failing = db.$extends({ query: { outboxEvent: { create: async () => { throw new Error("Synthetic outbox failure"); } } } });
    await expect(domain(failing as unknown as PrismaClient).createLot(supplierId, input(rollback.id, 3), context)).rejects.toThrow("Synthetic outbox failure");
    expect(await counts(rollback.id)).toEqual(beforeRollback);
    await service.createLot(supplierId, input(rollback.id, 3), context);
    expect(await counts(rollback.id)).toEqual({ lots: 1, audit: beforeRollback.audit + 1, outbox: beforeRollback.outbox + 1 });
  } finally {
    await db.outboxEvent.deleteMany({ where: { eventType: "InventoryLotCreated", payload: { path: ["supplierOrganizationId"], equals: supplierId } } });
    await db.auditLog.deleteMany({ where: { actorId: context.actorId } });
    await db.inventoryLot.deleteMany({ where: { inventoryBalanceId: { in: balanceIds } } });
    await db.inventoryBalance.deleteMany({ where: { id: { in: balanceIds } } });
    await db.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.warehouse.deleteMany({ where: { id: warehouseId } });
    await db.organization.deleteMany({ where: { id: { in: [supplierId, otherId] } } });
    await db.$disconnect();
  }
}, 60_000);
