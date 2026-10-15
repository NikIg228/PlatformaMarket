import { Prisma } from "@prisma/client";
import { calculateVatLine, type OrganizationRequisitesRevision, type VatPriceSnapshot } from "@marketplace/schemas";
import type { InvoiceOrder } from "./order-invoice.rules";
export const invoiceTestId = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function invoiceTestRevision(n = 1): OrganizationRequisitesRevision {
  const profile = { contactName: "Тестовый контакт", phone: "+77000000000", email: "invoice@example.invalid", additionalContacts: [],
    legalAddress: { cityId: invoiceTestId(90), line1: "Тестовый адрес 10", postalCode: null }, deliveryAddress: { cityId: invoiceTestId(90), line1: "Тестовый адрес 10", postalCode: null } };
  return { id: invoiceTestId(n), version: 1, createdAt: "2026-10-14T10:00:00.000Z", createdBy: { id: invoiceTestId(91), displayName: "Сотрудник" },
    confirmedAt: "2026-10-14T10:00:00.000Z", confirmedBy: { id: invoiceTestId(91), displayName: "Сотрудник" },
    source: { organizationVersion: 1, legalName: `Тестовая организация ${n}`, displayName: "Тест", identifier: "999999999999", legalAddressText: "Казахстан, тестовый город, улица 10", deliveryAddressText: "Казахстан, тестовый город, улица 10", profileComplete: true, requiresPaymentDetails: n === 1, profile },
    fields: { legalForm: "LEGAL_ENTITY", defaultBankAccountId: invoiceTestId(30), bankAccounts: [{ id: invoiceTestId(30), bankName: "Тестовый банк", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }],
      taxPeriods: [{ id: invoiceTestId(31), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }] } };
}
export function invoiceTestOrder(): InvoiceOrder {
  const declaration: VatPriceSnapshot = { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", source: "EXPLICIT", defaultVersion: null,
    declaredAt: "2026-10-14T12:00:00.000Z", declaredById: invoiceTestId(91), profile: { revisionId: invoiceTestId(1), version: 1, organizationVersion: 1, taxPeriodId: invoiceTestId(31), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null } };
  return { id: invoiceTestId(10), checkoutId: invoiceTestId(11), supplierOrganizationId: invoiceTestId(20), buyerOrganizationId: invoiceTestId(21), orderNumber: "TEST-1", version: 1,
    status: "CONFIRMED", paymentStatus: "UNPAID", manualInvoiceDocumentId: null, paymentAllocation: null, transferClaims: [], subtotalAmountMinor: new Prisma.Decimal("11600"), currency: "KZT",
    items: [{ id: invoiceTestId(40), acceptedQuantity: new Prisma.Decimal(2), unitPriceMinor: new Prisma.Decimal("5800"), totalPriceMinor: new Prisma.Decimal("11600"), reservation: null,
      offerSnapshot: { pricing: { tax: calculateVatLine("11600", declaration) } }, productVariant: { product: { canonicalName: "Тестовый стоматологический материал" }, sku: "SKU-TEST", saleUnit: { nameRu: "шт." } }, offer: { packaging: null } }] } as unknown as InvoiceOrder;
}
