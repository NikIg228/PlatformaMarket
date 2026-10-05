import { describe, expect, it, vi } from "vitest";
import { promotionListQuerySchema } from "@marketplace/schemas";
import { PromotionsService } from "./promotions.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierTermsService } from "../agreements/supplier-terms.service";
import type { AccessControlService } from "../access-control/access-control.service";

describe("supplier promotion phase list", () => {
  function setup() {
    const db = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, promotion: {
      fields: { quantityLimit: "quantity-field", termsRevision: "revision-field" },
      findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0),
    } };
    return { db, service: new PromotionsService(db as unknown as PrismaService, {} as SupplierTermsService, {} as AccessControlService) };
  }
  it("validates phase and rejects cross-tenant selection before reading", async () => {
    expect(promotionListQuerySchema.safeParse({ phase: "wrong" }).success).toBe(false);
    const { db, service } = setup();
    await expect(service.list(promotionListQuerySchema.parse({ supplierOrganizationId: "11111111-1111-4111-8111-111111111111" }), { actorId: "actor", organizationId: "own" })).rejects.toThrow("Акции не найдены");
    expect(db.promotion.findMany).not.toHaveBeenCalled();
  });
  it.each(["ACTIVE", "SCHEDULED", "ENDED"] as const)("filters %s before offset and uses identical count predicates", async phase => {
    const { db, service } = setup();
    const result = await service.list(promotionListQuerySchema.parse({ phase, offset: 10, limit: 10 }), { actorId: "actor", organizationId: "own" });
    const args = db.promotion.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ where: { supplierOrganizationId: "own" }, skip: 10, take: 10 });
    expect(db.promotion.count).toHaveBeenCalledWith({ where: args.where });
    expect(result).toEqual({ items: [], total: 0, limit: 10, offset: 10 });
    if (phase === "ENDED") expect(args.where.OR).toContainEqual({ claimedQuantity: { gte: "quantity-field" } });
    else {
      expect(args.where.AND[0]).toEqual({ status: "ACTIVE", moderationStatus: "APPROVED", approvedRevision: { equals: "revision-field" } });
      expect(args.where.AND[2].startsAt[phase === "ACTIVE" ? "lte" : "gt"]).toBeInstanceOf(Date);
    }
  });
});
