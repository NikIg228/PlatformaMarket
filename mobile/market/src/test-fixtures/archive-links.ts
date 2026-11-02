import type { z } from "zod";
import type { documentArchiveItemSchema } from "../../../../packages/schemas/src/core-api";
import { archiveDocument, archiveId, archiveScope } from "./document-archive";
export const sourceDocumentId = archiveId(1930), baseDocumentId = archiveId(1931), deeperDocumentId = archiveId(1932);
export function sourceDocument(overrides: Partial<z.output<typeof documentArchiveItemSchema>> = {}) {
  return archiveDocument({ id: sourceDocumentId, category: "CONTRACT", kind: "CONTRACT_ADDENDUM", title: "SYNTHETIC source addendum", documentNumber: "SYNTHETIC-ADDENDUM-01", baseAgreementDocumentId: baseDocumentId, supplierOrder: { id: archiveId(1940), buyerOrganizationId: archiveScope.organizationId, supplierOrganizationId: archiveId(5), orderNumber: "SYNTHETIC linked order", paymentStatus: "PAID" }, ...overrides });
}
export function baseDocument(overrides: Partial<z.output<typeof documentArchiveItemSchema>> = {}) { return archiveDocument({ id: baseDocumentId, category: "CONTRACT", kind: "FRAMEWORK_SUPPLY_AGREEMENT", title: "SYNTHETIC independent base agreement", documentNumber: "SYNTHETIC-BASE-01", version: 7, ...overrides }); }
export function deeperDocument() { return baseDocument({ id: deeperDocumentId, title: "SYNTHETIC deeper agreement", documentNumber: "SYNTHETIC-DEEP-01", version: 2 }); }
