import { describe, expect, it, vi } from "vitest";
import { BuyerSupplierAgreementsService } from "./buyer-supplier-agreements.service";

describe("current buyer-supplier agreement", () => {
  it.each(["future", "expired", "foreign", "active"])("only offers a currently effective agreement for the exact parties: %s", async scenario => {
    const now = Date.now();
    const candidate = {
      supplierOrganizationId: "supplier", buyerOrganizationId: scenario === "foreign" ? "other" : "buyer",
      startsAt: new Date(now + (scenario === "future" ? 60_000 : -60_000)),
      endsAt: new Date(now + (scenario === "expired" ? -30_000 : 120_000)),
    };
    const prisma = {
      organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) },
      organization: { findFirst: vi.fn().mockResolvedValue({ id: "party" }) },
      buyerSupplierAgreement: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(async ({ where }) =>
          candidate.supplierOrganizationId === where.supplierOrganizationId &&
          candidate.buyerOrganizationId === where.buyerOrganizationId &&
          (!where.startsAt || candidate.startsAt <= where.startsAt.lte) && candidate.endsAt > where.endsAt.gt
            ? candidate : null),
      },
    };
    const service = new BuyerSupplierAgreementsService(prisma as never, {} as never);
    const result = await service.current("supplier", "buyer", { actorId: "actor", organizationId: "buyer" });
    expect(result.frameworkAgreementAvailable).toBe(scenario === "active");
    expect(result.oneTimeDealAvailable).toBe(true);
  });
});
