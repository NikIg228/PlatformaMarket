import { describe, expect, it } from "vitest";
import { saveSupplierStorefrontSchema, supplierStorefrontQuerySchema, supplierStorefrontSchema } from "./supplier-storefront.js";

describe("supplier storefront contract", () => {
  it("validates bounded bilingual public copy and rejects private fields", () => {
    const command = { expectedVersion: 0, content: { ru: { description: "Компания" }, kk: {} } };
    expect(saveSupplierStorefrontSchema.parse(command).content.ru.description).toBe("Компания");
    expect(saveSupplierStorefrontSchema.safeParse({ ...command, content: { ...command.content, ru: { description: "x".repeat(1001) } } }).success).toBe(false);
    expect(saveSupplierStorefrontSchema.safeParse({ ...command, additionalContacts: [] }).success).toBe(false);
    expect(saveSupplierStorefrontSchema.safeParse({ ...command, expectedVersion: -1 }).success).toBe(false);
  });
  it("does not accept caller overrides of route scope or private buyer", () => {
    const query = supplierStorefrontQuerySchema.parse({ q: "тест", inStock: "false", buyerOrganizationId: "forged", supplierOrganizationId: "foreign", priceBasis: "NORMALIZED" });
    expect(query).not.toHaveProperty("supplierOrganizationId");
    expect(query).not.toHaveProperty("buyerOrganizationId");
    expect(query).not.toHaveProperty("inStock");
    expect(supplierStorefrontQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
  });
  it("public projection cannot accidentally serialize private extras", () => {
    const item = { supplierId: "00000000-0000-4000-8000-000000000001", name: "Компания", content: { ru: {}, kk: {} }, logoUrl: null, contact: null };
    expect(supplierStorefrontSchema.safeParse(item).success).toBe(true);
    expect(supplierStorefrontSchema.safeParse({ ...item, regulatoryDetails: { internal: true } }).success).toBe(false);
  });
});
