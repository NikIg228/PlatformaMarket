import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import catalog from "../../data/public-catalog-fallback.json";
import mediaCatalog from "../../data/public-catalog-media.json";
import { findFallbackCatalogMedia } from "../../catalog-fallback.server";
import { findResearchedDescription } from "../../features/catalog/researched-product-description";
import { ProductDetail } from "../../features/product-detail/product-detail";
import ProductLoadError from "./product-load-error";
import { safeCatalogReturn } from "../../catalog/marketplace-url";
import { compactProductTitle } from "../../catalog/product-title";
import { localProductPreview, previewDocumentLinks } from "../../features/product-detail/local-preview";
import { selectionFromQuery } from "../../features/product-detail/model";

const API_URL = process.env.INTERNAL_API_URL ?? (process.env.NEXT_PUBLIC_API_URL?.startsWith("http") ? process.env.NEXT_PUBLIC_API_URL : "http://127.0.0.1:4012/api");
const getProduct = cache(async (id: string) => {
  try { return await new MarketplaceApiClient(API_URL, {}).comparePublicOffers(id, { quantity: 1 }); }
  catch (cause) { if (cause instanceof MarketplaceApiError && cause.status === 404) return null; throw cause; }
});
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const comparison = await getProduct(decodeURIComponent(id)).catch(() => null);
  const description = comparison ? findResearchedDescription(comparison.product)?.description
    ?? catalog.products.find(item => item.id === comparison.product.id && item.name === comparison.product.name)?.description : undefined;
  return { title: comparison ? `${compactProductTitle(comparison.product.name, localProductPreview(comparison.product)?.title)} | PlatformaMarket` : "Карточка товара | PlatformaMarket", description };
}
export default async function ProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; variant?: string; packaging?: string; offer?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeCatalogReturn(query.returnTo);
  let comparison;
  try { comparison = await getProduct(decodeURIComponent(id)); }
  catch { return <ProductLoadError returnTo={returnTo} />; }
  if (!comparison) notFound();
  const product = comparison.product;
  const selection = selectionFromQuery(comparison, new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
  const reference = catalog.products.find(item => item.id === product.id && item.name === product.name);
  const researched = findResearchedDescription(product);
  const preview = localProductPreview(product);
  const media = findFallbackCatalogMedia(product) ?? (reference?.sourceUrl ? mediaCatalog.entries[reference.sourceUrl as keyof typeof mediaCatalog.entries] : undefined);
  return <ProductDetail key={product.id} initial={comparison} returnTo={returnTo}
    initialVariant={selection.variant} initialPackage={selection.packaging}
    displayName={preview?.title}
    documents={preview ? previewDocumentLinks(preview) : []}
    description={preview?.description ?? researched?.description ?? reference?.description ?? null}
    sourceUrl={preview ? null : researched?.sourceUrl ?? reference?.sourceUrl ?? null}
    image={media?.securePath ? { src: media.securePath, alt: media.altText ?? product.name } : null} />;
}
