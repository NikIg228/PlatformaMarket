import { Prisma } from "@prisma/client";

export const workspaceOfferSelect = {
  id: true, version: true, productVariantId: true, supplierSku: true, status: true, sourceType: true, confirmationMode: true,
  minimumOrderQuantity: true, orderIncrement: true, baseUnitsPerSaleUnit: true, createdAt: true,
  productVariant: { select: { product: { select: { id: true, canonicalName: true, description: true, manufacturerSku: true, gtin: true, productType: true, regulatoryClass: true } } } },
  saleUnit: { select: { nameRu: true, symbol: true } },
  packaging: { select: { id: true, name: true, quantityInBaseUnit: true, unit: { select: { symbol: true } } } },
  publication: { select: { status: true, marketplaceVisible: true, blockedReason: true } },
  prices: { where: { status: "ACTIVE" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1,
    select: { id: true, amountMinor: true, currency: true, status: true, includesVat: true, vatRate: true, source: true, lastConfirmedAt: true, freshnessExpiresAt: true } },
  inventoryBalances: { orderBy: { id: "asc" }, select: { id: true, warehouseId: true, warehouse: { select: { name: true } }, quantityOnHand: true, quantityAvailable: true, quantityReserved: true, freshnessStatus: true, freshnessExpiresAt: true, source: true, updatedAt: true } },
} satisfies Prisma.SupplierOfferSelect;

export const workspaceCartInclude = {
  items: { orderBy: { id: "asc" }, include: { offer: { select: {
    id: true, supplierOrganizationId: true, productVariantId: true,
    supplier: { select: { organization: { select: { id: true, displayName: true, legalName: true, bin: true } } } },
    productVariant: { select: { product: { select: { id: true, canonicalName: true } } } },
  } } } }, checkout: { select: { id: true, status: true } },
} satisfies Prisma.CartInclude;
