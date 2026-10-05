"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  DmButton,
  DmField,
  DmSearch,
  DmSelect,
  EmptyState,
  ErrorState,
  LoadingState,
  formatDate,
  formatMoney,
  formatStatus,
} from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PageNavigation, usePageNavigation } from "./page-navigation";
import { workspaceOrderStatusSchema } from "@marketplace/schemas";
import styles from "./workspace.module.css";

export default function Orders() {
  const { api, role, organizationId } = useWorkspace();
  const navigation = usePageNavigation();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState<"" | typeof workspaceOrderStatusSchema._output>("");
  const load = useCallback(
    (signal: AbortSignal) => api.workspaceOrders(role === "clinic" ? "buyer" : "supplier", { q: appliedQuery, status: status || undefined, cursor: navigation.cursor }, { signal }),
    [api, role, organizationId, appliedQuery, status, navigation.cursor],
  );
  const resource = useResource(load, { intervalMs: 30_000 });
  const visible = resource.data?.items ?? [];
  const refresh = () => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); };
  return (
    <>
      <header className={styles.heading}>
        <div>
          <Link href={`/${role}/analytics`}>Аналитика {role === "clinic" ? "закупок" : "продаж"}</Link>
        </div>
        <DmButton
          disabled={resource.loading}
          onClick={refresh}
        >
          Обновить
        </DmButton>
      </header>
      <section className={styles.panel}>
        <form className={styles.toolbar} onSubmit={event => { event.preventDefault(); navigation.reset(); setAppliedQuery(query.trim()); }}>
          <DmSearch aria-label="Поиск заказа" placeholder="Найти заказ" value={query} onChange={setQuery} onSearch={value => { navigation.reset(); setAppliedQuery(value); }} />
          <DmField label="Статус">
            <DmSelect
              value={status}
              onChange={(_, value) => { navigation.reset(); setStatus(value.value as typeof status); }}
            >
              <option value="">Все статусы</option>
              {workspaceOrderStatusSchema.options.map(
                (value) => (
                  <option key={value} value={value}>
                    {formatStatus(value)}
                  </option>
                ),
              )}
            </DmSelect>
          </DmField>

        </form>
        <ResourceStatus resource={resource} />
        {resource.error && !resource.data ? (
          <ErrorState
            description={resource.error}
            action={
              <DmButton onClick={() => void resource.refresh()}>
                Повторить
              </DmButton>
            }
          />
        ) : resource.initialLoading ? (
          <LoadingState label="Загружаем заказы" />
        ) : !visible.length ? (
          <EmptyState
            title={appliedQuery || status || navigation.cursor ? "Заказы не найдены" : "Заказов пока нет"}
            description={
              appliedQuery || status || navigation.cursor
                ? "Измените поиск или статус."
                : role === "clinic"
                  ? "Добавьте товары из каталога и оформите заказ в корзине."
                  : "Здесь появятся заказы покупателей."
            }
          />
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th>{role === "clinic" ? "Поставщик" : "Клиника"}</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/${role}/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                      <small>{order.itemCount} позиций</small>
                    </td>
                    <td>
                      {(role === "clinic" ? order.supplier : order.buyer)
                        ?.displayName ?? "Организация"}
                    </td>
                    <td>
                      {formatStatus(order.status)}
                      <small>{formatStatus(order.paymentStatus)}</small>
                    </td>
                    <td>
                      {formatMoney(order.subtotalAmountMinor, order.currency)}
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={refresh} />
      </section>
    </>
  );
}
