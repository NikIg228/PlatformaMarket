export type Product = {
  id: string;
  canonicalName: string;
  description: string | null;
  manufacturerSku: string | null;
  gtin: string | null;
  productType: string;
  regulatoryClass: string | null;
  media?: { sourceUrl: string | null }[];
};
export type Offer = { id: string; productVariant: { product: Product } };
export type Correction = {
  id: string;
  field: string;
  currentValue: string | null;
  proposedValue: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED";
  moderatorComment: string | null;
  appliedValue: string | null;
  createdAt: string;
  supplierOrganizationId: string;
  product: { canonicalName: string };
};
