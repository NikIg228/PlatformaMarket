import { describe, expect, it, vi } from "vitest";
import { OffersService } from "./offers.service";
import { ImportsService } from "../imports/imports.service";
import { Prisma } from "@prisma/client";
import { lockCatalogVariantForAdoption } from "../catalog/catalog-adoption";

function fixture(variantStatus = "ACTIVE", productStatus = "ACTIVE") {
  const current = { id: "variant", productId: "product", status: variantStatus, product: { status: productStatus } };
  const tx = { $executeRaw: vi.fn(async () => 1), productVariant: { findUnique: vi.fn(async () => ({ productId: "product" })), findFirst: vi.fn(async () => current) },
    supplierOffer: { create: vi.fn(async () => ({ id: "offer", productVariant: current })) }, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
  const prisma = { productVariant: { findUnique: vi.fn(async () => ({ ...current, status: "ACTIVE" })) }, supplierOffer: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  const access = { assertCanManage: vi.fn(), requireProfile: vi.fn() };
  const service = new OffersService(prisma as never, access as never, {} as never, {} as never, {} as never);
  const create = () => service.create("supplier", { productVariantId: "variant", sourceType: "MANUAL", baseUnitsPerSaleUnit: "1", minimumOrderQuantity: "1", orderIncrement: "1", confirmationMode: "AUTO" } as never, { actorId: "actor", organizationId: "supplier" });
  return { tx, prisma, create };
}

describe("supplier offer adoption versus catalog rollback", () => {
  it.each([["ARCHIVED", "ACTIVE"], ["ACTIVE", "ARCHIVED"]])("revalidates stale catalog reads (%s/%s) before insert", async (variantStatus, productStatus) => {
    const f = fixture(variantStatus, productStatus);
    await expect(f.create()).rejects.toMatchObject({ status: 409 });
    expect(f.tx.supplierOffer.create).not.toHaveBeenCalled();
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
    expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
  });
  it.each(["ACTIVE", "DRAFT", "UNDER_REVIEW"])("preserves nonarchived %s adoption without requiring a new publication policy", async (status) => {
    const f = fixture(status);
    await expect(f.create()).resolves.toMatchObject({ id: "offer" });
    expect(f.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(f.tx.productVariant.findFirst).toHaveBeenCalledOnce();
    expect(f.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(f.tx.productVariant.findFirst.mock.invocationCallOrder[0]);
    expect(f.tx.productVariant.findFirst.mock.invocationCallOrder[0]).toBeLessThan(f.tx.supplierOffer.create.mock.invocationCallOrder[0]);
  });
  it.each(["40001", "40P01"])("keeps raw PostgreSQL %s adoption conflicts as HTTP 409", async (code) => {
    const f = fixture();
    f.prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Synthetic catalog conflict", { code: "P2010", clientVersion: "test", meta: { code } }));
    await expect(f.create()).rejects.toMatchObject({ status: 409 });
    expect(f.tx.supplierOffer.create).not.toHaveBeenCalled();
  });
});

describe("manual match catalog adoption", () => {
  it.each(["40001", "40P01"])("sanitizes raw %s at the shared helper for every caller", async (code) => {
    const error = new Prisma.PrismaClientKnownRequestError("Synthetic raw SQL conflict", { code: "P2010", clientVersion: "test", meta: { code } });
    const tx = { productVariant: { findUnique: vi.fn(async () => ({ productId: "product" })) }, $executeRaw: vi.fn().mockRejectedValue(error) };
    await expect(lockCatalogVariantForAdoption(tx as never, "variant")).rejects.toMatchObject({ status: 409 });
  });
  it("does not reinterpret unrelated failures as a retryable conflict", async () => {
    const error = new Error("Synthetic unrelated failure");
    const tx = { productVariant: { findUnique: vi.fn(async () => ({ productId: "product" })) }, $executeRaw: vi.fn().mockRejectedValue(error) };
    await expect(lockCatalogVariantForAdoption(tx as never, "variant")).rejects.toBe(error);
  });
  it.each(["ACTIVE", "ARCHIVED"])("uses the same shared boundary for %s catalog", async (status) => {
    const item = { id: "item", supplierSku: "synthetic", externalId: "synthetic-row", normalizedName: "synthetic" };
    const tx = { $executeRaw: vi.fn(async () => 1), productVariant: { findUnique: vi.fn(async () => ({ productId: "product" })), findFirst: vi.fn(async () => ({ status, product: { status: "ACTIVE" } })) },
      supplierItemMatchCandidate: { updateMany: vi.fn(), upsert: vi.fn() }, supplierExternalItem: { update: vi.fn(async () => ({ ...item, matchedVariantId: "variant" })) },
      supplierMappingMemory: { findFirst: vi.fn(async () => null), create: vi.fn() }, productCandidate: { updateMany: vi.fn() }, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
    const prisma = { supplierExternalItem: { findFirst: vi.fn(async () => item) }, productVariant: { findUnique: vi.fn(async () => ({ id: "variant" })) }, $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
    const service = new ImportsService(prisma as never, { assertCanManage: vi.fn() } as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const result = service.confirmMatch("supplier", "item", { productVariantId: "variant" }, { actorId: "actor", organizationId: "supplier" });
    if (status === "ARCHIVED") {
      await expect(result).rejects.toMatchObject({ status: 409 });
      expect(tx.supplierExternalItem.update).not.toHaveBeenCalled(); expect(tx.supplierMappingMemory.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled(); expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    } else {
      await expect(result).resolves.toMatchObject({ matchedVariantId: "variant" });
      expect(tx.supplierMappingMemory.create).toHaveBeenCalledOnce(); expect(tx.auditLog.create).toHaveBeenCalledOnce(); expect(tx.outboxEvent.create).toHaveBeenCalledOnce();
    }
  });
});
