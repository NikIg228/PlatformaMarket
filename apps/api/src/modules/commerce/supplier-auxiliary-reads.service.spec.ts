import { describe, expect, it, vi } from "vitest";
import { SupplierAuxiliaryReadsService } from "./supplier-auxiliary-reads.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";

const query = { limit: 1, q: "" };
const rows = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"].map(id => ({ id, createdAt: new Date("2026-01-01T00:00:00Z") }));
function fixture() {
  const db = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue({ capability: "SUPPLIER" }) },
    inventoryBalance: { findFirst: vi.fn().mockResolvedValue({ id: "balance-a" }), findMany: vi.fn().mockResolvedValue(rows) },
    inventoryLot: { findMany: vi.fn().mockResolvedValue(rows) },
    inventoryReservation: { findMany: vi.fn().mockResolvedValue(rows) },
    supplierOffer: { findMany: vi.fn().mockResolvedValue(rows) },
    dataOverride: { findMany: vi.fn().mockResolvedValue(rows) },
  };
  return { db, reads: new SupplierAuxiliaryReadsService(db as unknown as PrismaService) };
}
describe("bounded supplier auxiliary reads", () => {
  it("caps each database read and keeps summary graphs free of nested lists", async () => {
    const { db, reads } = fixture();
    for (const [operation, model] of [["correctionOffers", "supplierOffer"], ["inventory", "inventoryBalance"], ["overrides", "dataOverride"]] as const) {
      const result = await reads[operation]("tenant-a", query);
      expect(result.items).toHaveLength(1); expect(result.nextCursor).toBeTruthy();
      const args = db[model].findMany.mock.calls[0][0];
      expect(args.take).toBe(2); expect(args.where.supplierOrganizationId).toBe("tenant-a");
      expect(args.include).toBeUndefined();
      for (const field of ["lots", "reservations", "prices", "inventoryBalances"]) expect(args.select[field]).toBeUndefined();
      await expect(reads[operation]("tenant-b", { ...query, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
      await expect(reads[operation]("tenant-a", { ...query, q: "changed", cursor: result.nextCursor! })).rejects.toThrow("Cursor");
    }
  });
  it("checks capability before any business read", async () => {
    const { db, reads } = fixture(); db.organizationCapability.findUnique.mockResolvedValue(null);
    await expect(reads.inventory("buyer", query)).rejects.toThrow("Organization");
    await expect(reads.correctionOffers("buyer", query)).rejects.toThrow("Organization");
    await expect(reads.lots("buyer", "balance", query)).rejects.toThrow("Organization");
    expect(db.inventoryBalance.findMany).not.toHaveBeenCalled(); expect(db.inventoryBalance.findFirst).not.toHaveBeenCalled(); expect(db.supplierOffer.findMany).not.toHaveBeenCalled();
  });
  it("rejects a foreign parent before reading details and scopes every child query", async () => {
    const { db, reads } = fixture();
    for (const [operation, model] of [["lots", "inventoryLot"], ["reservations", "inventoryReservation"]] as const) {
      db.inventoryBalance.findFirst.mockResolvedValueOnce(null);
      await expect(reads[operation]("tenant-a", "foreign", query)).rejects.toThrow("not found");
      expect(db[model].findMany).not.toHaveBeenCalled();
      const result = await reads[operation]("tenant-a", "balance-a", query);
      expect(db.inventoryBalance.findFirst).toHaveBeenLastCalledWith({ where: { id: "balance-a", supplierOrganizationId: "tenant-a" }, select: { id: true } });
      expect(db[model].findMany.mock.calls[0][0]).toMatchObject({ take: 2, where: { supplierOrganizationId: "tenant-a", inventoryBalanceId: "balance-a" } });
      await expect(reads[operation]("tenant-a", "balance-b", { ...query, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
    }
    expect(db.inventoryReservation.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
  });
});
