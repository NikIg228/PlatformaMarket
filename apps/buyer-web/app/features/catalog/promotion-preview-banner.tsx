"use client";
import { useRef, useState } from "react";
import { DmButton, DmDialog, formatDate } from "@marketplace/ui";
import type { PromotionPreview } from "./local-promotion-previews";
import styles from "./promotion-banner.module.css";

export function PromotionPreviewBanner({ item, size = "regular" }: { item: PromotionPreview; size?: "regular" | "hero" | "wide" | "strip" }) {
  const [open, setOpen] = useState(false);
  const [brokenImage, setBrokenImage] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return <article className={`${styles.banner} ${styles.preview}`} data-size={size} data-tone={item.tone} aria-label={`Акция: ${item.title}`}>
    {size !== "strip" && brokenImage !== item.image ? <img className={styles.backdrop} src={item.image} alt="" loading="lazy" onError={() => setBrokenImage(item.image)} /> : null}
    <div className={styles.copy}>
      <p className={styles.meta}>{item.supplier} · до {formatDate(item.endsAt)}</p>
      <h2>{item.title}</h2>
      <strong className={styles.benefit}>{item.benefit}</strong>
      <p className={styles.offer}>{item.subtitle}</p>
      <div className={styles.action}><DmButton appearance="primary" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}>Смотреть акцию</DmButton></div>
    </div>
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => trigger.current?.focus({ preventScroll: true })} title={item.title} description={item.supplier}
      actions={<DmButton onClick={() => setOpen(false)}>Закрыть</DmButton>}>
      <div className={styles.terms}><strong>{item.benefit}</strong><p>{item.conditions}</p><p>Срок: до {formatDate(item.endsAt)}.</p></div>
    </DmDialog>
  </article>;
}
