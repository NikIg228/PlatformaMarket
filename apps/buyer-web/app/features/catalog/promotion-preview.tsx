import Image from "next/image";
import Link from "next/link";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import styles from "./promotion-preview.module.css";

const cards = [
  ["composites", "Скидка 20% на композиты"],
  ["gloves", "Перчатки: 10 упаковок покупаете, 1 упаковка в подарок"],
  ["adhesive", "Адгезив в подарок при покупке 5 композитов"],
  ["burs", "Наборы боров: три покупаете, четвёртый в подарок"],
  ["impressions", "Скидка 15% на слепочные материалы"],
] as const;

/** Owner-requested visual examples; never represent purchasable promotions. */
export function PromotionPreview() {
  return <div className={styles.preview}>
    <div className={styles.rail} role="region" aria-label="Акции">
      {cards.map(([id, description]) => <Image key={id}
        className={styles.card} src={`/promotion-preview/${id}.webp`}
        alt={description} width={608} height={608} unoptimized />)}
    </div>
    <Link href="/promotions" {...dmLinkButtonProps({ className: styles.allPromotions })}>Все акции</Link>
  </div>;
}
