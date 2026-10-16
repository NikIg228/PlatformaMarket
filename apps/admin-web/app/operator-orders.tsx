"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type MarketplaceApiClient } from "@marketplace/api-client";
import { operatorOrderStatusSchema, operatorOrderPaymentStatusSchema } from "@marketplace/schemas";
import { adminSectionQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmSurface, DmField, DmInput, DmDropdown, EmptyState, ErrorState, LoadingState, StatusTag } from "@marketplace/ui";
import { formatDate } from "@marketplace/ui/format";
import { orderStatusLabel } from "./operator-order-labels";
import { formatMoney } from "@marketplace/ui";
import { useAdminQuery } from "./use-admin-query";
import { useOperatorProjection } from "./use-operator-projection";
import { OperatorOrderDetail } from "./operator-order-detail";
import { orderHref, orderNavigate } from "./operator-order-navigation";
import styles from "./operator-orders.module.css";

const filters = (state: AdminQuery) => ({ orderQ: state.orderQ, orderBuyer: state.orderBuyer, orderSupplier: state.orderSupplier, orderFrom: state.orderFrom, orderTo: state.orderTo });

export function OperatorOrders() {
  const { state, write } = useAdminQuery();
  const [input, setInput] = useState(filters(state));
  const heading = useRef<HTMLHeadingElement>(null), previous = useRef(state.orderId);
  useEffect(() => { setInput(filters(state)); }, [state.orderQ, state.orderBuyer, state.orderSupplier, state.orderFrom, state.orderTo]);
  useEffect(() => { if (previous.current !== state.orderId) { heading.current?.focus(); previous.current = state.orderId; } }, [state.orderId]);
  const invalid = Object.values(input).some(value => /[\u0000-\u001f\u007f]/.test(value));
  const invalidDate = Boolean(input.orderFrom && input.orderTo && input.orderFrom > input.orderTo);
  const list = adminSectionQuery(state, "orders");
  const filtered = state.orderQ || state.orderBuyer || state.orderSupplier || state.orderFrom || state.orderTo || state.orderStatus || state.orderPaymentStatus;
  return <section className={styles.section} aria-labelledby="order-registry-title">
    <div className={styles.header}><h2 id="order-registry-title" ref={heading} tabIndex={-1}>{state.orderId ? "Карточка заказа" : "Реестр заказов"}</h2>
      {state.orderId ? <DmButton as="a" href={orderHref(list)} onClick={event => orderNavigate(event, list, write)}>К списку заказов</DmButton> : null}</div>
    {state.orderId ? <OperatorOrderDetail key={state.orderId} id={state.orderId} state={state} write={write} /> : <>
      <DmSurface variant="filters"><form className={styles.filters} onSubmit={event => { event.preventDefault(); if (!invalid && !invalidDate) write({ ...state, ...input, orderOffset: 0 }); }}>
        <DmField label="Номер заказа или участник" validationState={invalid ? "error" : "none"} validationMessage={invalid ? "Удалите управляющие символы из поиска." : undefined}><DmInput value={input.orderQ} maxLength={200} onChange={(_, data) => setInput(value => ({ ...value, orderQ: data.value }))} /></DmField>
        <DmField label="Клиника: название или БИН"><DmInput value={input.orderBuyer} maxLength={200} onChange={(_, data) => setInput(value => ({ ...value, orderBuyer: data.value }))} /></DmField>
        <DmField label="Поставщик: название или БИН"><DmInput value={input.orderSupplier} maxLength={200} onChange={(_, data) => setInput(value => ({ ...value, orderSupplier: data.value }))} /></DmField>
        <DmField label="Исполнение"><DmDropdown value={state.orderStatus} onChange={(_, data) => write({ ...state, orderStatus: data.value as AdminQuery["orderStatus"], orderOffset: 0 })}><option value="">Все состояния</option>{operatorOrderStatusSchema.options.map(value => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}</DmDropdown></DmField>
        <DmField label="Оплата"><DmDropdown value={state.orderPaymentStatus} onChange={(_, data) => write({ ...state, orderPaymentStatus: data.value as AdminQuery["orderPaymentStatus"], orderOffset: 0 })}><option value="">Все состояния оплаты</option>{operatorOrderPaymentStatusSchema.options.map(value => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}</DmDropdown></DmField>
        <div className={styles.dates}><DmField label="Создан с"><DmInput type="date" value={input.orderFrom} onChange={(_, data) => setInput(value => ({ ...value, orderFrom: data.value }))} /></DmField>
          <DmField label="Создан по (включительно)" validationState={invalidDate ? "error" : "none"} validationMessage={invalidDate ? "Конец периода должен быть не раньше начала." : undefined}><DmInput type="date" value={input.orderTo} onChange={(_, data) => setInput(value => ({ ...value, orderTo: data.value }))} /></DmField></div>
        <div className={styles.actions}><DmButton type="submit" disabled={invalid || invalidDate}>Найти</DmButton>{filtered ? <DmButton onClick={() => { const cleared = { ...state, orderQ: "", orderBuyer: "", orderSupplier: "", orderFrom: "", orderTo: "", orderStatus: "", orderPaymentStatus: "", orderOffset: 0 } as AdminQuery; setInput(filters(cleared)); write(cleared); }}>Сбросить фильтры</DmButton> : null}</div>
      </form></DmSurface>
      <OrderResults key={[state.orderQ, state.orderBuyer, state.orderSupplier, state.orderStatus, state.orderPaymentStatus, state.orderFrom, state.orderTo, state.orderOffset].join("|")} state={state} write={write} />
    </>}
  </section>;
}

function OrderResults({ state, write }: { state: AdminQuery; write: (state: AdminQuery) => void }) {
  const { orderQ, orderBuyer, orderSupplier, orderStatus, orderPaymentStatus, orderFrom, orderTo, orderOffset } = state;
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorOrders({ q: orderQ || undefined, buyer: orderBuyer || undefined, supplier: orderSupplier || undefined,
    status: orderStatus || undefined, paymentStatus: orderPaymentStatus || undefined, dateFrom: orderFrom || undefined, dateTo: orderTo || undefined, offset: orderOffset, limit: 25 }, signal), [orderQ, orderBuyer, orderSupplier, orderStatus, orderPaymentStatus, orderFrom, orderTo, orderOffset]);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  return <div className={styles.section} aria-busy={loading}>
    {loading && !data ? <LoadingState label="Загружаем заказы" /> : null}
    {error ? <ErrorState presentation="inline" title="Реестр заказов недоступен" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку</DmButton>} /> : null}
    {data ? <p role="status">Найдено заказов: {data.total}</p> : null}
    {data?.items.length === 0 ? <EmptyState title="Заказы не найдены" description={orderOffset ? "Вернитесь к началу списка или измените фильтры." : "Измените поиск или фильтры."} /> : null}
    {data?.items.map(order => { const target = { ...adminSectionQuery(state, "orders"), orderId: order.id }; return <DmSurface key={order.id} variant="card" className={styles.row}>
      <div><h3>{order.orderNumber}</h3><p>Клиника: {order.buyer.displayName}</p><p>Поставщик: {order.supplier.displayName}</p><p>{formatDate(order.createdAt)}</p></div>
      <div className={styles.section}><strong>{formatMoney(order.subtotalAmountMinor, order.currency)}</strong><div className={styles.tags}><StatusTag>Исполнение: {orderStatusLabel(order.status)}</StatusTag><StatusTag>Оплата: {orderStatusLabel(order.paymentStatus)}</StatusTag></div></div>
      <DmButton as="a" href={orderHref(target)} onClick={event => orderNavigate(event, target, write)} aria-label={`Открыть заказ ${order.orderNumber}`}>Открыть</DmButton>
    </DmSurface>; })}
    {data ? <nav className={styles.actions} aria-label="Страницы заказов"><DmButton disabled={loading || orderOffset === 0} onClick={() => write({ ...state, orderOffset: Math.max(0, orderOffset - 25) })}>Назад</DmButton>
      <span>Страница {Math.floor(orderOffset / 25) + 1}</span><DmButton disabled={loading || orderOffset + 25 >= data.total || orderOffset >= 1000000} onClick={() => write({ ...state, orderOffset: orderOffset + 25 })}>Далее</DmButton>
      {orderOffset ? <DmButton onClick={() => write({ ...state, orderOffset: 0 })}>В начало списка</DmButton> : null}</nav> : null}
  </div>;
}
