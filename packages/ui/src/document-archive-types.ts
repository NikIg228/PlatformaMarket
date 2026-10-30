

export type DocumentArchiveParticipantView = {
  organizationId: string;
  role: string;
  organization: { id: string; displayName: string; legalName: string; bin: string };
};

export type DocumentArchiveItemView = {
  id: string;
  ownerOrganizationId: string;
  category: string;
  kind: string;
  format: string;
  source: string;
  status: string;
  accountingStatus: string;
  title: string;
  documentNumber: string;
  documentDate: string;
  amountMinor: string | null;
  currency: string | null;
  version: number;
  fileName: string | null;
  checksumSha256: string | null;
  immutableAt: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  supplierOrder: { id: string; orderNumber: string; paymentStatus: string } | null;
  participants: DocumentArchiveParticipantView[];
  signatures: Array<{ id: string; signerOrganizationId: string | null; signerName: string | null; method: string; status: string; signedAt: string | null }>;
  versions: Array<{ id: string; version: number; status: string; documentDate: string; createdAt: string }>;
};

export type DocumentArchiveSummaryView = {
  total: number;
  awaitingSignature: number;
  attention: number;
  thisMonth: number;
};

export type DocumentArchiveFilters = {
  view?: "" | "AWAITING_SIGNATURE" | "ATTENTION" | "ARCHIVED";
  counterpartyOrganizationId?: string;
  q: string;
  category: string;
  status: string;
  accountingStatus: string;
  dateFrom: string;
  dateTo: string;
};

export type DocumentArchiveUploadInput = {
  kind: string;
  format: "PDF" | "DOCX";
  title: string;
  documentNumber: string;
  documentDate: string;
  supplierOrderId?: string;
  paymentIntentId?: string;
  paymentTransactionId?: string;
  refundId?: string;
  baseAgreementDocumentId?: string;
  amountMinor?: string;
  currency?: string;
  fileName: string;
  contentBase64: string;
  requiredSignatureCount: number;
};
