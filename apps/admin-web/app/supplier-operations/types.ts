export type Warehouse = { id: string; code: string; name: string };
export type DataSource = { id: string; name: string; type: string };
export type SupplierProfile = {
  organizationId: string;
  organization: { displayName: string; bin: string };
  warehouses: Warehouse[];
  dataSources: DataSource[];
  _count: { offers: number; importBatches: number };
};
export type ImportBatch = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  createdAt: string;
};
export type Product = {
  id: string;
  canonicalName: string;
  variants: Array<{ id: string; sku?: string | null; gtin?: string | null }>;
};
export type MatchCandidate = {
  id: string;
  score: string;
  productVariant: {
    id: string;
    sku?: string | null;
    product: { canonicalName: string };
  };
};
export type ExternalItem = {
  id: string;
  externalId: string;
  name: string;
  supplierSku?: string | null;
  matchedVariantId?: string | null;
  matchCandidates: MatchCandidate[];
};
export type Offer = {
  id: string;
  supplierSku?: string | null;
  status: string;
  version: number;
  productVariant: { id: string; product: { canonicalName: string } };
  publication?: { status: string; marketplaceVisible: boolean } | null;
  prices: Array<{ amountMinor: string; currency: string; status: string }>;
};
export type Balance = {
  id: string;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  availabilityStatus: string;
  freshnessStatus: string;
  warehouse: Warehouse;
  productVariant: { id: string; product: { canonicalName: string } };
  lots: Array<{
    id: string;
    lotNumber: string;
    expirationDate?: string | null;
    quantityAvailable: string;
    status: string;
  }>;
  reservations: Array<{ id: string; quantity: string; expiresAt: string }>;
};
