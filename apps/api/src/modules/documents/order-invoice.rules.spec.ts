import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateVatLine, type VatPriceSnapshot } from "@marketplace/schemas";
import { invoiceLifecycleIssue, invoiceLines, type InvoiceOrder } from "./order-invoice.rules";
const declaration: VatPriceSnapshot = {
  selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", source: "EXPLICIT", defaultVersion: null,
  declaredAt: "2026-10-14T12:00:00.000Z", declaredById: "00000000-0000-4000-8000-000000000001",
  profile: { revisionId: "00000000-0000-4000-8000-000000000002", version: 1, organizationVersion: 1, taxPeriodId: "00000000-0000-4000-8000-000000000003", status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null },
};
const decimal = (value: string) => new Prisma.Decimal(value);
function fixture(): InvoiceOrder {
  return { status: "CONFIRMED", paymentStatus: "UNPAID", manualInvoiceDocumentId: null, paymentAllocation: null, transferClaims: [],
    subtotalAmountMinor: decimal("100"), currency: "KZT", items: [{ id: "item", acceptedQuantity: decimal("0.5"), unitPriceMinor: decimal("200"), totalPriceMinor: decimal("100"),
      reservation: null, offerSnapshot: { pricing: { tax: calculateVatLine("200", declaration) } }, productVariant: { product: { canonicalName: "Материал" }, sku: "A", saleUnit: { nameRu: "шт." } }, offer: { packaging: null } }] } as unknown as InvoiceOrder;
}
describe("generated invoice invariants", () => {
  it("uses accepted quantities and immutable declarations without adding VAT twice", () => {
    const result = invoiceLines(fixture()); expect(result.issues).toEqual([]);
    expect(result.lines[0]).toMatchObject({ quantity: "0.5", totalMinor: "100", tax: { grossMinor: "100", baseMinor: "86", vatMinor: "14" } });
  });
  it("blocks unknown tax and mismatched totals instead of fabricating tax", () => {
    const order = fixture(); order.items[0].offerSnapshot = {}; order.subtotalAmountMinor = decimal("101");
    expect(invoiceLines(order).issues.map(issue => issue.code)).toEqual(["TAX_REQUIRED", "AMOUNT_CONFLICT"]);
  });
  it("retains zero-value gifts without inventing a tax declaration", () => {
    const order = fixture(); order.items.push({ ...order.items[0], id: "gift", giftForItemId: "item", totalPriceMinor: decimal("0"), unitPriceMinor: decimal("0"), offerSnapshot: {} });
    expect(invoiceLines(order).issues).toEqual([]); expect(invoiceLines(order).lines[1]).toMatchObject({ gift: true, tax: null, totalMinor: "0" });
  });
  it("requires agreed composition and prevents replacing an invoice with a reported transfer", () => {
    const order = fixture(); expect(invoiceLifecycleIssue(order)).toBeNull();
    order.status = "PARTIALLY_CONFIRMED"; expect(invoiceLifecycleIssue(order)).toContain("состав");
    order.status = "AWAITING_PAYMENT"; order.transferClaims = [{ status: "PENDING" }] as InvoiceOrder["transferClaims"];
    expect(invoiceLifecycleIssue(order)).toContain("перевод");
  });
});
