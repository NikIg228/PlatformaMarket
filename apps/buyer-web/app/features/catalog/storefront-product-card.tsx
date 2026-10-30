"use client";
import { useState, type MouseEvent } from "react";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { Circle12Filled } from "@fluentui/react-icons/svg/circle";
import type { SearchMedia, SearchProduct } from "../../catalog-search-types";
import { formatCatalogMoney, selectCatalogOffer } from "../../catalog/catalog-view-model";
import { compactProductTitle } from "../../catalog/product-title";
import { rememberCatalogPosition } from "./catalog-position";
import styles from "./storefront-product-card.module.css";

/** The supplier is already selected by this page's server-scoped catalogue. */
export function StorefrontProductCard({ product, returnUrl, imageSource, locale = "ru" }: {
  product: SearchProduct;
  returnUrl: string;
  imageSource: (media?: SearchMedia) => string | null;
  locale?: "ru" | "kk";
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const image = imageSource(product.media?.[0]);
  const offer = selectCatalogOffer(product);
  const available = product.offers.some(item => item.available);
  const title = compactProductTitle(product.name, product.catalogName);
  const href = `/products/${product.id}?returnTo=${encodeURIComponent(returnUrl)}`;
  const t = locale === "kk"
    ? { photo: "Фото әлі жоқ", available: "Қолда бар", unavailable: "Қолда жоқ", price: "Бағасы нақтылануда", details: "Толығырақ", open: "Тауарды ашу" }
    : { photo: "Фото пока нет", available: "В наличии", unavailable: "Нет в наличии", price: "Цена уточняется", details: "Подробнее", open: "Открыть карточку" };
  const remember = (event: MouseEvent<HTMLAnchorElement>) => {
    const card = event.currentTarget.closest("article");
    if (card && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) rememberCatalogPosition(returnUrl, product.id, card);
  };
  return <article data-testid="product-card" data-catalog-product={product.id} className={styles.article}>
    <DmSurface className={styles.surface}>
      <a className={styles.product} href={href} onClick={remember} aria-label={`${t.open}: ${title}`}>
        <div className={styles.photo}>{image && failedSource !== image
          ? <img src={image} alt={title} loading="lazy" onError={() => setFailedSource(image)} />
          : <span>{t.photo}</span>}</div>
        <h2 className={styles.title}>{title}</h2>
      </a>
      <div className={styles.summary}>
        <p className={styles.stock} data-available={available}><Circle12Filled aria-hidden="true" />{available ? t.available : t.unavailable}</p>
        <p className={styles.price}>{offer ? <><strong>{product.offers.length > 1 ? (locale === "kk" ? "бастап " : "от ") : ""}{formatCatalogMoney(offer.priceMinor, offer.currency ?? "KZT")}</strong>{offer.packaging.name ? <span> / {offer.packaging.name}</span> : null}</> : <span>{t.price}</span>}</p>
        <DmButton as="a" href={href} onClick={remember} fullWidth aria-label={`${t.details}: ${title}`}>{t.details}</DmButton>
      </div>
    </DmSurface>
  </article>;
}
