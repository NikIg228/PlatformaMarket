"use client";
import { useCallback } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, DmSurface, ErrorState, LoadingState } from "@marketplace/ui";
import { useOperatorProjection } from "./use-operator-projection";
import { OperatorDeadLetters } from "./operator-dead-letters";
import { auditTime } from "./operator-audit";
import styles from "./operator-orders.module.css";
const unavailable = (status: string) => status === "FORBIDDEN" ? "Нет прав на этот источник." : "Источник недоступен. Повторите обновление.";
export function OperatorTechnical() {
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorTechnical(signal), []);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  return <section className={styles.section} aria-label="Технический контроль"><div className={styles.header}><h2>Технический контроль</h2><DmButton disabled={loading} onClick={() => void refresh()}>Обновить состояние</DmButton></div>
    <p>Текущее состояние источников. Постановка события в очередь не подтверждает его обработку.</p>
    {loading && !data ? <LoadingState label="Проверяем источники" /> : null}
    {error ? <ErrorState presentation="inline" title="Состояние не обновлено" description={error} action={<DmButton onClick={() => void refresh()}>Повторить проверку</DmButton>} /> : null}
    {data ? <><p>Срез: {auditTime(data.observedAt)}{loading || error ? " · Последняя загрузка" : ""}</p><div className={styles.details}>
      <DmSurface variant="card" className={styles.section}><h3>Поисковый индекс</h3>{data.search.status === "AVAILABLE" ? <><p>Товаров: {data.search.data.products} · В индексе: {data.search.data.indexed} · Без индекса: {data.search.data.missing}</p><p>Последняя индексация: {data.search.data.lastIndexedAt ? auditTime(data.search.data.lastIndexedAt) : "Нет данных"}</p></> : <p>{unavailable(data.search.status)}</p>}</DmSurface>
      <DmSurface variant="card" className={styles.section}><h3>События outbox</h3>{data.outbox.status === "AVAILABLE" ? <><p>Ожидают: {data.outbox.data.pending} · Обрабатываются: {data.outbox.data.processing}</p><p>Ошибки: {data.outbox.data.failed} · Исчерпали попытки: {data.outbox.data.deadLetter} · Опубликованы: {data.outbox.data.published}</p></> : <p>{unavailable(data.outbox.status)}</p>}</DmSurface>
      <DmSurface variant="card" className={styles.section}><h3>Уведомления</h3>{data.notifications.status === "AVAILABLE" ? <><p>Ожидают: {data.notifications.data.pending} · Обрабатываются: {data.notifications.data.processing} · Отправлены: {data.notifications.data.sent}</p><p>Ошибки: {data.notifications.data.failed} · Исчерпали попытки: {data.notifications.data.dead} · Отменены: {data.notifications.data.cancelled}</p></> : <p>{unavailable(data.notifications.status)}</p>}</DmSurface>
      <DmSurface variant="card" className={styles.section}><h3>Фоновая очередь</h3><p>Проверен только текущий процесс API. Этот срез не подтверждает работоспособность отдельного worker.</p>{data.background.status === "AVAILABLE" ? <><p>{data.background.data.configured ? data.background.data.status === "ok" ? "Подключение доступно" : "Ошибка подключения" : "Очередь не настроена"}</p>{data.background.data.counts ? <p>Ожидают: {data.background.data.counts.waiting} · Активны: {data.background.data.counts.active} · Ошибки: {data.background.data.counts.failed} · Отложены: {data.background.data.counts.delayed}</p> : <p>Счётчики недоступны.</p>}</> : <p>{unavailable(data.background.status)}</p>}</DmSurface>
    </div></> : null}
    <OperatorDeadLetters canReplay={Boolean(data?.canReplay && !error && !loading)} onReplayed={refresh} />
  </section>;
}
