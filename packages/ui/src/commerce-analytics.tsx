"use client";
import { useEffect, useMemo, useState } from "react";
import { commerceAnalyticsQuerySchema, type CommerceAnalyticsQuery, type CommerceAnalyticsResponse, type CommerceMetricTotals } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, EmptyState, ErrorState, LoadingState, formatMoney } from "./index";
import { analyticsDateRange } from "./commerce-analytics-date";

type Props = { load: (query: CommerceAnalyticsQuery, signal: AbortSignal) => Promise<CommerceAnalyticsResponse>; orderHref: (id: string) => string; operator?: boolean };
const kinds: Record<string, string> = { CREATED: "Оформлен", CONFIRMED: "Подтверждён", RECEIVED: "Получен товар", RETURNED: "Возвращён товар", FULFILLED: "Исполнен", CANCELLED: "Отменён", REFUSED_PRICE: "Отказ: цена", REFUSED_STOCK: "Отказ: остаток", REFUSED_OTHER: "Отказ: другое" };
const datasets = { BUSINESS: "Рабочие", DEMO: "Демонстрационные", TEST: "Тестовые", UNCLASSIFIED: "Не классифицированы" } as const;
function today() { return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10); }
function Summary({ value }: { value: CommerceMetricTotals }) {
  return <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "var(--dm-space-4)", margin: 0 }}>
    {[["Создано заказов", value.createdOrders], ["Оборот созданных заказов", formatMoney(value.createdGoodsMinor, "KZT")],
      ["Подтверждено заказов", value.confirmedOrders], ["Подтверждено товаров", formatMoney(value.confirmedGoodsMinor, "KZT")],
      ["Заказов с получением", value.receivedOrders], ["Исполнено заказов", value.fulfilledOrders], ["Отменено заказов", value.cancelledOrders],
      ["Получено товаров", formatMoney(value.receivedGoodsMinor, "KZT")], ["Возвращено товаров", formatMoney(value.returnedGoodsMinor, "KZT")],
      ["Получение минус возвраты за период", formatMoney(value.netReceivedGoodsMinor, "KZT")],
      ["Предварительная комиссия", formatMoney(value.preliminaryCommissionMinor, "KZT")], ["Начисление / корректировка комиссии", formatMoney(value.accruedCommissionMinor, "KZT")],
      ["Полученная комиссия", "Не учитывается"], ["Задолженность по комиссии", "Не учитывается"],
      ["Отказы: цена / остаток / другое", `${value.refusedPriceOrders} / ${value.refusedStockOrders} / ${value.refusedOtherOrders}`]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd style={{ margin: "var(--dm-space-2) 0 0", fontSize: "var(--dm-font-size-title)", fontWeight: "var(--dm-font-weight-semibold)", overflowWrap: "anywhere" }}>{amount}</dd></div>)}
  </dl>;
}
export function CommerceAnalytics({ load, orderHref, operator = false }: Props) {
  const [from, setFrom] = useState(() => today().slice(0, 8) + "01"), [through, setThrough] = useState(today);
  const [timezone, setTimezone] = useState<"Asia/Qyzylorda" | "UTC">("Asia/Qyzylorda");
  const [dataset, setDataset] = useState<CommerceAnalyticsQuery["dataset"]>("BUSINESS");
  const [organizationId, setOrganizationId] = useState<string>(), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [data, setData] = useState<CommerceAnalyticsResponse | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false);
  const parsed = useMemo(() => commerceAnalyticsQuerySchema.safeParse({ ...analyticsDateRange(from, through, timezone), timezone, dataset, organizationId, page, pageSize: 25 }), [from, through, timezone, dataset, organizationId, page]);
  useEffect(() => {
    setData(null); setError(null);
    if (!parsed.success) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    void load(parsed.data, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(() => {
      if (!controller.signal.aborted) setError("Не удалось загрузить аналитику. Проверьте соединение и доступ к организации, затем повторите попытку.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, parsed, revision]);
  const filter = (change: () => void) => { change(); setPage(1); };
  return <section aria-label="Аналитика заказов и комиссии" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--dm-space-6)", minWidth: 0 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--dm-space-3)", alignItems: "end" }}>
      <DmField label="С даты"><DmInput type="date" value={from} onChange={(_, value) => filter(() => setFrom(value.value))} /></DmField>
      <DmField label="По дату включительно"><DmInput type="date" value={through} onChange={(_, value) => filter(() => setThrough(value.value))} /></DmField>
      <DmField label="Часовой пояс"><DmSelect value={timezone} onChange={event => filter(() => setTimezone(event.target.value as typeof timezone))}><option value="Asia/Qyzylorda">Кызылорда (UTC+5)</option><option value="UTC">UTC</option></DmSelect></DmField>
      <DmField label="Набор данных"><DmSelect value={dataset} onChange={event => filter(() => setDataset(event.target.value as typeof dataset))}>{Object.entries(datasets).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
      <DmButton disabled={loading || !parsed.success} onClick={() => setRevision(value => value + 1)}>Обновить аналитику</DmButton>
      {organizationId ? <DmButton onClick={() => filter(() => setOrganizationId(undefined))}>Все организации</DmButton> : null}
    </div>
    {!parsed.success ? <p role="alert">Выберите даты: окончание не раньше начала, период — не больше 93 дней.</p> : null}
    {loading ? <LoadingState label="Загружаем аналитику" /> : null}
    {error ? <ErrorState description={error} action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить загрузку</DmButton>} /> : null}
    {data ? <>
      <p>События за выбранный период · {datasets[data.dataset]} · KZT. Комиссия 10% с полученного товара после скидок, с корректировкой возвратов. Оборот не является доходом площадки.</p>
      <Summary value={data.totals} />
      <p>Повторные покупатели после исполнения за 30 / 60 дней: <strong>{data.repeatBuyers30Days} / {data.repeatBuyers60Days}</strong>. Просроченные поставки сейчас: <strong>{data.overdueShipmentsAsOfNow}</strong>.</p>
      <p role="note">{data.coverage.note} Заказов периода без событий оформления: {data.coverage.untrackedOrdersInPeriod}. Обновлено {new Intl.DateTimeFormat("ru-KZ", { dateStyle: "short", timeStyle: "short", timeZone: data.period.timezone }).format(new Date(data.generatedAt))}.</p>
      <div><h3>Организации</h3><p>Одна сделка видна у обеих сторон. Строки сторон не суммируются повторно в общий оборот.</p>
        <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Оборот организаций"><table style={{ width: "100%", borderSpacing: "12px 10px" }}><thead><tr><th scope="col">Организация</th><th scope="col">Сторона</th><th scope="col">Создано товаров</th><th scope="col">Получение минус возвраты</th><th scope="col">Комиссия</th></tr></thead><tbody>
          {data.organizations.map(row => <tr key={`${row.organizationId}:${row.side}`}><th scope="row">{operator ? <DmButton appearance="subtle" onClick={() => filter(() => setOrganizationId(row.organizationId))}>{row.name}</DmButton> : row.name}</th><td>{row.side === "BUYER" ? "Покупатель" : "Поставщик"}</td><td>{formatMoney(row.totals.createdGoodsMinor, "KZT")}</td><td>{formatMoney(row.totals.netReceivedGoodsMinor, "KZT")}</td><td>{formatMoney(row.totals.accruedCommissionMinor, "KZT")}</td></tr>)}
        </tbody></table></div>{data.organizationsTruncated ? <p>Показаны первые 200 разрезов. Сократите период.</p> : null}
      </div>
      <div><h3>События заказов</h3>{data.totalEvents === 0 ? <EmptyState title="Нет событий за этот период" description="Измените даты или набор данных. Старые заказы могут не иметь истории аналитики." /> : <>
        <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="События заказов"><table style={{ width: "100%", borderSpacing: "12px 10px" }}><thead><tr><th scope="col">Дата</th><th scope="col">Заказ</th><th scope="col">Событие</th><th scope="col">Товары</th><th scope="col">Комиссия</th></tr></thead><tbody>{data.events.map(event => <tr key={event.id}><td>{new Intl.DateTimeFormat("ru-KZ", { dateStyle: "short", timeStyle: "short", timeZone: data.period.timezone }).format(new Date(event.occurredAt))}</td><td><a href={orderHref(event.orderId)}>{event.orderNumber}</a></td><td>{kinds[event.kind]}</td><td>{formatMoney(event.goodsAmountMinor, "KZT")}</td><td>{formatMoney(event.commissionAmountMinor, "KZT")}</td></tr>)}</tbody></table></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--dm-space-3)", alignItems: "center" }}><DmButton disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Предыдущие события</DmButton><span>Страница {page} · событий {data.totalEvents}</span><DmButton disabled={page * data.pageSize >= data.totalEvents} onClick={() => setPage(value => value + 1)}>Следующие события</DmButton></div>
      </>}</div>
    </> : null}
  </section>;
}
