import { describe, expect, it, vi } from "vitest";
import { ComplianceService } from "./compliance.service";

describe("compliance evaluation versus publication authority", () => {
  function fixture(operator = false, variant = "variant") {
    const publication = { update: vi.fn() };
    const tx = { complianceCheck: { create: vi.fn(async ({ data }) => ({ id: "check", ...data })), update: vi.fn().mockResolvedValue({ id: "check", status: "PASSED" }) },
      offerPublication: publication, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
    const prisma = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? {} : null) },
      organization: { findUnique: vi.fn(async ({ where }) => ({ id: where.id, capabilities: [], credentials: [], supplierProfile: null })) },
      supplierOffer: { findUnique: vi.fn().mockResolvedValue({ id: "offer", supplierOrganizationId: "seller", productVariantId: "variant", publication: { status: "PUBLISHED" },
        productVariant: { product: { id: "product", categories: [], industries: [] } } }) },
      inventoryLot: { findUnique: vi.fn().mockResolvedValue({ id: "lot", supplierOrganizationId: "seller", productVariantId: variant, status: "ACTIVE", expirationDate: new Date(0) }) },
      complianceRule: { findMany: vi.fn().mockResolvedValue([]) },
      complianceCheck: { findUnique: vi.fn().mockResolvedValue({ id: "check", status: "REVIEW_REQUIRED", inputSnapshot: { authoritative: false }, offer: { id: "offer", publication: {} } }) },
      $transaction: vi.fn(async cb => cb(tx)) };
    return { service: new ComplianceService(prisma as never, {} as never), publication, tx };
  }
  const input = { sellerOrganizationId: "seller", buyerOrganizationId: "buyer", offerId: "offer", inventoryLotId: "lot" };
  it("denies the sibling global rule-recheck entry before inspecting any foreign data", async () => {
    const f = fixture();
    await expect(f.service.recheckRule("rule", { actorId: "actor", organizationId: "buyer" })).rejects.toThrow(/operators/);
    expect(f.publication.update).not.toHaveBeenCalled();
    expect(f.tx.complianceCheck.create).not.toHaveBeenCalled();
  });
  it("buyer future-date evaluation can deny its check but never hide seller publication", async () => {
    const f = fixture();
    await expect(f.service.evaluate({ ...input, at: "2099-01-01T00:00:00Z" }, { actorId: "actor", organizationId: "buyer" })).resolves.toMatchObject({ status: "BLOCKED", inputSnapshot: { authoritative: false } });
    expect(f.publication.update).not.toHaveBeenCalled();
  });
  it("operator hypothetical dates are also non-authoritative", async () => {
    const f = fixture(true);
    await f.service.evaluate({ ...input, at: "2099-01-01T00:00:00Z" }, { actorId: "actor", organizationId: "operator" });
    expect(f.publication.update).not.toHaveBeenCalled();
  });
  it("seller/current evaluation still blocks an actually expired own offer", async () => {
    const f = fixture();
    await f.service.evaluate(input, { actorId: "actor", organizationId: "seller" });
    expect(f.publication.update).toHaveBeenCalledWith(expect.objectContaining({ where: { offerId: "offer" }, data: expect.objectContaining({ status: "BLOCKED" }) }));
  });
  it("rejects another variant's lot before recording a check", async () => {
    const f = fixture(false, "other-variant");
    await expect(f.service.evaluate(input, { actorId: "actor", organizationId: "buyer" })).rejects.toThrow(/variant/);
    expect(f.tx.complianceCheck.create).not.toHaveBeenCalled();
  });
  it("manual review cannot promote a hypothetical check into global publication", async () => {
    const f = fixture(true);
    await f.service.reviewCheck("check", { decision: "ALLOWED", comment: "review" }, { actorId: "actor", organizationId: "operator" });
    expect(f.publication.update).not.toHaveBeenCalled();
  });
});
