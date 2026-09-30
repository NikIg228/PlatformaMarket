"use client";
import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DmButton } from "@marketplace/ui";
import type { SearchMedia, SearchProduct } from "../../catalog-search-types";
import { formatCatalogMoney, selectCatalogOffer } from "../../catalog/catalog-view-model";
import styles from "./compact-catalog.module.css";
const ProductQuickOffers = dynamic(() => import("./product-quick-offers"), { ssr: false, loading: () => <span role="status">Открываем предложения…</span> });
export function CompactProductCard({ product, returnUrl, imageSource }: { product: SearchProduct; returnUrl: string; imageSource: (media?: SearchMedia) => string | null }) {
  const [failed, setFailed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const href = `/products/${product.id}?returnTo=${encodeURIComponent(returnUrl)}`;
  const image = imageSource(product.media?.[0]);
  const offer = selectCatalogOffer(product);
  const names = [...new Set(product.categories.map(c => c.name.trim()).filter(Boolean))];
  return <article className={styles.frame} data-testid="product-card"><a className={styles.card} aria-label={`Открыть карточку: ${product.catalogName || product.name}`} href={`/products/${product.id}?returnTo=${encodeURIComponent(returnUrl)}`}>
    <div className={styles.photo}>{image && !failed ? <img src={image} alt={product.catalogName || product.name} loading="lazy" onError={() => setFailed(true)} /> : <span>Фото пока нет</span>}</div>
    <div className={styles.chips}>{names.map(name => <span key={name}>{name}</span>)}</div>
    <h2>{product.catalogName || product.name}</h2>
    {product.manufacturerSku ? <p className={styles.sku}>Артикул: {product.manufacturerSku}</p> : null}
    <strong className={styles.price}>{offer ? `${product.offers.length > 1 ? "от " : ""}${formatCatalogMoney(offer.priceMinor, offer.currency ?? "KZT")}` : "Цена уточняется"}</strong>
  </a><div className={styles.quickActions}>
    <DmButton appearance="primary" aria-label={`Выбрать поставщика: ${product.catalogName || product.name}`}
      onClick={event => { trigger.current = event.currentTarget; setQuickOpen(true); }}>В корзину</DmButton>
    <a href={href}>Подробнее</a>
  </div>
  {quickOpen ? <ProductQuickOffers productId={product.id} name={product.catalogName || product.name} href={href}
    onClose={() => { setQuickOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }} /> : null}
  </article>;
}
