import { documentArchiveItemSchema } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";
import type { ArchiveMetadata } from "./document-archive-fixture-read";

// Local selections only. IDs are not authorization and never become a new DTO.
export type ArchiveBaseSelection = Readonly<{ kind: "base-document"; documentId: string; parentDocumentId: string; parentVersion: number; selection: number }>;
export type ArchiveLinkBoundary = "none" | "unverified" | "cycle" | "unsupported";
export type ArchiveDocumentLinks = { base: { state: "available"; target: ArchiveBaseSelection } | { state: ArchiveLinkBoundary }; order: { state: ArchiveLinkBoundary } };
type Parent = Readonly<{ id: string; version: number; updatedAt: string; ownerOrganizationId: string; kind: ArchiveMetadata["kind"]; category: ArchiveMetadata["category"]; baseAgreementDocumentId: string; path: readonly string[] }>;
const orderIdentity = documentArchiveItemSchema.shape.supplierOrder.unwrap().pick({ id: true, buyerOrganizationId: true, supplierOrganizationId: true }).nullable();
export function createArchiveLinkSelections(scope: ReadScope) {
  const organizationId = scope.organizationId;
  let issued = new WeakMap<ArchiveBaseSelection, Parent>(), sequence = 0;
  return {
    derive(body: unknown, value: ArchiveMetadata, path: readonly string[] = [value.id]): ArchiveDocumentLinks {
      if (typeof body !== "object" || body === null) return { base: { state: "unverified" }, order: { state: "unverified" } };
      const base = documentArchiveItemSchema.shape.baseAgreementDocumentId.safeParse("baseAgreementDocumentId" in body ? body.baseAgreementDocumentId : undefined);
      const order = orderIdentity.safeParse("supplierOrder" in body ? body.supplierOrder : undefined);
      const orderState: ArchiveLinkBoundary = !order.success ? "unverified" : order.data === null ? "none" : order.data.buyerOrganizationId !== organizationId ? "unverified" : "unsupported";
      // Existing workflow GET does not include general document back-references.
      // Its invoiceDocumentId is a manual-invoice pointer, not an arbitrary one.
      if (!base.success || value.ownerOrganizationId !== organizationId) return { base: { state: "unverified" }, order: { state: orderState } };
      if (base.data === null) return { base: { state: "none" }, order: { state: orderState } };
      if (path.includes(base.data)) return { base: { state: "cycle" }, order: { state: orderState } };
      const target: ArchiveBaseSelection = Object.freeze({ kind: "base-document", documentId: base.data, parentDocumentId: value.id, parentVersion: value.version, selection: ++sequence });
      issued.set(target, Object.freeze({ id: value.id, version: value.version, updatedAt: value.updatedAt, ownerOrganizationId: value.ownerOrganizationId, kind: value.kind, category: value.category, baseAgreementDocumentId: base.data, path: Object.freeze([...path]) }));
      return { base: { state: "available", target }, order: { state: orderState } };
    },
    get(target: ArchiveBaseSelection): Parent | undefined { return typeof target === "object" && target !== null ? issued.get(target) : undefined; },
    matches(parent: Parent, body: unknown, value: ArchiveMetadata): boolean {
      if (typeof body !== "object" || body === null || !("baseAgreementDocumentId" in body)) return false;
      const base = documentArchiveItemSchema.shape.baseAgreementDocumentId.safeParse(body.baseAgreementDocumentId);
      return base.success && base.data === parent.baseAgreementDocumentId && value.id === parent.id && value.ownerOrganizationId === organizationId && value.ownerOrganizationId === parent.ownerOrganizationId && value.version === parent.version && value.updatedAt === parent.updatedAt && value.kind === parent.kind && value.category === parent.category;
    },
    reset() { issued = new WeakMap(); },
  };
}
