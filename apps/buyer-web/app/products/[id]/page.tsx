import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import catalog from "../../data/public-catalog-fallback.json";
import mediaCatalog from "../../data/public-catalog-media.json";
import { findFallbackCatalogMedia } from "../../catalog-fallback.server";
import { MarketplaceHeader } from "../../features/marketplace-header/marketplace-header";
import styles from "./page.module.css";
import { SupplierOffers } from "../../features/catalog/supplier-offers";
import { findResearchedDescription } from "../../features/catalog/researched-product-description";
import ProductLoadError from "./product-load-error";
import { formatCatalogMoney } from "../../catalog/catalog-view-model";
import { safeCatalogReturn } from "../../catalog/marketplace-url";
import { productLoginUrl } from "../../public-links";
import type { DeliverySummary } from "../../catalog/offer-delivery-summary";

type CatalogProduct = (typeof catalog.products)[number];
type PublicComparison = Awaited<
  ReturnType<MarketplaceApiClient["comparePublicOffers"]>
>;
type DetailProduct = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  sourceUrl: string | null;
  attributes: Array<readonly [string, string]>;
  isAvailable: boolean;
  offers: Array<{
    id: string;
    supplier: { id: string; name: string };
    supplierSku: string | null;
    priceMinor: string | null;
    normalizedPriceMinor?: string | null;
    currency: string;
    packaging?: { name: string; quantityInBaseUnit?: string; unit?: string | null };
    minimumOrderQuantity?: string;
    orderIncrement?: string;
    available: boolean;
    deliveryMethods: string[];
    delivery?: DeliverySummary[];
    verifiedDocuments: boolean;
    officialDistributor: boolean;
  }>;
};

const API_URL =
  process.env.INTERNAL_API_URL ??
  (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://127.0.0.1:4012/api");

function displayAttribute(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  return JSON.stringify(value);
}

function fromFallback(product: CatalogProduct): DetailProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand,
    manufacturer: product.manufacturer,
    category: product.category,
    sourceUrl: product.sourceUrl,
    attributes: product.attributes.map(([name, value]) => [name, value]),
    isAvailable: product.isAvailable,
    offers: product.offers.map((offer) => ({
      id: offer.id,
      supplier: offer.supplier,
      supplierSku: offer.supplierSku,
      priceMinor: offer.priceMinor,
      normalizedPriceMinor: offer.normalizedPriceMinor,
      currency: offer.currency,
      packaging: offer.packaging,
      available: offer.available,
      deliveryMethods: offer.deliveryMethods,
      verifiedDocuments: offer.verifiedDocuments,
      officialDistributor: offer.officialDistributor,
    })),
  };
}

function fromComparison(comparison: PublicComparison): DetailProduct {
  return {
    id: comparison.product.id,
    name: comparison.product.name,
    description: null,
    brand: comparison.product.brand,
    manufacturer: comparison.product.manufacturer,
    category: null,
    sourceUrl: null,
    attributes: comparison.comparisonAttributes.map((attribute) => [
      attribute.name,
      displayAttribute(attribute.value),
    ]),
    isAvailable: comparison.offers.some((offer) =>
      offer.availability.some(
        ({ quantityAvailable }) => Number(quantityAvailable) > 0,
      ),
    ),
    offers: comparison.offers.map((offer) => ({
      id: offer.offerId,
      supplier: {
        id: offer.supplier.organizationId,
        name: offer.supplier.name,
      },
      supplierSku: offer.supplierSku,
      minimumOrderQuantity: offer.minimumOrderQuantity,
      orderIncrement: offer.orderIncrement,
      priceMinor: offer.price.amountMinor,
      normalizedPriceMinor: offer.price.normalizedPriceMinor,
      currency: offer.price.currency,
      packaging: { name: offer.packaging.name, quantityInBaseUnit: offer.packaging.quantityInBaseUnit, unit: offer.packaging.unit },
      available: offer.availability.some(
        ({ quantityAvailable }) => Number(quantityAvailable) > 0,
      ),
      deliveryMethods: offer.delivery.map(({ method }) => method),
      delivery: offer.delivery,
      verifiedDocuments: offer.markers.verifiedDocuments,
      officialDistributor: offer.markers.officialDistributor,
    })),
  };
}

