"use client";
import { useEffect, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { PublicPromotion } from "@marketplace/schemas";
import { DmButton, DmDialog, formatDate, formatMoney } from "@marketplace/ui";
import { catalogMediaSource } from "../../catalog/catalog-media-source";
import { promotionProductHref } from "./promotion-display";
import styles from "./promotion-banner.module.css";

// Fetch only visible campaign photos through the existing public catalog contract.
// Match identity, never use a similar search result as the advertised product.
const photos = new Map<string, string | null>();
function usePromotionPhoto(item: PublicPromotion, supplied?: string | null) {
  const ref = useRef<HTMLElement>(null);
  const [src, setSrc] = useState<string | null>(supplied ?? photos.get(item.productId) ?? null);
  useEffect(() => {
    setSrc(supplied ?? photos.get(item.productId) ?? null);
    if (supplied || photos.has(item.productId) || !ref.current) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
      void api.searchPublicCatalog({ q: item.offerName.slice(0, 160), limit: 5, offset: 0 }).then(page => {
        const media = page.items.find(product => product.id === item.productId)?.media?.[0];
        const metadata = media?.metadata && typeof media.metadata === "object" ? media.metadata as Record<string, unknown> : null;
        const photo = media ? catalogMediaSource({ ...media, metadata: metadata ? {
          exactProductPhoto: metadata.exactProductPhoto === true,
          sourceImageUrl: typeof metadata.sourceImageUrl === "string" ? metadata.sourceImageUrl : null,
        } : null }) : null;
        photos.set(item.productId, photo);
        if (active) setSrc(photo);
      }).catch(() => { /* Campaign terms stay usable when optional photography is unavailable. */ });
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => { active = false; observer.disconnect(); };
  }, [item.productId, item.offerName, supplied]);
  return { ref, src };
}

export function PromotionBanner({ item, image, size = "regular", returnUrl }: { item: PublicPromotion; image?: string | null; size?: "regular" | "hero" | "wide" | "strip"; returnUrl?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [broken, setBroken] = useState(false);
  const { ref, src } = usePromotionPhoto(item, image);
  useEffect(() => setBroken(false), [src]);
  const benefit = item.terms.kind === "PERCENTAGE" ? `−${(item.terms.percentageBasisPoints ?? 0) / 100}%`
    : item.terms.kind === "FIXED_AMOUNT" ? `−${formatMoney(item.terms.fixedAmountMinor ?? "0", item.currency)}`
    : `${item.terms.buyQuantity} + ${item.terms.giftQuantity} в подарок`;
  return <article ref={ref} className={styles.banner} data-size={size} data-kind={item.terms.kind} aria-label={`Акция: ${item.terms.name}`}>
    <div className={styles.copy}>
      <p className={styles.meta}>{item.supplierName} · до {formatDate(item.terms.endsAt)}</p>
      <h2>{item.terms.name}</h2><strong className={styles.benefit}>{benefit}</strong>
      <p className={styles.offer}>{item.offerName}</p>
      {item.terms.kind === "BUY_X_GET_Y" ? <p className={styles.meta}>Подарок: {item.giftName}</p> : null}
      <div className={styles.action}><DmButton appearance="primary" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}>Смотреть акцию</DmButton></div>
    </div>
    {size !== "strip" && src && !broken ? <div className={styles.art}><img src={src} alt={item.offerName} loading="lazy" onError={() => setBroken(true)} /></div> : null}
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => trigger.current?.focus({ preventScroll: true })} title={item.terms.name}
      description={`${item.supplierName} · ${item.offerName}`}
      actions={<><DmButton onClick={() => setOpen(false)}>Закрыть</DmButton><DmButton as="a" appearance="primary" href={promotionProductHref(item, returnUrl)}>Выбрать предложение</DmButton></>}>
      <div className={styles.terms}>
        <strong>{benefit}</strong><p>{item.terms.description}</p>
        {item.terms.kind === "BUY_X_GET_Y" ? <p>Купите {item.terms.buyQuantity} ед. — получите {item.giftName} × {item.terms.giftQuantity}. Цена единицы покупки: {formatMoney(item.unitPriceMinor, item.currency)}.</p>
          : <p>Обычная цена: <s>{formatMoney(item.baseAmountMinor, item.currency)}</s>. По акции: <strong>{formatMoney(item.unitPriceMinor, item.currency)}</strong> за единицу продажи.</p>}
        <p>Минимальное количество: {item.terms.minimumQuantity}. Действует до {formatDate(item.terms.endsAt)} в пределах доступного количества.</p>
        <p>С другими скидками не суммируется. При оформлении проверим актуальность условий и наличие.</p>
      </div>
    </DmDialog>
  </article>;
}
