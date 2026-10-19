"use client";
import { useCallback } from "react";
import { Tab } from "@fluentui/react-components";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, DmFeedback, DmSurface, DmTabList, EmptyState, ErrorState, LoadingState } from "@marketplace/ui";
import { useOperatorProjection } from "./use-operator-projection";
import { useAdminQuery } from "./use-admin-query";
import { TrustIncidentCard, TrustSupplierCard } from "./operator-trust-cards";
import styles from "./operator-orders.module.css";

export function TrustOperations() {
  const { state, write } = useAdminQuery();
  const { trustView: view, trustIncidentOffset: incidentOffset, trustSupplierOffset: supplierOffset } = state;
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorTrust({ incidentOffset, supplierOffset }, signal), [incidentOffset, supplierOffset]);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  const incidents = data?.incidents.status === "AVAILABLE" ? data.incidents.data : null;
  const suppliers = data?.suppliers.status === "AVAILABLE" ? data.suppliers.data : null;
  const page = view === "incidents" ? incidents : suppliers;
  const offset = view === "incidents" ? incidentOffset : supplierOffset;
  const setOffset = (value: number) => write({ ...state, [view === "incidents" ? "trustIncidentOffset" : "trustSupplierOffset"]: value });
  const currentPage = page?.offset === offset;
  return <section className={styles.section} aria-label="Контроль доверия" aria-busy={loading}>
    <div className={styles.header}><h2>Инциденты и репутация</h2><DmButton disabled={loading} onClick={() => void refresh()}>Обновить Trust</DmButton></div>
    <DmFeedback tone="warning" title="Полнота событий не подтверждена" description="Автоматическое поступление событий заказов, оплат, доставки и импорта ещё не подтверждено. Рассчитанный балл сам по себе не доказывает качество реальной работы. Ручные и тестовые записи могут участвовать в расчёте." />
    {loading && !data ? <LoadingState label="Загружаем Trust" /> : null}
    {error ? <ErrorState presentation="inline" title="Trust не обновлён" description={`${error}${data ? " Ниже — последняя успешная загрузка; действия недоступны." : ""}`} action={<DmButton onClick={() => void refresh()}>Повторить загрузку Trust</DmButton>} /> : null}
    {data ? <>
      <p>Загружено: {new Date(data.observedAt).toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" })} (UTC+5){loading ? " · Обновление…" : ""}</p>
      <DmSurface variant="card"><dl className={styles.details}>
        <div><dt>Открытые инциденты</dt><dd>{incidents ? `${incidents.open} · жёстких ограничений: ${incidents.hardBlocks}` : "Данные недоступны"}</dd></div>
        <div><dt>Апелляции инцидентов без решения</dt><dd>{incidents ? incidents.pendingAppeals : "Данные недоступны"}</dd></div>
        <div><dt>Геопроверка складов</dt><dd>{data.warehouses.status === "AVAILABLE" ? `${data.warehouses.data.verified} из ${data.warehouses.data.total}` : data.warehouses.status === "FORBIDDEN" ? "Нет прав на просмотр складов" : "Источник складов недоступен"}</dd></div>
      </dl></DmSurface>
      <DmTabList selectedValue={view} onTabSelect={(_, value) => write({ ...state, trustView: value.value as "incidents" | "reputation" })} aria-label="Разделы Trust"><Tab id="trust-incidents-tab" value="incidents" aria-controls="trust-incidents">Инциденты и апелляции</Tab><Tab id="trust-reputation-tab" value="reputation" aria-controls="trust-reputation">Репутация</Tab></DmTabList>
      <div role="tabpanel" id={`trust-${view}`} aria-labelledby={`trust-${view}-tab`} className={styles.section}>
        {!page ? <ErrorState presentation="inline" title={(view === "incidents" ? data.incidents : data.suppliers).status === "FORBIDDEN" ? "Нет прав на этот источник" : "Источник недоступен"} description="Другие источники показаны независимо. Нельзя считать отсутствующие данные нулевыми." action={<DmButton onClick={() => void refresh()}>Повторить загрузку источников</DmButton>} /> : null}
        {page && !currentPage ? <LoadingState label="Загружаем выбранную страницу" /> : null}
        {page && currentPage ? <>
          <p>Всего: {page.total}. Показано: {page.items.length}{page.items.length ? ` · записи ${page.offset + 1}–${page.offset + page.items.length}` : ""}.</p>
          {page.items.length === 0 ? <EmptyState title={view === "incidents" ? "Инциденты не найдены" : "Поставщики не найдены"} description="Это результат чтения данного источника, а не подтверждение полноты автоматического контроля." /> : null}
          {view === "incidents" ? incidents?.items.map(incident => <TrustIncidentCard key={incident.id} incident={incident} canResolve={data.canResolve && !loading && !error} onResolved={refresh} />) : suppliers?.items.map(supplier => <TrustSupplierCard key={supplier.id} supplier={supplier} />)}
          <nav className={styles.actions} aria-label="Страницы Trust"><DmButton disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Предыдущая страница Trust</DmButton><span>Страница {offset / 25 + 1}</span><DmButton disabled={loading || offset + 25 >= page.total || offset >= 1000000} onClick={() => setOffset(offset + 25)}>Следующая страница Trust</DmButton>{offset > 0 ? <DmButton onClick={() => setOffset(0)}>В начало списка</DmButton> : null}</nav>
        </> : null}
      </div>
    </> : null}
  </section>;
}
