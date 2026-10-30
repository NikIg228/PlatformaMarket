import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierStorefrontService } from "./supplier-storefront.service";

const supplierId = "00000000-0000-4000-8000-000000000001";
const context = { actorId: "actor", organizationId: supplierId };
function setup() {
  const profile = { organizationId: supplierId, status: "ACTIVE", storefrontContent: { ru: { description: "Компания" }, kk: {} }, storefrontVersion: 2,
    storefrontLogoAssetId: "logo", regulatoryDetails: { internal: true }, organization: { status: "ACTIVE", displayName: "Поставщик", profile: {
      contactName: "Официальный контакт", phone: "+77000000001", email: "public@example.invalid", additionalContacts: [{ phone: "+77000000002" }],
    } } };
  const db = { organizationMembership: { findFirst: vi.fn().mockResolvedValue({ id: "membership" }) },
    supplierProfile: { findUnique: vi.fn().mockResolvedValue(profile), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) }, outboxEvent: { create: vi.fn().mockResolvedValue({}) },
    uploadAsset: { findFirst: vi.fn().mockResolvedValue({ detectedMime: "image/png", storageKey: "logo-key" }), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn() };
  db.$transaction.mockImplementation(fn => fn(db));
  const terms = { commercialState: vi.fn().mockResolvedValue({ admitted: true }) };
  const uploads = { decodeBase64: vi.fn().mockReturnValue(Buffer.from("logo")), quarantine: vi.fn().mockResolvedValue({ id: "new-logo" }), release: vi.fn() };
  const storage = { get: vi.fn().mockResolvedValue(Buffer.from("logo")) };
  return { profile, db, terms, uploads, storage, service: new SupplierStorefrontService(db as never, terms as never, uploads as never, storage as never) };
}
beforeEach(() => { vi.stubEnv("ACCESS_CONTROL_MODE", "ROLE_BASED"); });
describe("supplier storefront", () => {
  it("projects only explicit public company fields", async () => {
    const t = setup(); const result = await t.service.publicPage(supplierId);
    expect(result).toMatchObject({ name: "Поставщик", content: { ru: { description: "Компания" } }, contact: { phone: "+77000000001" } });
    expect(JSON.stringify(result)).not.toContain("+77000000002");
    expect(result).not.toHaveProperty("regulatoryDetails");
    expect(t.db.supplierProfile.findUnique.mock.calls[0]![0].select.organization.select.profile.select).toEqual({ contactName: true, phone: true, email: true });
  });
  it.each(["admission", "organization", "supplier"])("hides page and logo after %s suspension", async kind => {
    const t = setup();
    if (kind === "admission") t.terms.commercialState.mockResolvedValue({ admitted: false });
    if (kind === "organization") t.profile.organization.status = "INACTIVE";
    if (kind === "supplier") t.profile.status = "INACTIVE";
    await expect(t.service.publicPage(supplierId)).rejects.toThrow("недоступна");
    await expect(t.service.logo(supplierId)).rejects.toThrow("недоступна");
    expect(t.storage.get).not.toHaveBeenCalled();
  });
  it("rejects another tenant before any profile read/write or upload", async () => {
    const t = setup(); const foreign = { ...context, organizationId: "foreign" };
    await expect(t.service.current(supplierId, foreign)).rejects.toThrow("Нет доступа");
    await expect(t.service.save(supplierId, { expectedVersion: 2, content: { ru: { description: "", hours: "", location: "", delivery: "" }, kk: { description: "", hours: "", location: "", delivery: "" } } }, foreign)).rejects.toThrow("Нет доступа");
    await expect(t.service.uploadLogo(supplierId, { expectedVersion: 2, fileName: "a.png", contentBase64: "AAAA" }, foreign)).rejects.toThrow("Нет доступа");
    expect(t.db.supplierProfile.findUnique).not.toHaveBeenCalled(); expect(t.uploads.quarantine).not.toHaveBeenCalled();
  });
  it("denies inactive member/role and scopes the permission to its organization", async () => {
    const t = setup(); t.db.organizationMembership.findFirst.mockResolvedValue(null);
    await expect(t.service.current(supplierId, context)).rejects.toThrow("Нет права");
    expect(t.db.organizationMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "actor", organizationId: supplierId, status: "ACTIVE", roles: { some: { role: { organizationId: supplierId, permissions: { some: { permission: { code: "organization.view" } } } } } } }) }));
    expect(t.db.supplierProfile.findUnique).not.toHaveBeenCalled();
  });
  it("keeps lost updates and repeated saves from creating audit/outbox effects", async () => {
    const t = setup(); t.db.supplierProfile.updateMany.mockResolvedValue({ count: 0 });
    const input = { expectedVersion: 1, content: { ru: { description: "", hours: "", location: "", delivery: "" }, kk: { description: "", hours: "", location: "", delivery: "" } } };
    await expect(t.service.save(supplierId, input, context)).rejects.toThrow("изменились");
    expect(t.db.auditLog.create).not.toHaveBeenCalled(); expect(t.db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it("compensates an uploaded asset if the version changes before linking", async () => {
    const t = setup(); t.db.supplierProfile.updateMany.mockResolvedValue({ count: 0 });
    await expect(t.service.uploadLogo(supplierId, { expectedVersion: 2, fileName: "a.png", contentBase64: "AAAA" }, context)).rejects.toThrow("изменились");
    expect(t.uploads.release).toHaveBeenCalledWith("new-logo", "Storefront logo was not linked");
    expect(t.db.uploadAsset.update).not.toHaveBeenCalled();
  });
  it("serves only the clean logo linked to this supplier, never an arbitrary asset", async () => {
    const t = setup(); await t.service.logo(supplierId);
    expect(t.db.uploadAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "logo", organizationId: supplierId, purpose: "supplier-storefront-logo", status: "CLEAN", deletedAt: null, metadata: { equals: { storefrontSupplierId: supplierId } } } }));
    t.db.uploadAsset.findFirst.mockResolvedValue(null);
    await expect(t.service.logo(supplierId)).rejects.toThrow("недоступен");
    expect(t.storage.get).toHaveBeenCalledTimes(1);
  });
});
