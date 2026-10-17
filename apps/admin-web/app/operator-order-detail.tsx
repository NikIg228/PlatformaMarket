"use client";
import { useCallback } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperatorOrderDetail as Detail } from "@marketplace/schemas";
import { adminSectionQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmSurface, DmTable, ErrorState, LoadingState, StatusTag } from "@marketplace/ui";
import { formatDate } from "@marketplace/ui/format";
import { orderStatusLabel } from "./operator-order-labels";
import { formatMoney } from "@marketplace/ui";
import { useOperatorProjection } from "./use-operator-projection";
import { OperatorOrderDocuments } from "./operator-order-documents";
import { orderHref, orderNavigate } from "./operator-order-navigation";
import styles from "./operator-orders.module.css";

const eventLabels: Record<string, string> = { ACCEPT_COMPOSITION: "Клиника согласовала состав", ISSUE_INVOICE: "Поставщик выставил счёт", REPORT_TRANSFER: "Клиника сообщила о переводе", REQUEST_PAYMENT_DETAILS: "Запрошено уточнение оплаты", CONFIRM_TRANSFER: "Поставщик подтвердил поступление", CANCEL: "Заказ отменён", RECORD_TRANSFER_CHECK: "Проверен перевод", OPEN_PAYMENT_DISPUTE: "Открыт спор по оплате", PROPOSE_PAYMENT_REDUCTION: "Предложено уменьшение заказа", DECIDE_PAYMENT_REDUCTION: "Рассмотрено уменьшение заказа", REQUEST_RETURN: "Запрошен возврат", DECIDE_RETURN: "Рассмотрен возврат", SEND_RETURN_GOODS: "Товар отправлен обратно", RECEIVE_RETURN_GOODS: "Возврат товара получен", SEND_MANUAL_REFUND: "Сообщено об отправке денег", RECEIVE_MANUAL_REFUND: "Подтверждено получение возврата денег", RECEIVE_SHIPMENT: "Клиника зафиксировала получение", REORDER: "Создан повторный заказ", SUBMIT: "Подано заявление о расхождении", RESPOND: "Поставщик ответил по расхождению", DECIDE: "Клиника рассмотрела ответ", DISPATCH_RESUPPLY: "Отправлена допоставка" };

export function OperatorOrderDetail({ id, state, write }: { id: string; state: AdminQuery; write: (state: AdminQuery) => void }) {
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorOrder(id, signal), [id]);
  const { data, loading, error, errorStatus, refresh } = useOperatorProjection(read, true);
  return <div className={styles.section} aria-busy={loading}>
    {loading && !data ? <LoadingState label="Загружаем карточку заказа" /> : null}
    {error ? <ErrorState presentation="inline" title={errorStatus === 404 ? "Заказ не найден" : "Карточка заказа недоступна"} description={errorStatus === 404 ? "Вернитесь к реестру и выберите заказ заново." : error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку карточки</DmButton>} /> : null}
    {data ? <OrderFacts data={data} state={state} write={write} /> : null}
  </div>;
}

