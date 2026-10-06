"use client";
import { DmAction } from "@marketplace/ui/controls";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowClockwise20Regular } from "@fluentui/react-icons/svg/arrow-clockwise";
import { ChartMultiple20Regular } from "@fluentui/react-icons/svg/chart-multiple";
import { DmButton, DmSearch, DmDropdown, EmptyState, ErrorState, LoadingState, StatusTag, formatDate, formatMoney, orderStatusLabel, orderStatusTone, orderPaymentPresentation, orderItemCount } from "@marketplace/ui";
import { workspaceOrderStatusSchema, workspaceOrderGroupSchema, type WorkspaceOrderPage } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PageNavigation, usePageNavigation } from "./page-navigation";
import styles from "./orders.module.css";

const groups = [["", "Все"], ["attention", "Требуют действия"], ["active", "В работе"], ["completed", "Завершённые"], ["cancelled", "Отменённые"]] as const;
export default function Orders() {
  const { api, role, organizationId } = useWorkspace();
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const appliedQuery = search.get("q") ?? "";
  const status = workspaceOrderStatusSchema.safeParse(search.get("status")).data;
  const group = workspaceOrderGroupSchema.safeParse(search.get("group")).data;
  const [query, setQuery] = useState(appliedQuery);
  useEffect(() => setQuery(appliedQuery), [appliedQuery]);
  const navigation = usePageNavigation();
  const change = (key: string, value: string) => { navigation.reset(); const params = new URLSearchParams(search.toString()); if (value) params.set(key, value); else params.delete(key); router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }); };
  const load = useCallback((signal: AbortSignal) => api.workspaceOrders(role === "clinic" ? "buyer" : "supplier", { q: appliedQuery, status, group, cursor: navigation.cursor }, { signal }), [api, role, organizationId, appliedQuery, status, group, navigation.cursor]);
  const resource = useResource(load, { intervalMs: 30_000 });
  const refresh = () => void resource.refresh();
  const visible = resource.data?.items ?? [];
  const reset = () => { navigation.reset(); setQuery(""); router.replace(pathname, { scroll: false }); };
  const statuses = (order: WorkspaceOrderPage["items"][number]) => {
    const payment = orderPaymentPresentation(order);
    return <><StatusTag tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusTag><StatusTag tone={payment.tone}>{payment.label}</StatusTag></>;
  };
  return <section className={styles.panel} aria-label="Список заказов">
    <div className={styles.toolbar}>
      <DmSearch aria-label="Поиск заказа" placeholder="Номер заказа или организация" value={query} onChange={setQuery} onSearch={value => change("q", value)} />
      <div className={styles.select}><DmDropdown aria-label="Статус заказа" value={status ?? ""} onChange={(_, data) => change("status", data.value)}><option value="">Все статусы</option>{workspaceOrderStatusSchema.options.map(value => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}</DmDropdown></div>
      <DmButton as="a" href={`/${role}/analytics`} appearance="secondary" icon={<ChartMultiple20Regular />}>Аналитика {role === "clinic" ? "закупок" : "продаж"}</DmButton>
    </div>
    <div className={styles.tabs} role="group" aria-label="Группы заказов">{groups.map(([value, label]) => <DmAction variant="tab" key={value} type="button" aria-pressed={(group ?? "") === value} onClick={() => change("group", value)}>{label}</DmAction>)}</div>
    <div className={styles.freshness}><ResourceStatus resource={resource} /><DmButton appearance="subtle" aria-label="Обновить заказы" title="Обновить заказы" disabled={resource.loading} icon={<ArrowClockwise20Regular />} onClick={refresh} /></div>
    {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={refresh}>Повторить</DmButton>} /> : resource.initialLoading ? <LoadingState label="Загружаем заказы" /> : !visible.length ? <EmptyState title={appliedQuery || status || group ? "Заказы не найдены" : "Заказов пока нет"} description={appliedQuery || status || group ? "Попробуйте другие фильтры." : role === "clinic" ? "Оформленные заказы появятся здесь." : "Здесь появятся заказы покупателей."} action={appliedQuery || status || group ? <DmButton onClick={reset}>Сбросить фильтры</DmButton> : undefined} /> : <>
      <table className={styles.table}><caption className={styles.srOnly}>Заказы: исполнение и оплата</caption><thead><tr><th>Заказ</th><th>{role === "clinic" ? "Поставщик" : "Клиника"}</th><th>Исполнение</th><th>Оплата</th><th className={styles.money}>Сумма</th></tr></thead><tbody>{visible.map(order => {
        const payment = orderPaymentPresentation(order);
        return <tr key={order.id}><td><Link href={`/${role}/orders/${order.id}`} className={styles.number} title={order.orderNumber}>{order.orderNumber}</Link><small>{formatDate(order.createdAt)} · {orderItemCount(order.itemCount)}</small></td><td>{(role === "clinic" ? order.supplier : order.buyer)?.displayName ?? "Организация"}</td><td><StatusTag tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusTag>{order.nextAction ? <small className={styles.next}>{order.nextAction}</small> : null}</td><td><StatusTag tone={payment.tone}>{payment.label}</StatusTag></td><td className={styles.money}>{formatMoney(order.subtotalAmountMinor, order.currency)}</td></tr>;
      })}</tbody></table>
      <div className={styles.cards}>{visible.map(order => <article key={order.id} className={styles.card}><div className={styles.cardTop}><Link href={`/${role}/orders/${order.id}`} className={styles.number} title={order.orderNumber}>{order.orderNumber}</Link><strong>{formatMoney(order.subtotalAmountMinor, order.currency)}</strong></div><p>{(role === "clinic" ? order.supplier : order.buyer)?.displayName ?? "Организация"}</p><div className={styles.badges}>{statuses(order)}</div>{order.nextAction ? <p className={styles.next}>{order.nextAction}</p> : null}<div className={styles.cardBottom}><small>{formatDate(order.createdAt)} · {orderItemCount(order.itemCount)}</small><Link href={`/${role}/orders/${order.id}`} aria-label={`Открыть заказ ${order.orderNumber}`}>Открыть →</Link></div></article>)}</div>
    </>}
    <div className={styles.pagination}><PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { navigation.reset(); void resource.refresh(); }} /></div>
  </section>;
}
