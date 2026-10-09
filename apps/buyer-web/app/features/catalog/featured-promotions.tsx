import Link from "next/link";
import type { PublicPromotionPage } from "@marketplace/schemas";
import { DmButton, EmptyState, ErrorState, LoadingState, formatDate, formatMoney } from "@marketplace/ui";
import styles from "./featured-promotions.module.css";

export function FeaturedPromotions({ page, loading, error, onRetry }: {
  page: PublicPromotionPage | null; loading: boolean; error: string | null; onRetry: () => void;
}) {
  return <section aria-label="Акции">
    {loading ? <LoadingState label="Загружаем акции" /> : error ? <ErrorState description={error} action={<DmButton onClick={onRetry}>Повторить загрузку акций</DmButton>} /> : page?.items.length ? <div className={styles.rail}>
      {page.items.map(item => <Link className={styles.card} key={item.id} href={`/products/${item.productId}`}>
        <strong className={styles.discount}>{item.terms.kind === "PERCENTAGE" ? `−${(item.terms.percentageBasisPoints ?? 0) / 100}%` : item.terms.kind === "BUY_X_GET_Y" ? `${item.terms.buyQuantity} + ${item.terms.giftQuantity}` : `−${formatMoney(item.terms.fixedAmountMinor ?? "0", item.currency)}`}</strong>
        <span className={styles.name}>{item.terms.name}</span>
        <span>{item.offerName} · {item.supplierName}</span>
        <span>{item.terms.kind === "BUY_X_GET_Y" ? `Подарок: ${item.giftName}` : formatMoney(item.unitPriceMinor, item.currency)}</span>
        <span className={styles.terms}>От {item.terms.minimumQuantity} · до {formatDate(item.terms.endsAt)}</span>
      </Link>)}
    </div> : <EmptyState title="Действующих акций нет" description="Новые предложения появятся здесь." />}
  </section>;
}
