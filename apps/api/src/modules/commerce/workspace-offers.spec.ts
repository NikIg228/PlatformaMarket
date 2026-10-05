import { describe, expect, it, vi } from "vitest";
import { workspaceOfferQuerySchema, workspaceInventoryQuerySchema } from "@marketplace/schemas";
import { WorkspaceReadsService } from "./workspace-reads.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";

function fixture() {
  const db = { organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, supplierOffer: { findMany: vi.fn().mockResolvedValue([
    { id: "11111111-1111-4111-8111-111111111111", createdAt: new Date() },
    { id: "22222222-2222-4222-8222-222222222222", createdAt: new Date() },
  ]) } };
  return { db, service: new WorkspaceReadsService(db as unknown as PrismaService) };
}
describe("supplier offer filters", () => {
  it("validates filters and preserves defaults", () => {
    expect(workspaceOfferQuerySchema.parse({})).toEqual({ q: "", limit: 50 });
    for (const input of [{ publication: "wrong" }, { attention: "false" }, { limit: 500 }, { q: "x".repeat(161) }]) expect(workspaceOfferQuerySchema.safeParse(input).success).toBe(false);
    expect(workspaceInventoryQuerySchema.safeParse({ warehouseId: "not-a-uuid" }).success).toBe(false);
  });
  it("combines search, publication and attention before paging inside tenant", async () => {
    const { db, service } = fixture();
    const query = { q: "test", limit: 1, publication: "hidden" as const, attention: "required" as const };
    const result = await service.offers("supplier", query);
    const args = db.supplierOffer.findMany.mock.calls[0][0];
    expect(args.where.supplierOrganizationId).toBe("supplier");
    expect(args.where.OR).toHaveLength(2);
    expect(args.where.AND).toEqual(expect.arrayContaining([
      { OR: [{ publication: { is: null } }, { publication: { is: { marketplaceVisible: false } } }] },
      expect.objectContaining({ OR: expect.arrayContaining([{ prices: { none: { status: "ACTIVE" } } }, { inventoryBalances: { none: {} } }]) }),
    ]));
    expect(args.take).toBe(2); expect(result.items).toHaveLength(1);
    for (const changed of [{ ...query, publication: "published" as const }, { ...query, attention: undefined }]) {
      await expect(service.offers("supplier", { ...changed, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
    }
    await expect(service.offers("another", { ...query, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
  });
  it("rejects non-supplier before reading offers", async () => {
    const { db, service } = fixture(); db.organizationCapability.findUnique.mockResolvedValue(null);
    await expect(service.offers("buyer", { q: "", limit: 50 })).rejects.toThrow("Organization");
    expect(db.supplierOffer.findMany).not.toHaveBeenCalled();
  });
});
