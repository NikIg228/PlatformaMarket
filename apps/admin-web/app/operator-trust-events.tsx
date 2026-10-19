"use client";
import { useCallback, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, DmSurface, EmptyState, ErrorState, LoadingState } from "@marketplace/ui";
import { useOperatorProjection } from "./use-operator-projection";
import styles from "./operator-orders.module.css";

export function TrustEventList({ supplierId }: { supplierId: string }) {
  const [offset, setOffset] = useState(0);
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorTrustEvents(supplierId, offset, signal), [supplierId, offset]);
  const { data, loading, error, refresh } = useOperatorProjection(read, true);
  return <div className={styles.section} aria-busy={loading}>
    <p>Указанный тип источника не подтверждает автоматическое создание события. Список включает оспоренные, исключённые и старые записи; их наличие не означает включение в текущий расчёт.</p>
    {loading && (!data || data.offset !== offset) ? <LoadingState label="Загружаем события" /> : null}
    {error ? <ErrorState presentation="inline" title="События не обновлены" description={`${error}${data ? " Показана предыдущая загрузка." : ""}`} action={<DmButton onClick={() => void refresh()}>Повторить загрузку событий</DmButton>} /> : null}
    {data && data.offset === offset ? <><p>Всего записей: {data.total}.</p>{data.items.length === 0 ? <EmptyState title="Событий нет" description="Это не подтверждает отсутствие проблем у поставщика." /> : null}
      {data.items.map(event => <DmSurface variant="card" key={event.id}><div className={styles.section}><p>{event.metricCode} · значение {event.value} · {new Date(event.occurredAt).toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" })}</p><p>{event.origin === "MANUAL_RECORDED" ? "Зарегистрировано ручной командой (есть запись аудита)" : "Происхождение не подтверждено; возможна тестовая или импортированная запись"}</p><p>Указанный источник: {event.sourceEntityType} · {event.sourceEntityId}</p><p>{event.disputed ? "Оспаривается" : "Не отмечено как оспоренное"}{event.excludedAt ? " · Исключено из расчёта" : ""}</p></div></DmSurface>)}
      <nav className={styles.actions} aria-label="Страницы событий"><DmButton disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Предыдущие события</DmButton><span>Страница {offset / 25 + 1}</span><DmButton disabled={loading || offset + 25 >= data.total || offset >= 1000000} onClick={() => setOffset(offset + 25)}>Следующие события</DmButton></nav>
    </> : null}
  </div>;
}
