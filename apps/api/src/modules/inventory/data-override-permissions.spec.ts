import { ForbiddenException, NotFoundException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createDataOverrideSchema } from "@marketplace/schemas";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessControlService } from "../access-control/access-control.service";
import { PermissionsGuard } from "../access-control/permissions.guard";
import { SupplierAccessService } from "../suppliers/supplier-access.service";
import { DataFreshnessService } from "./data-freshness.service";
import { InventoryController } from "./inventory.controller";

const supplier = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
const offerId = "00000000-0000-4000-8000-000000000003";
const balanceId = "00000000-0000-4000-8000-000000000004";
const foreign = "00000000-0000-4000-8000-000000000005";
const modes = ["PERMANENT", "UNTIL_DATE", "ONE_TIME", "UNTIL_NEXT_SYNC"] as const;
type Target = "PRICE" | "INVENTORY";

afterEach(() => vi.unstubAllEnvs());

function priceBody(amountMinor: string | number = "9007199254740993", mode: typeof modes[number] = "PERMANENT") {
  return { target: "PRICE", offerId, mode, value: { amountMinor, currency: "KZT" }, reason: "Synthetic price override", validUntil: "2099-01-01T00:00:00.000Z" };
}
const inventoryBody = () => ({ target: "INVENTORY", inventoryBalanceId: balanceId, mode: "PERMANENT", value: { quantityOnHand: 20 }, reason: "Synthetic stock override" });

function fixture(grants = ["inventory.adjust"], target: Target = "PRICE", options: { active?: boolean; operator?: boolean } = {}) {
  vi.stubEnv("ACCESS_CONTROL_MODE", "ROLE_BASED");
  const organizationId = options.operator ? foreign : supplier;
  const context = { actorId: actor, organizationId };
  const current = { id: "old-override", supplierOrganizationId: supplier, offerId, inventoryBalanceId: balanceId, target, status: "ACTIVE", mode: "PERMANENT" };
  const tx = {
    $queryRaw: vi.fn(),
    supplierVatSettings: { findUnique: vi.fn(async () => null) },
    dataOverride: {
      update: vi.fn(async ({ data }: { data: object }) => ({ ...current, ...data })),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "new-override", ...data })),
    },
    offerPrice: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: object }) => ({ id: "new-price", ...data })),
    },
    offerPriceHistory: { create: vi.fn(async () => ({ id: "history" })) },
    supplierOffer: { update: vi.fn(async () => ({ id: offerId })) },
    inventoryBalance: { update: vi.fn(async () => ({ id: balanceId })) },
    auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    outboxEvent: { create: vi.fn(async () => ({ id: "outbox" })) },
  };
  const prisma = {
    organizationCapability: { findUnique: vi.fn(async () => options.operator ? { capability: "MARKETPLACE_OPERATOR" } : null) },
    supplierOffer: { findFirst: vi.fn(async ({ where }: { where: { id: string; supplierOrganizationId: string } }) =>
      where.id === offerId && where.supplierOrganizationId === supplier ? { id: offerId } : null) },
    inventoryBalance: { findFirst: vi.fn(async () => ({ id: balanceId, quantityReserved: 2, safetyStock: 3 })) },
    dataOverride: { findFirst: vi.fn(async () => current), update: tx.dataOverride.update },
    auditLog: tx.auditLog,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  type PermissionClause = { roles?: { some: { role: { organizationId: string; permissions: { some: { permission: { code: string } } } } } } };
  const findMembership = vi.fn(async ({ where }: { where: { userId: string; organizationId: string; status: string; user: { status: string }; organization: { status: string }; AND: PermissionClause[] } }) => {
    if (options.active === false || where.userId !== actor || where.organizationId !== organizationId) return null;
    if (where.status !== "ACTIVE" || where.user.status !== "ACTIVE" || where.organization.status !== "ACTIVE") return null;
    return where.AND.every((clause) => !clause.roles ||
      (clause.roles.some.role.organizationId === organizationId && grants.includes(clause.roles.some.role.permissions.some.permission.code))) ? { id: "active-membership" } : null;
  });
  const permissions = new AccessControlService({ organizationMembership: { findFirst: findMembership } } as never);
  const hasAll = vi.spyOn(permissions, "hasAll");
  const service = new DataFreshnessService(prisma as never, new SupplierAccessService(prisma as never), permissions);
  const controller = new InventoryController({} as never, {} as never, service);
  const guard = new PermissionsGuard(new Reflector(), permissions);
  const authorize = (handler: (...args: never[]) => unknown) => guard.canActivate({
    getHandler: () => handler, getClass: () => InventoryController,
    switchToHttp: () => ({ getRequest: () => ({ header: (name: string) => name === "x-user-id" ? actor : organizationId }) }),
  } as unknown as ExecutionContext);
  const create = async (body: unknown) => { await authorize(controller.createOverride); return controller.createOverride(supplier, body, actor, organizationId); };
  const cancel = async () => { await authorize(controller.cancelOverride); return controller.cancelOverride(supplier, current.id, actor, organizationId); };
  const expectNoWrites = () => {
    expect(prisma.$transaction).not.toHaveBeenCalled();
    for (const write of [tx.dataOverride.create, tx.dataOverride.update, tx.offerPrice.updateMany, tx.offerPrice.create,
      tx.offerPriceHistory.create, tx.supplierOffer.update, tx.inventoryBalance.update, tx.auditLog.create, tx.outboxEvent.create]) expect(write).not.toHaveBeenCalled();
  };
  return { prisma, tx, service, controller, context, permissions, hasAll, findMembership, create, cancel, expectNoWrites };
}

