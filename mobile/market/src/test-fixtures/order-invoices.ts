import { orderInvoicesResponseSchema, orderInvoiceSnapshotSchema, type OrderInvoiceView } from "../../../../packages/schemas/src/order-invoice";
import { organizationRequisitesRevisionSchema } from "../../../../packages/schemas/src/organization-requisites";
import { calculateVatLine, type VatPriceSnapshot } from "../../../../packages/schemas/src/vat";
import { cancellationCommandWorkflow, cancellationCommandScope } from "./order-cancellation-command";
import { listDraftId } from "./list-draft";
export const invoiceScope = cancellationCommandScope, invoiceId = listDraftId, invoiceIban = "KZ86125KZT5004100100";
export function invoiceWorkflow() {
  const value = cancellationCommandWorkflow(); value.status = value.order.status = "AWAITING_PAYMENT"; value.order.currency = "KZT"; value.order.subtotalAmountMinor = "11600000000000000000"; value.invoiceDocumentId = invoiceId(128102);
  for (const item of value.order.items) item.currency = "KZT"; return value;
}
export function invoiceRevision(supplier = true) {
  const bank = { id: invoiceId(supplier ? 128201 : 128202), bankName: "SYNTHETIC invoice bank", iban: invoiceIban, bic: "FAKEKZXX", kbe: "17", currency: "KZT" as const }, actor = { id: invoiceScope.userId, displayName: "SYNTHETIC invoice confirmer" };
  return organizationRequisitesRevisionSchema.parse({ id: invoiceId(supplier ? 128211 : 128212), version: 1, createdAt: "2026-10-29T01:02:03.000Z", createdBy: actor, confirmedAt: "2026-10-29T01:02:03.000Z", confirmedBy: actor,
    source: { organizationVersion: 1, legalName: supplier ? "SYNTHETIC invoice supplier" : "SYNTHETIC invoice buyer", displayName: "SYNTHETIC invoice organization", identifier: "999999999999", profile: { contactName: "SYNTHETIC invoice contact", phone: "+77000000000", email: "invoice@example.invalid", additionalContacts: [], legalAddress: { cityId: invoiceId(128230), line1: "SYNTHETIC address", postalCode: null }, deliveryAddress: { cityId: invoiceId(128230), line1: "SYNTHETIC address", postalCode: null } }, legalAddressText: "SYNTHETIC legal address", deliveryAddressText: "SYNTHETIC delivery address", profileComplete: true, requiresPaymentDetails: supplier },
    fields: { legalForm: "LEGAL_ENTITY", defaultBankAccountId: bank.id, bankAccounts: [bank], taxPeriods: [{ id: invoiceId(128221), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }] } });
}
export function invoiceView(workflow = invoiceWorkflow(), version = 2): OrderInvoiceView {
  const supplier = invoiceRevision(), buyer = invoiceRevision(false), number = `SYNTHETIC-INVOICE-${version}`, declaration: VatPriceSnapshot = { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "SYNTHETIC_TAX_RULE", source: "EXPLICIT", defaultVersion: null, declaredAt: "2026-10-29T01:02:03.000Z", declaredById: invoiceScope.userId, profile: { revisionId: supplier.id, version: 1, organizationVersion: 1, taxPeriodId: invoiceId(128221), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null } }, tax = calculateVatLine("11600000000000000000", declaration);
  const snapshot = orderInvoiceSnapshotSchema.parse({ templateVersion: "PM_INVOICE_V1", orderId: workflow.orderId, orderNumber: workflow.order.orderNumber, orderVersion: version, number, version, date: "2026-10-31", supplier, buyer, bankAccount: { ...supplier.fields.bankAccounts[0]! }, lines: [{ id: workflow.order.items[0]!.id, name: "SYNTHETIC invoice line", article: "SYNTHETIC-ARTICLE", unit: "SYNTHETIC unit", quantity: "2", unitPriceMinor: "5800000000000000000", totalMinor: "11600000000000000000", tax, gift: false }], currency: "KZT", totalMinor: "11600000000000000000", baseMinor: tax.baseMinor, vatMinor: tax.vatMinor });
  return { documentId: invoiceId(128100 + version), number, version, status: version === 2 ? "CONFIRMED" : "SUPERSEDED", checksum: "c".repeat(64), snapshot, confirmedAt: "2026-10-31T04:05:06.000Z", confirmedByName: "SYNTHETIC invoice confirmer" };
}
export function invoiceResponse(workflow = invoiceWorkflow()) { return orderInvoicesResponseSchema.parse({ orderId: workflow.orderId, orderVersion: workflow.version, currentDocumentId: workflow.invoiceDocumentId, canPrepare: false, issues: [], invoices: [invoiceView(workflow, 2), invoiceView(workflow, 1)] }); }
