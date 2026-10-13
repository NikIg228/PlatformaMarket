import { Prisma } from "@prisma/client";
import type { ConversationContextInfo } from "@marketplace/schemas";
import type { MediaAccessService } from "../../platform/storage/media-access.service";

export const conversationOfferSelection = {
  supplierOrganizationId: true, supplierSku: true,
  supplier: { select: { organization: { select: { displayName: true } } } },
  productVariant: { select: { productId: true, sku: true, externalMetadata: true,
    product: { select: { canonicalName: true, catalogName: true,
      media: { where: { status: "READY", normalizedStorageKey: { not: null } }, orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true } } } } } },
  packaging: { select: { name: true, quantityInBaseUnit: true, unit: { select: { symbol: true } } } },
  saleUnit: { select: { nameRu: true, symbol: true } }, baseUnitsPerSaleUnit: true,
} satisfies Prisma.SupplierOfferSelect;
type ContextOffer = Prisma.SupplierOfferGetPayload<{ select: typeof conversationOfferSelection }>;
export const conversationRelations = { supportTicket: { select: { status: true } }, offer: { select: conversationOfferSelection }, buyer: { select: { displayName: true } }, supplier: { select: { displayName: true } } } as const;
export type ConversationWithParties = Prisma.BusinessConversationGetPayload<{ include: typeof conversationRelations }>;

export function conversationContextInfo(title: string, counterpartyName: string, offer: ContextOffer | null, media: MediaAccessService): ConversationContextInfo {
  if (!offer) return { title, counterpartyName, productId: null, productName: null, variantLabel: null, packagingLabel: null, imageUrl: null };
  const variant = offer.productVariant, product = variant.product;
  const metadata = variant.externalMetadata && typeof variant.externalMetadata === "object" && !Array.isArray(variant.externalMetadata) ? variant.externalMetadata : {};
  const variantLabel = typeof metadata.label === "string" ? metadata.label : variant.sku ? `REF ${variant.sku}` : null;
  const packagingLabel = offer.packaging ? `${offer.packaging.name} · ${offer.packaging.quantityInBaseUnit} ${offer.packaging.unit.symbol}` : offer.saleUnit ? `${offer.saleUnit.nameRu} · ${offer.baseUnitsPerSaleUnit} ${offer.saleUnit.symbol}` : null;
  const photo = product.media[0];
  return { title, counterpartyName, productId: variant.productId, productName: product.catalogName || product.canonicalName,
    variantLabel, packagingLabel, imageUrl: photo ? `/api/catalog/media/${photo.id}?ticket=${media.issue(photo.id).token}` : null };
}