const getProduct = cache(async (id: string, cityId?: string): Promise<DetailProduct | null> => {
  try {
    const api = new MarketplaceApiClient(API_URL, {});
    const live = fromComparison(await api.comparePublicOffers(id, { quantity: 1, ...(cityId ? { cityId } : {}) }));
    const reference = catalog.products.find((item) => item.id === id);
    // Static descriptions/media may enrich a live result, never prices or availability.
    return { ...live, sourceUrl: reference?.sourceUrl ?? null, description: reference?.description ?? live.description,
      category: reference?.category ?? live.category, attributes: live.attributes.length ? live.attributes : reference?.attributes.map(([name, value]) => [name, value] as const) ?? [] };
  } catch (cause) {
    if (cause instanceof MarketplaceApiError && cause.status === 404) return null;
    throw new Error("Не удалось загрузить актуальные предложения. Повторите попытку.");
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(decodeURIComponent(id)).catch(() => null);
  return product
    ? {
        title: `${product.name} | PlatformaMarket`,
        description: product.description,
      }
    : { title: "Карточка товара | PlatformaMarket" };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const returnTo = safeCatalogReturn((await searchParams).returnTo);
  const requestedCity = new URL(returnTo, "http://local.invalid").searchParams.get("deliveryCityId");
  let cityId: string | undefined;
  if (requestedCity) {
    const cities = await fetch(`${API_URL}/catalog/cities`, { cache: "no-store" }).then(r => r.ok ? r.json() : []).catch(() => []);
    if (Array.isArray(cities) && cities.some(city => city.id === requestedCity)) cityId = requestedCity;
  }
  let product: DetailProduct | null;
  try {
    product = await getProduct(decodeURIComponent(id), cityId);
  } catch {
    return <ProductLoadError returnTo={returnTo} />;
  }
  if (!product) notFound();
  const loginHref = productLoginUrl(`/products/${encodeURIComponent(product.id)}?${new URLSearchParams({ returnTo })}`);

  const researched = findResearchedDescription(product);
  const description = researched?.description ?? product.description;
  const pricedOffers = product.offers.filter(offer => offer.available && offer.priceMinor != null && /^\d+$/.test(offer.priceMinor));
  const cheapest = pricedOffers.every(offer => offer.currency === pricedOffers[0]?.currency)
    ? pricedOffers.reduce<(typeof pricedOffers)[number] | undefined>((best, offer) => !best || BigInt(offer.priceMinor!) < BigInt(best.priceMinor!) ? offer : best, undefined)
    : undefined;

  const media = findFallbackCatalogMedia(product) ?? (product.sourceUrl
    ? mediaCatalog.entries[
        product.sourceUrl as keyof typeof mediaCatalog.entries
      ]
    : undefined);

  return (
    <div className={styles.page}>
      <MarketplaceHeader />
      <main className={styles.shell}>
        <Link className={styles.back} href={returnTo}>
          ← Вернуться в каталог
        </Link>
        <section className={styles.hero}>
          <div className={styles.visual}>
            {media?.securePath ? (
              <img
                src={media.securePath}
                alt={media.altText ?? product.name}
                draggable={false}
              />
            ) : (
              <span>
                Фото товара
                <br />
                готовится
              </span>
            )}
          </div>
          <div className={styles.summary}>
            <h1>{product.name}</h1>
            {product.brand ? (
              <p className={styles.brand}>
                {product.brand}
                {product.manufacturer ? ` · ${product.manufacturer}` : ""}
              </p>
            ) : null}
            {description ? <p className={styles.description}>{description}</p> : null}
            {cheapest ? <p className={styles.summaryPrice}>от {formatCatalogMoney(cheapest.priceMinor, cheapest.currency)}<small>за единицу продажи · зависит от фасовки поставщика</small></p> : null}
            <div className={styles.heroActions}>
              <a className={styles.chooseSupplier} href="#supplier-offers">Выбрать поставщика</a>
              <span className={styles.trustNote}>Предложений: {product.offers.length}</span>
            </div>
          </div>
        </section>

        <section id="supplier-offers" className={styles.contentGrid} aria-label="Предложения поставщиков">
          <div className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>Предложения поставщиков</h2>
              </div>
              <span className={styles.offerCount}>{product.offers.length}</span>
            </div>
            <SupplierOffers key={JSON.stringify(product.offers)} offers={product.offers} loginHref={loginHref} />
          </div>
        </section>
      </main>
    </div>
  );
}