function OrderFacts({ data, state, write }: { data: Detail; state: AdminQuery; write: (state: AdminQuery) => void }) {
  const { workflow: flow } = data, { order } = flow;
  const exceptionTarget = (id: string): AdminQuery => ({ ...adminSectionQuery(state, "orders"), queueType: "DOCUMENT_EXCEPTION", object: id });
  const itemName = (id: string) => order.items.find(item => item.id === id)?.offer?.productVariant.product.canonicalName ?? `Позиция ${order.items.findIndex(item => item.id === id) + 1}`;
  return <>
    <DmSurface variant="section" className={styles.section}><h3>Заказ {order.orderNumber}</h3><div className={styles.tags}><StatusTag>Исполнение: {orderStatusLabel(flow.status)}</StatusTag><StatusTag>Оплата: {orderStatusLabel(flow.paymentStatus)}</StatusTag></div>
      <dl className={styles.details}><div><dt>Клиника</dt><dd>{order.buyer?.displayName ?? order.buyerOrganizationId}</dd></div><div><dt>Поставщик</dt><dd>{order.supplier?.displayName ?? order.supplierOrganizationId}</dd></div>
        <div><dt>Сумма заказа</dt><dd>{formatMoney(order.subtotalAmountMinor, order.currency)}</dd></div><div><dt>Создан</dt><dd>{formatDate(order.createdAt, true)}</dd></div></dl>
    </DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Позиции</h3><DmTable caption="Позиции заказа" columns={[{ key: "name", label: "Товар" }, { key: "qty", label: "Заказано / согласовано" }, { key: "price", label: "Цена / сумма" }, { key: "state", label: "Состояние" }]}>
      {order.items.map(item => <tr key={item.id}><td data-label="Товар">{itemName(item.id)}{item.giftForItemId ? <p>Подарок</p> : null}</td><td data-label="Заказано / согласовано">{item.quantity} / {item.acceptedQuantity ?? "Не согласовано"}</td><td data-label="Цена / сумма">{formatMoney(item.unitPriceMinor, item.currency)}<br />{formatMoney(item.totalPriceMinor, item.currency)}</td><td data-label="Состояние">{orderStatusLabel(item.status)}{item.decisionReason ? <p>{item.decisionReason}</p> : null}</td></tr>)}
    </DmTable>{!order.items.length ? <p>Позиций нет.</p> : null}</DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Оплата и заявления о переводе</h3>
      {flow.paymentSummary ? <dl className={styles.details}><div><dt>Подтверждено поставщиком</dt><dd>{formatMoney(flow.paymentSummary.confirmedAmountMinor, order.currency)}</dd></div><div><dt>Осталось оплатить</dt><dd>{formatMoney(flow.paymentSummary.remainingAmountMinor, order.currency)}</dd></div><div><dt>Переплата</dt><dd>{formatMoney(flow.paymentSummary.overpaidAmountMinor, order.currency)}</dd></div></dl> : <p>Подробная сверка поступлений недоступна.</p>}
      {!flow.claims.length ? <p>Заявлений о переводе нет.</p> : flow.claims.map(claim => <div key={claim.id}><h4>{formatMoney(claim.amountMinor, claim.currency)} · {orderStatusLabel(claim.status)}</h4><p>Заявленная дата перевода: {formatDate(claim.paidAt, true)}</p><p>Подтверждённое поступление: {claim.receivedAmountMinor != null ? formatMoney(claim.receivedAmountMinor, claim.currency) : "Не подтверждено"}</p>{claim.comment ? <p>{claim.comment}</p> : null}</div>)}
      {flow.reductions?.map(reduction => <div key={reduction.id}><h4>Уменьшение заказа · {orderStatusLabel(reduction.status)}</h4><p>{formatMoney(reduction.previousAmountMinor, order.currency)} → {formatMoney(reduction.proposedAmountMinor, order.currency)}</p><p>{reduction.reason}</p></div>)}
    </DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Партии и получение</h3>
      {!order.shipments?.length ? <p>Отгрузки ещё не созданы.</p> : order.shipments.map(shipment => <section key={shipment.id} className={styles.section} aria-label={`Партия ${shipment.shipmentNumber}`}><h4>{shipment.shipmentNumber} · {orderStatusLabel(shipment.status)}{shipment.resupplySourceShipmentId ? " · Допоставка" : ""}</h4>
        <p>Склад: {shipment.warehouse?.name ?? "Не указан"}. Перевозчик: {shipment.carrierName ?? "Не указан"}. Трек: {shipment.trackingNumber ?? "Не указан"}.</p>
        <p>Отправлено: {formatDate(shipment.dispatchedAt, true)}. Получено полностью: {formatDate(shipment.deliveredAt, true)}.</p>
        <DmTable caption={`Количества партии ${shipment.shipmentNumber}`} columns={[{ key: "name", label: "Товар" }, { key: "sent", label: "В партии" }, { key: "received", label: "Получено" }]}>{shipment.items.map(item => <tr key={item.id}><td data-label="Товар">{itemName(item.supplierOrderItemId)}</td><td data-label="В партии">{item.quantity}</td><td data-label="Получено">{item.deliveredQuantity}</td></tr>)}</DmTable>
        {shipment.fulfillmentSteps.map(step => <p key={step.id}>{orderStatusLabel(step.type)}: {orderStatusLabel(step.status)}{step.completedAt ? ` · ${formatDate(step.completedAt, true)}` : ""}</p>)}
      </section>)}
    </DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Документы и комплектность</h3><p>Готовность полного документального комплекта не подтверждена. Получение товара и записи о подписях отображаются отдельно.</p>
      {data.canViewDocuments ? <OperatorOrderDocuments orderId={order.id} /> : <p>Для просмотра документов требуется право доступа к документам.</p>}
    </DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Расхождения и допоставка</h3>{!data.discrepancies.length ? <p>Поданных заявлений о расхождениях нет.</p> : data.discrepancies.map(claim => <section key={claim.id} className={styles.section} aria-label={`Расхождение ${claim.id}`}>
      <h4>{order.shipments?.find(shipment => shipment.id === claim.shipmentId)?.shipmentNumber ?? "Партия"} · {orderStatusLabel(claim.status)}</h4><p>{claim.reason}</p><p>Способ урегулирования: {orderStatusLabel(claim.resolution ?? "NOT_SELECTED")}. Редакция заявления: {claim.version}.</p>
      {claim.sourceDocumentVersion ? <p>Исходный документ: редакция {claim.sourceDocumentVersion}.</p> : null}
      <div><DmButton as="a" href={orderHref(exceptionTarget(claim.id))} onClick={event => orderNavigate(event, exceptionTarget(claim.id), write)}>Открыть расхождение · редакция {claim.version}</DmButton></div>
      {claim.resupply ? <><p>Документальное урегулирование: {claim.resupply.documentStatus === "INCOMPLETE" ? "Не завершено" : "Не подтверждено"}.</p><p>Допоставка: {claim.resupply.shipment?.number ?? "Ещё не отправлена"}.</p>{claim.resupply.lines.map(line => <p key={line.shipmentItemId}>{line.name}: исходно получено {line.originalReceivedQuantity}; к довозу {line.quantity}; получено по допоставке {line.deliveredQuantity} {line.uom}.</p>)}</> : null}
    </section>)}</DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Возвраты</h3>{!flow.returns?.length ? <p>Возвратов нет.</p> : flow.returns.map(item => <section key={item.id} className={styles.section}><h4>{orderStatusLabel(item.status)} · {formatMoney(item.amountMinor, item.currency)}</h4><p>{item.reason}</p>{item.decisionReason ? <p>Решение: {item.decisionReason}</p> : null}{item.items.map(line => <p key={line.orderItemId}>{itemName(line.orderItemId)}: {line.quantity} · {line.condition}</p>)}<p>Товар возвращён: {formatDate(item.goodsReceivedAt, true)}. Возврат денег получен: {formatDate(item.refundReceivedAt, true)}.</p></section>)}</DmSurface>
    <DmSurface variant="section" className={styles.section}><h3>Связанные обращения</h3>{!data.canViewSupport ? <p>Для просмотра обращений требуется право доступа к поддержке.</p> : !data.tickets.length ? <p>Связанных обращений нет.</p> : data.tickets.map(ticket => {
      const target = { ...adminSectionQuery(state, "support"), ticketId: ticket.id };
      return <div key={ticket.id} className={styles.header}><div><h4>{ticket.number} · {ticket.subject}</h4><p>{orderStatusLabel(ticket.status)}</p></div><DmButton as="a" href={orderHref(target)} onClick={event => orderNavigate(event, target, write)}>Открыть обращение {ticket.number}</DmButton></div>;
    })}</DmSurface>
    <OrderTimeline data={data} />
  </>;
}

