"use client";
import { useRef, useState } from "react";
import { DmButton, DmDialog, DmSurface } from "@marketplace/ui";
import { ZoomIn24Regular } from "@fluentui/react-icons";
import styles from "./product-detail.module.css";

export function ProductGallery({ image, name }: { image: { src: string; alt: string } | null; name: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return <div className={styles.gallery}>
    <DmSurface className={styles.visual}>
      {image ? <><img src={image.src} alt={image.alt} draggable={false} />
        <div className={styles.zoom}><DmButton ref={opener} icon={<ZoomIn24Regular />} aria-label="Увеличить фото товара" onClick={() => setOpen(true)} /></div></>
        : <p className={styles.muted}>Фото товара пока не добавлено</p>}
    </DmSurface>
    <p className={styles.caption}>Изображение справочное. Комплектацию проверяйте по выбранному варианту и фасовке.</p>
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => opener.current?.focus()} title={name}>
      {image ? <img className={styles.enlarged} src={image.src} alt={image.alt} /> : null}
    </DmDialog>
  </div>;
}
