"use client";
import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DmButton } from "@marketplace/ui";
import type { SearchMedia, SearchProduct } from "../../catalog-search-types";
import { formatCatalogMoney, selectCatalogOffer } from "../../catalog/catalog-view-model";
import { catalogCardPresentation } from "./catalog-card-presentation";
import styles from "./compact-catalog.module.css";
const ProductQuickOffers = dynamic(() => import("./product-quick-offers"), { ssr: false, loading: () => <span role="status">Открываем предложения…</span> });
export function CompactProductCard({ product, returnUrl, imageSource }: { product: SearchProduct; returnUrl: string; imageSource: (media?: SearchMedia) => string | null }) {
  const [failed, setFailed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const href = `/products/${product.id}?returnTo=${encodeURIComponent(returnUrl)}`;
  const image = imageSource(product.media?.[0]);
  const offer = selectCatalogOffer(product);
  const presentation = catalogCardPresentation(product);
  return <article className={styles.frame} data-testid="product-card"><a className={styles.card} aria-label={`Открыть карточку: ${product.catalogName || product.name}`} href={`/products/${product.id}?returnTo=${encodeURIComponent(returnUrl)}`}>
    <div className={styles.photo}>{image && !failed ? <img src={image} alt={product.catalogName || product.name} loading="lazy" onError={() => setFailed(true)} /> : <span>Фото пока нет</span>}</div>
    {presentation.brand ? <p className={styles.brand}>{presentation.brand}</p> : null}
    <h2>{product.catalogName || product.name}</h2>
    {presentation.parameters ? <p className={styles.parameters}>{presentation.parameters}</p> : null}
    {product.manufacturerSku ? <p className={styles.sku}>Артикул: {product.manufacturerSku}</p> : null}
    <div className={styles.priceLine}><strong className={styles.price}>{offer ? `${product.offers.length > 1 ? "от " : ""}${formatCatalogMoney(offer.priceMinor, offer.currency ?? "KZT")}` : "Цена уточняется"}</strong>{offer?.packaging.name ? <span> / {offer.packaging.name}</span> : null}</div>
  </a><div className={styles.stockLine}><span>{presentation.supplierLabel}</span><span data-available={presentation.available}>{presentation.available ? "В наличии" : "Нет в наличии"}</span></div><div className={styles.quickActions}>
    <DmButton appearance="primary" aria-label={`Выбрать поставщика: ${product.catalogName || product.name}`}
      onClick={event => { trigger.current = event.currentTarget; setQuickOpen(true); }}>Выбрать поставщика</DmButton>
  </div>
  {quickOpen ? <ProductQuickOffers productId={product.id} name={product.catalogName || product.name} href={href}
    onClose={() => { setQuickOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }} /> : null}
  </article>;
}
