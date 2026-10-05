import { expect, it, vi } from "vitest";
import { ModerationService } from "./moderation.service";

const context = { actorId: "operator", organizationId: "platform" };
const input = { canonicalName: "New unique material", slug: "new-unique-material", productType: "MATERIAL", industryIds: ["industry"], categoryIds: ["category"], saleUnitId: "unit", packageQuantity: 10 };
it("returns submitted description without leaking raw payload and scopes history cursors", async () => {
  const db = { productCandidate: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([
    { id: "candidate", proposedName: "Material", externalItem: { rawData: { description: "Pack of ten", internal: "private" } } },
  ]) } };
  const service = new ModerationService(db as never, {} as never);
  const result = await service.ownSubmissions({ limit: 20 }, { actorId: "supplier", organizationId: "own" });
  expect(result.items).toEqual([{ id: "candidate", proposedName: "Material", description: "Pack of ten", offerId: null }]);
  expect(db.productCandidate.findMany.mock.calls[0][0].where).toEqual({ supplierOrganizationId: "own", externalItem: { importRowId: null } });
  await expect(service.ownSubmissions({ limit: 20, cursor: "foreign" }, { actorId: "supplier", organizationId: "own" })).rejects.toThrow("cursor not found");
  expect(db.productCandidate.findMany).toHaveBeenCalledOnce();
});
it("filters submissions before pagination and links only the supplier's approved offer", async () => {
  const db = { productCandidate: { findMany: vi.fn().mockResolvedValue([{ id: "c", status: "APPROVED", approvedVariantId: "v", externalItem: { rawData: {} } }]) }, supplierOffer: { findMany: vi.fn().mockResolvedValue([{ id: "offer", productVariantId: "v" }]) } };
  const result = await new ModerationService(db as never, {} as never).ownSubmissions({ limit: 20, q: "Material", status: "APPROVED" }, { actorId: "u", organizationId: "own" });
  expect(db.productCandidate.findMany.mock.calls[0][0].where).toMatchObject({ supplierOrganizationId: "own", status: "APPROVED", proposedName: { contains: "Material", mode: "insensitive" } });
  expect(db.supplierOffer.findMany.mock.calls[0][0].where).toEqual({ supplierOrganizationId: "own", productVariantId: { in: ["v"] } });
  expect(result.items[0].offerId).toBe("offer");
});
function fixture(decisionCount = 1, operator = true) {
  const candidate = { id: "candidate", supplierOrganizationId: "supplier", status: "PENDING", proposedName: "New unique material", proposedSku: null, proposedGtin: null, proposedBrand: null, externalItemId: "external", externalItem: { sourceId: "source", importRowId: null } };
  const tx = {
    productCandidate: { updateMany: vi.fn().mockResolvedValue({ count: decisionCount }), update: vi.fn().mockResolvedValue({ id: "candidate", status: "APPROVED" }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "candidate", status: "REJECTED" }) },
    product: { create: vi.fn().mockResolvedValue({ id: "product" }) }, productVariant: { create: vi.fn().mockResolvedValue({ id: "variant" }) },
    productPackaging: { create: vi.fn().mockResolvedValue({ id: "pack" }) }, supplierOffer: { create: vi.fn().mockResolvedValue({ id: "offer" }) },
    supplierExternalItem: { update: vi.fn() }, supplierItemMatchCandidate: { create: vi.fn() }, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const db = {
    organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? {} : null) },
    productCandidate: { findUnique: vi.fn().mockResolvedValue(candidate) }, productVariant: { findMany: vi.fn().mockResolvedValue([]) },
    industry: { count: vi.fn().mockResolvedValue(1) }, category: { findMany: vi.fn().mockResolvedValue([{ id: "category", industryId: "industry" }]) }, unitOfMeasure: { findUnique: vi.fn().mockResolvedValue({ id: "unit", nameRu: "штука" }) },
    $transaction: vi.fn((action: (client: typeof tx) => unknown) => action(tx)),
  };
  return { db, tx, service: new ModerationService(db as never, {} as never) };
}
it("creates a sellable master and packaging, but keeps the supplier offer hidden and unpriced", async () => {
  const { service, tx } = fixture();
  await service.approve("candidate", input, context);
  expect(tx.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE", baseUnitId: "unit" }) }));
  expect(tx.productVariant.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE", packageQuantity: 10 }) }));
  expect(tx.productPackaging.create).toHaveBeenCalledWith({ data: expect.objectContaining({ level: "SALE", quantityInBaseUnit: 10, unitId: "unit" }) });
  expect(tx.supplierOffer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "DRAFT", packagingId: "pack", baseUnitsPerSaleUnit: 10, publication: { create: {} } }) });
  expect(tx.supplierOffer.create.mock.calls[0]?.[0].data).not.toHaveProperty("prices");
  expect(tx.auditLog.create).toHaveBeenCalledOnce(); expect(tx.outboxEvent.create).toHaveBeenCalledOnce();
});
it("a competing decision cannot create another product or overwrite the winner", async () => {
  const { service, tx } = fixture(0);
  await expect(service.approve("candidate", input, context)).rejects.toThrow("already been decided");
  expect(tx.product.create).not.toHaveBeenCalled();
  await expect(service.reject("candidate", { reason: "Недостаточно сведений" }, context)).rejects.toThrow("already been decided");
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});
it("supplier permissions alone cannot approve or reject their own proposal", async () => {
  const { service, db } = fixture(1, false);
  await expect(service.approve("candidate", input, { actorId: "supplier-user", organizationId: "supplier" })).rejects.toThrow("operator access");
  await expect(service.reject("candidate", { reason: "Reason" }, { actorId: "supplier-user", organizationId: "supplier" })).rejects.toThrow("operator access");
  expect(db.productCandidate.findUnique).not.toHaveBeenCalled();
});
it("rejects a category from an unselected industry before starting writes", async () => {
  const { service, db } = fixture();
  db.category.findMany.mockResolvedValue([{ id: "category", industryId: "other" }]);
  await expect(service.approve("candidate", input, context)).rejects.toThrow("belong to a selected industry");
  expect(db.$transaction).not.toHaveBeenCalled();
});