function OrderTimeline({ data }: { data: Detail }) {
  const { workflow } = data;
  const events = [
    { id: "created", at: workflow.order.createdAt, title: "Заказ создан", context: workflow.order.orderNumber },
    ...workflow.events.map(event => ({ id: event.id, at: event.createdAt, title: eventLabels[event.action] ?? orderStatusLabel(event.action), context: "Заказ" })),
    ...data.discrepancies.flatMap(claim => claim.events.map(event => ({ id: event.id, at: event.createdAt, title: event.action === "OPERATOR_REVIEW" ? "Оператор опубликовал рекомендацию сторонам" : eventLabels[event.action] ?? orderStatusLabel(event.action), context: `Расхождение · редакция ${event.version}` }))),
    ...(workflow.order.shipments ?? []).flatMap(shipment => [
      { id: `${shipment.id}:created`, at: shipment.createdAt, title: "Партия создана", context: shipment.shipmentNumber },
      ...(shipment.dispatchedAt ? [{ id: `${shipment.id}:sent`, at: shipment.dispatchedAt, title: "Партия отправлена", context: shipment.shipmentNumber }] : []),
      ...(shipment.deliveredAt ? [{ id: `${shipment.id}:received`, at: shipment.deliveredAt, title: "Партия получена полностью", context: shipment.shipmentNumber }] : []),
    ]),
    ...data.tickets.map(ticket => ({ id: `ticket:${ticket.id}`, at: ticket.createdAt, title: `Создано обращение ${ticket.number}`, context: ticket.subject })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return <DmSurface variant="section" className={styles.section}><h3>Хронология заказа</h3><ol className={styles.timeline}>{events.map(event => <li key={event.id}><strong>{event.title}</strong><p>{event.context} · {formatDate(event.at, true)}</p></li>)}</ol></DmSurface>;
}
