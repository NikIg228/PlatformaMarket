import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";

export const previewProducts = JSON.parse(await readFile(new URL("../../apps/buyer-web/app/data/product-page-preview.json", import.meta.url), "utf8"));
export const previewUuid = key => {
  const h = createHash("sha256").update(`product-page-preview:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export function assertPreviewTarget(databaseUrl, env = process.env) {
  const url = new URL(databaseUrl);
  if (env.NODE_ENV === "production" || env.CI || !["localhost", "127.0.0.1"].includes(url.hostname)
    || !["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/marketplace"
    || (url.port && url.port !== "5432") || url.search !== "?schema=public") {
    throw new Error("Preview application is limited to the local marketplace/public development database");
  }
}

export async function inspectPreview(tx) {
  const products = await tx.product.findMany({
    where: { id: { in: previewProducts.map(p => p.id) } },
    include: { variants: { include: { packagings: true, supplierOffers: { include: {
      prices: true, inventoryBalances: true, publication: true, deliveryOptions: true,
      _count: { select: { supplierOrderItems: true } },
    } } } } },
  });
  const unit = await tx.unitOfMeasure.findUniqueOrThrow({ where: { code: "piece" } });
  const suppliers = [];
  for (let i = 1; i <= 6; i++) {
    const offer = products.find(p => p.id === previewProducts[0].id)?.variants.flatMap(v => v.supplierOffers)
      .find(o => o.externalId === `pilot-demo:${previewProducts[0].sourceId}:${i}`);
    if (!offer || offer.inventoryBalances.length !== 1) throw new Error(`Missing known pilot supplier/warehouse ${i}`);
    const warehouse = await tx.warehouse.findUniqueOrThrow({ where: { id: offer.inventoryBalances[0].warehouseId } });
    if (warehouse.supplierOrganizationId !== offer.supplierOrganizationId || !warehouse.cityId || warehouse.status !== "ACTIVE")
      throw new Error("Pilot warehouse ownership/status mismatch");
    suppliers.push({ organizationId: offer.supplierOrganizationId, warehouseId: warehouse.id, cityId: warehouse.cityId, ordinal: i });
  }
  for (const config of previewProducts) {
    const product = products.find(p => p.id === config.id);
    if (!product || product.canonicalName !== config.sourceName || product.externalMetadata?.sourceId !== config.sourceId || product.status !== "ACTIVE")
      throw new Error(`Product identity mismatch: ${config.id}`);
    for (const variant of config.variants) {
      const existing = product.variants.find(v => v.id === variant.id);
      if (variant.existing && !existing) throw new Error(`Missing source variant ${variant.id}`);
      if (existing && !variant.existing && existing.externalMetadata?.previewScope !== "product-page-2026-10-12")
        throw new Error("Variant ID collision");
      for (const offer of existing?.supplierOffers ?? []) {
        if (!suppliers.some(s => s.organizationId === offer.supplierOrganizationId)) continue;
        if (!offer.externalId?.startsWith(`pilot-demo:${config.sourceId}:`) && !offer.externalId?.startsWith(`product-preview:${config.id}:`))
          throw new Error("Refusing to overwrite a non-preview offer");
        if (offer._count.supplierOrderItems || offer.inventoryBalances.some(b => !b.quantityReserved.isZero()))
          throw new Error("Refusing to change preview stock with orders or reservations");
      }
    }
  }
  return { products, unit, suppliers };
}

// Caller owns the transaction. Used inside a rollback-only isolated verification first.
export async function applyPreview(tx, now = new Date()) {
  const { products, unit, suppliers } = await inspectPreview(tx);
  const expiresAt = new Date(now.getTime() + 90 * 86_400_000);
  let count = 0;
  for (const config of previewProducts) {
    const product = products.find(p => p.id === config.id);
    await tx.product.update({ where: { id: config.id }, data: {
      catalogName: config.title, description: config.description,
      externalMetadata: { ...product.externalMetadata, previewScope: "product-page-2026-10-12" },
    } });
    for (const variant of config.variants) {
      const existing = product.variants.find(v => v.id === variant.id);
      const data = { sku: variant.sku, status: "ACTIVE", saleUnitId: unit.id,
        externalMetadata: { ...existing?.externalMetadata, label: variant.label, attributes: variant.attributes, previewScope: "product-page-2026-10-12" } };
      await tx.productVariant.upsert({ where: { id: variant.id }, update: data, create: { id: variant.id, productId: config.id, ...data } });
      for (const [packageIndex, pack] of config.packages.entries()) {
        const packagingId = previewUuid(`${variant.id}:${pack.code}`);
        const packageData = { name: pack.name, quantityInBaseUnit: pack.quantity, unitId: unit.id, level: "SALE", status: "ACTIVE" };
        await tx.productPackaging.upsert({ where: { id: packagingId }, update: packageData,
          create: { id: packagingId, productVariantId: variant.id, code: `preview-${pack.code}`, ...packageData } });
        for (const [index, supplier] of suppliers.slice(packageIndex * 3, packageIndex * 3 + 3).entries()) {
          const unique = { supplierOrganizationId: supplier.organizationId, productVariantId: variant.id, saleUnitId: unit.id };
          const original = existing?.supplierOffers.find(o => o.supplierOrganizationId === supplier.organizationId && o.saleUnitId === unit.id);
          const offerId = original?.id ?? previewUuid(`${variant.id}:${supplier.organizationId}:offer`);
          const externalId = original?.externalId ?? `product-preview:${config.id}:${variant.id}:${supplier.ordinal}`;
          const offerData = { packagingId, baseUnitsPerSaleUnit: pack.quantity, minimumOrderQuantity: "1", orderIncrement: "1", status: "ACTIVE", confirmationMode: "MANUAL", sourceType: "MANUAL", externalId };
          await tx.supplierOffer.upsert({ where: { supplierOrganizationId_productVariantId_saleUnitId: unique }, update: offerData,
            create: { id: offerId, ...unique, ...offerData } });
          // Preserve an existing publication's visibility restrictions. New records are synthetic only.
          if (!original?.publication) await tx.offerPublication.create({ data: { offerId, status: "PUBLISHED", marketplaceVisible: true, publishedAt: now } });
          const amountMinor = new Prisma.Decimal(variant.priceMinor).plus(index * 85000).mul(pack.quantity);
          const priceData = { offerId, amountMinor, currency: "KZT", validFrom: now, freshnessExpiresAt: expiresAt, lastConfirmedAt: now, status: "ACTIVE", source: "MANUAL" };
          const priceId = original?.prices.find(price => price.status === "ACTIVE")?.id ?? previewUuid(`${offerId}:price`);
          await tx.offerPrice.upsert({ where: { id: priceId }, update: priceData, create: { id: priceId, ...priceData } });
          const quantity = new Prisma.Decimal(18 + index * 11);
          const balanceData = { offerId, quantityOnHand: quantity, quantityAvailable: quantity, quantityReserved: "0", safetyStock: "0", availabilityStatus: "IN_STOCK", freshnessStatus: "FRESH", lastSuccessfulSyncAt: now, freshnessExpiresAt: expiresAt, source: "MANUAL" };
          await tx.inventoryBalance.upsert({ where: { supplierOrganizationId_warehouseId_productVariantId: { supplierOrganizationId: supplier.organizationId, warehouseId: supplier.warehouseId, productVariantId: variant.id } }, update: balanceData,
            create: { id: previewUuid(`${offerId}:balance`), supplierOrganizationId: supplier.organizationId, warehouseId: supplier.warehouseId, productVariantId: variant.id, ...balanceData } });
          for (const method of ["PICKUP", "CARRIER"]) {
            const deliveryData = { priceType: method === "PICKUP" ? "FREE" : "FIXED", fixedAmountMinor: method === "PICKUP" ? null : String(100000 + index * 50000), currency: "KZT", minLeadTimeHours: method === "PICKUP" ? 2 : 24 + index * 24, maxLeadTimeHours: method === "PICKUP" ? 4 : 48 + index * 24, status: "ACTIVE" };
            await tx.offerDeliveryOption.upsert({ where: { offerId_warehouseId_method: { offerId, warehouseId: supplier.warehouseId, method } }, update: deliveryData,
              create: { id: previewUuid(`${offerId}:${method}`), offerId, warehouseId: supplier.warehouseId, method, ...deliveryData } });
          }
          count++;
        }
      }
    }
  }
  return { products: previewProducts.length, variants: previewProducts.reduce((n, p) => n + p.variants.length, 0), offers: count, expiresAt };
}
