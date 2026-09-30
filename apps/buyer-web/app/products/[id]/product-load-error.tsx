"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DmButton, ErrorState } from "@marketplace/ui";
import { MarketplaceHeader } from "../../features/marketplace-header/marketplace-header";
import styles from "./page.module.css";

export default function ProductLoadError({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className={styles.page}>
    <MarketplaceHeader />
    <main className={styles.shell} aria-busy={pending}>
      <Link className={styles.back} href={returnTo}>← Вернуться в каталог</Link>
      <ErrorState title="Не удалось загрузить предложения"
        description="Сервис временно недоступен. Повторите загрузку. Выбранный город и фильтры сохранены."
        action={<DmButton disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          {pending ? "Загружаем…" : "Повторить загрузку"}
        </DmButton>} />
    </main>
  </div>;
}
