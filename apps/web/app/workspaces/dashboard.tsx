"use client";
import Link from "next/link";
import { useCallback } from "react";
import { DmButton, ErrorState, LoadingState } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import styles from "./workspace.module.css";

export default function Dashboard() {
  const { api, organizationId, session } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.workspaceSummary({ signal }), [api, organizationId]);
  const resource = useResource(load, { intervalMs: 30_000 });
  return <div className={styles.stack}>
    <header className={styles.heading}>
      <div><h1>{session.organizationDisplayName ?? "Кабинет поставщика"}</h1><p>Заказы и товары вашей организации</p></div>
      <DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить</DmButton>
    </header>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : resource.initialLoading ? <LoadingState label="Загружаем сводку" /> : null}
    <div className={styles.cards}>
      <section className={styles.panel}>
        <h2>Заказы</h2>
        {resource.data ? <p className={styles.metric}>{resource.data.orders}</p> : null}
        <Link href="/supplier/orders">Открыть заказы →</Link>
        <p><Link href="/supplier/analytics">Аналитика продаж и комиссии →</Link></p>
      </section>
      <section className={styles.panel}>
        <h2>Товары</h2>
        {resource.data ? <><p className={styles.metric}>{resource.data.offers}</p><p>В каталоге: {resource.data.publishedOffers}</p></> : null}
        <Link href="/supplier/products">Управлять товарами →</Link>
      </section>
      <section className={styles.panel}>
        <h2>Организация</h2><p>Проверьте реквизиты, склад и готовность к публикации предложений.</p>
        <Link href="/supplier/settings">Настройки →</Link><p><Link href="/supplier/documents">Договор и документы →</Link></p>
      </section>
    </div>
  </div>;
}
