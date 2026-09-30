import type {
  OrderDocumentResponse,
} from "@marketplace/api-client";
import type { BuyerShipment } from "../../order-shipments";
import type { CartLineSnapshotResponse } from "@marketplace/schemas";

export type CartItem = {
  id: string;
  offerId: string;
  quantity: string;
  unitPriceMinor: string;
  totalPriceMinor: string;
  currency: string;
  offer?: {
    supplier?: { organization?: { displayName?: string } };
    productVariant?: { product?: { canonicalName?: string } };
  };
};

export type Cart = {
  id: string;
  buyerOrganizationId: string;
  version: number;
  status: string;
  currency: string;
  items: CartItem[];
  checkout?: { id: string } | null;
  createdAt: string;
};

export type CartLineSnapshot = CartLineSnapshotResponse;

export type CartValidationItem = {
  cartItemId: string;
  offerId: string;
  status: "UNCHANGED" | "CHANGED" | "UNAVAILABLE";
  changes: Array<"PRICE" | "STOCK" | "AVAILABILITY" | "OFFER_RULES">;
  previous: CartLineSnapshot;
  current: CartLineSnapshot | null;
  canCheckout: boolean;
  requiresAcceptance: boolean;
  message: string | null;
};

export type CartValidation = {
  cartId: string;
  cartVersion: number;
  validatedAt: string;
  hasChanges: boolean;
  requiresAcceptance: boolean;
  canCheckout: boolean;
  items: CartValidationItem[];
};

export type SupplierOrder = {
  id: string;
  buyerOrganizationId: string;
  orderNumber: string;
  status: string;
  subtotalAmountMinor: string;
  currency: string;
  createdAt: string;
  supplier: { displayName: string };
  shipments?: BuyerShipment[];
  documents?: OrderDocumentResponse[];
  items: Array<{
    id: string;
    quantity: string;
    acceptedQuantity: string | null;
    decisionReason: string | null;
    status: string;
    offer: { productVariant: { product: { canonicalName: string } } };
  }>;
};

export type ReviewDraft = {
  rating: number;
  comment: string;
};