describe("manual override permissions", () => {
  it.each(modes.flatMap((mode) => ["9007199254740993", 1200].map((amount) => ({ mode, amount }))))("denies inventory-only PRICE creation in $mode mode with amount $amount", async ({ mode, amount }) => {
      const f = fixture();
      expect(await f.permissions.hasAll(actor, supplier, ["pricing.manage"])).toBe(false);
      await expect(f.create(priceBody(amount, mode))).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.hasAll).toHaveBeenCalledWith(actor, supplier, ["inventory.adjust", "pricing.manage"]);
      expect(f.prisma.supplierOffer.findFirst).not.toHaveBeenCalled();
      f.expectNoWrites();
  });

  it("enforces the same PRICE permission for direct service calls", async () => {
    const f = fixture();
    await expect(f.service.createOverride(supplier, createDataOverrideSchema.parse(priceBody()), f.context)).rejects.toBeInstanceOf(ForbiddenException);
    f.expectNoWrites();
  });

  it("denies inventory-only cancellation of PRICE sync protection", async () => {
    const f = fixture();
    await expect(f.cancel()).rejects.toBeInstanceOf(ForbiddenException);
    f.expectNoWrites();
  });

  it.each<Target>(["PRICE", "INVENTORY"])("keeps inventory.adjust mandatory on direct %s create and cancel", async (target) => {
    const f = fixture(target === "PRICE" ? ["pricing.manage"] : [], target);
    const body = target === "PRICE" ? priceBody() : inventoryBody();
    await expect(f.service.createOverride(supplier, createDataOverrideSchema.parse(body), f.context)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.cancelOverride(supplier, "old-override", f.context)).rejects.toBeInstanceOf(ForbiddenException);
    f.expectNoWrites();
  });

  it.each(modes)("preserves authorized PRICE creation and exact minor units in %s mode", async (mode) => {
    const f = fixture(["inventory.adjust", "pricing.manage"]);
    await expect(f.create(priceBody("9007199254740993", mode))).resolves.toMatchObject({ target: "PRICE", mode });
    expect(f.tx.offerPrice.create).toHaveBeenCalledOnce();
    expect(f.tx.offerPrice.create.mock.calls[0][0].data).toMatchObject({ amountMinor: expect.anything(), currency: "KZT" });
    expect(String((f.tx.offerPrice.create.mock.calls[0][0].data as { amountMinor: unknown }).amountMinor)).toBe("9007199254740993");
    expect(f.tx.offerPriceHistory.create).toHaveBeenCalledOnce();
    expect(f.tx.supplierOffer.update).toHaveBeenCalledWith({ where: { id: offerId }, data: { version: { increment: 1 } } });
    expect(f.tx.dataOverride.update).toHaveBeenCalledWith({ where: { id: "old-override" }, data: expect.objectContaining({ status: "CANCELLED" }) });
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce();
    expect(f.tx.outboxEvent.create).toHaveBeenCalledOnce();
    expect(f.tx.inventoryBalance.update).not.toHaveBeenCalled();
  });

  it("preserves numeric amount normalization for an authorized PRICE override", async () => {
    const f = fixture(["inventory.adjust", "pricing.manage"]);
    await f.create(priceBody(1200));
    expect(String((f.tx.offerPrice.create.mock.calls[0][0].data as { amountMinor: unknown }).amountMinor)).toBe("1200");
  });

  it("preserves inventory-only creation and cancellation; extra price fields cannot reach price writes", async () => {
    const f = fixture(undefined, "INVENTORY");
    await f.create({ ...inventoryBody(), offerId, value: { quantityOnHand: 20, amountMinor: "1", currency: "KZT" } });
    expect(f.tx.inventoryBalance.update).toHaveBeenCalledWith({ where: { id: balanceId }, data: expect.objectContaining({ quantityAvailable: 15 }) });
    expect(f.tx.offerPrice.create).not.toHaveBeenCalled();
    expect(f.tx.offerPrice.updateMany).not.toHaveBeenCalled();
    expect(f.tx.offerPriceHistory.create).not.toHaveBeenCalled();
    await expect(f.cancel()).resolves.toMatchObject({ status: "CANCELLED", target: "INVENTORY" });
    expect(f.hasAll).toHaveBeenCalledWith(actor, supplier, ["inventory.adjust"]);
  });

  it("preserves authorized PRICE cancellation and audit", async () => {
    const f = fixture(["inventory.adjust", "pricing.manage"]);
    await expect(f.cancel()).resolves.toMatchObject({ target: "PRICE", status: "CANCELLED" });
    expect(f.tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "data.override.cancelled", actorId: actor, organizationId: supplier }) });
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects foreign supplier operations even with both permissions", async () => {
    const f = fixture(["inventory.adjust", "pricing.manage"]);
    const context = { actorId: actor, organizationId: foreign };
    await expect(f.service.createOverride(supplier, createDataOverrideSchema.parse(priceBody()), context)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.cancelOverride(supplier, "old-override", context)).rejects.toBeInstanceOf(ForbiddenException);
    f.expectNoWrites();
  });

  it("keeps foreign offer IDs scoped after authorization", async () => {
    const f = fixture(["inventory.adjust", "pricing.manage"]);
    await expect(f.create({ ...priceBody(), offerId: foreign })).rejects.toBeInstanceOf(NotFoundException);
    f.expectNoWrites();
  });

  it("uses operator actor organization for existing cross-supplier access", async () => {
    const f = fixture(["inventory.adjust", "pricing.manage"], "PRICE", { operator: true });
    await f.create(priceBody());
    expect(f.hasAll).toHaveBeenCalledWith(actor, foreign, ["inventory.adjust", "pricing.manage"]);
    expect(f.tx.offerPrice.create).toHaveBeenCalledOnce();
  });

  it("retains FULL_ACCESS semantics for active members without granting inactive members access", async () => {
    const allowed = fixture([]);
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    await allowed.create(priceBody());
    const inactive = fixture([], "PRICE", { active: false });
    vi.stubEnv("ACCESS_CONTROL_MODE", "FULL_ACCESS");
    await expect(inactive.create(priceBody())).rejects.toBeInstanceOf(ForbiddenException);
    inactive.expectNoWrites();
  });
});
