import { describe, expect, it, vi } from "vitest";
import { publicContactSelect, publicOrganizationContact, supplierOrderContacts } from "./contact-projection";
import { OrderWorkflowService } from "../commerce/order-workflow.service";

const official = { contactName: "Official company", phone: "+77000000000", email: "office@example.invalid" };
const reserves = [{ contactName: "Reserve One", phone: "+77000000001", email: "one@example.invalid" }, { contactName: "Reserve Two", phone: "+77000000002", email: "two@example.invalid" }];
describe("supplier contact visibility", () => {
  it("whitelists company contact and never returns reserves or other profile data publicly", () => {
    expect(Object.keys(publicContactSelect)).toEqual(["contactName", "phone", "email"]);
    const profile = { ...official, additionalContacts: reserves, legalAddressId: "private-address" };
    expect(publicOrganizationContact(profile)).toEqual(official);
    expect(supplierOrderContacts(profile)).toEqual({ official, reserves });
    expect(publicOrganizationContact({ ...official, phone: "" })).toBeNull();
    expect(supplierOrderContacts(null)).toEqual({ official: null, reserves: [] });
  });
  it("reads contacts only after order permission and party scope; returns current supplier contacts", async () => {
    const db: any = {
      organizationCapability: { findUnique: vi.fn(async () => null) },
      supplierOrder: { findFirst: vi.fn(async () => ({ id: "order" })), findUniqueOrThrow: vi.fn(async () => ({ id: "order", supplierOrganizationId: "supplier", transferClaims: [], workflowEvents: [], paymentAllocation: null, items: [], subtotalAmountMinor: "100", status: "CONFIRMED" })) },
      supplierProfile: { findUnique: vi.fn(async () => null) },
      organizationProfile: { findUnique: vi.fn(async () => ({ ...official, additionalContacts: reserves })) },
      orderPaymentReduction: { findMany: vi.fn(async () => []) }, orderManualReturn: { findMany: vi.fn(async () => []) },
    };
    const access = { hasAll: vi.fn(async () => true) };
    const service = new OrderWorkflowService(db, access as never);
    const context = { actorId: "person", organizationId: "clinic" };
    expect((await service.get("order", context)).supplierContacts).toEqual({ official, reserves });
    expect(db.supplierOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order", OR: [{ buyerOrganizationId: "clinic" }, { supplierOrganizationId: "clinic" }] } }));
    expect(db.organizationProfile.findUnique).toHaveBeenCalledWith({ where: { organizationId: "supplier" }, select: { ...publicContactSelect, additionalContacts: true } });
    db.organizationProfile.findUnique.mockClear(); db.supplierOrder.findFirst.mockResolvedValue(null);
    await expect(service.get("order", context)).rejects.toMatchObject({ status: 404 });
    expect(db.organizationProfile.findUnique).not.toHaveBeenCalled();
    access.hasAll.mockResolvedValue(false);
    await expect(service.get("order", context)).rejects.toMatchObject({ status: 403 });
    expect(db.organizationProfile.findUnique).not.toHaveBeenCalled();
  });
});
