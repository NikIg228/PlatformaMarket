"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { frontendFeatures } from "@marketplace/api-client";
import { DmButton } from "@marketplace/ui/actions";
import type { SearchMedia, SearchProduct } from "../../catalog-search-types";
import type { MarketplaceCatalogState } from "../../catalog/marketplace-url";
import { CompactProductCard } from "./compact-product-card";
import { StorefrontProductCard } from "./storefront-product-card";
import { PromotionBanner } from "./promotion-banner";
import { usePromotionPage } from "./use-promotion-page";
import { catalogPromotionSlots, supportsCatalogPromotions } from "./promotion-display";
import { localPromotionPreviews } from "./local-promotion-previews";
import { PromotionPreviewBanner } from "./promotion-preview-banner";
import styles from "./compact-catalog.module.css";

export function CatalogProductGrid({ products, state, returnUrl, imageSource, storefront = false }: {
  storefront?: boolean;
  products: SearchProduct[]; state: MarketplaceCatalogState; returnUrl: string; imageSource: (media?: SearchMedia) => string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  // A supplier storefront must not insert generic campaigns or local previews.
  // Unsupported constraints must not introduce unrelated offers into exact search.
  const enabled = !storefront && frontendFeatures.promotions && supportsCatalogPromotions(state);
  const promotions = usePromotionPage({ limit: 3, offset: 0, featured: true,
    ...(state.categoryId ? { categoryId: state.categoryId } : {}),
    ...(state.supplierOrganizationId ? { supplierOrganizationId: state.supplierOrganizationId } : {}) }, enabled);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setColumns(getComputedStyle(node).gridTemplateColumns.split(" ").length);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  const slots = catalogPromotionSlots(products.length, columns);
  const previews = enabled && promotions.page?.total === 0 ? localPromotionPreviews({ categoryId: state.categoryId || undefined, supplierOrganizationId: state.supplierOrganizationId || undefined }).slice(0, 3) : [];
  const campaignCount = enabled ? promotions.items.length || previews.length : 0;
  const banner = (index: number, size: "strip" | "wide") => {
    if (previews[index]) return <PromotionPreviewBanner key={previews[index].id} item={previews[index]} size={size} />;
    const item = promotions.items[index];
    if (!item) return null;
    const product = products.find(product => product.id === item.productId);
    return <PromotionBanner key={item.id} item={item} image={imageSource(product?.media?.[0])} size={size} returnUrl={returnUrl} />;
  };
  return <>
    {enabled && promotions.error ? <div className={styles.promotionError}><span>Акции временно недоступны. Товары можно просматривать.</span><DmButton appearance="subtle" onClick={promotions.retry}>Повторить загрузку акций</DmButton></div> : null}
    {enabled && promotions.loading ? <p role="status">Загружаем акции…</p> : null}
    <div ref={ref} className={styles.grid}>
      {products.map((product, index) => <Fragment key={product.id}>
        {storefront ? <StorefrontProductCard product={product} returnUrl={returnUrl} imageSource={imageSource} locale={state.lang ?? "ru"} /> : <CompactProductCard product={product} returnUrl={returnUrl} imageSource={imageSource} />}
        {index + 1 === slots.first && campaignCount > 0 ? <div className={styles.campaignSlot}>{banner(0, "strip")}</div> : null}
        {index + 1 === slots.second && campaignCount > 1 ? <div className={styles.campaignSlot}>{banner(1, "wide")}</div> : null}
      </Fragment>)}
    </div>
  </>;
}
