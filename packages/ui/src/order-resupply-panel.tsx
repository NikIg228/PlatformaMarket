"use client";
import { useState } from "react";
import type { OrderDiscrepancyCommand, OrderDiscrepancyView, OrderWorkflowResponse } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmFormSections, DmInput, DmTable, formatDate, formatStatus } from "./index";
import { DmCheckbox } from "./controls";

export function discrepancyExecutionLabel(claim: OrderDiscrepancyView, fallback: string) {
  if (!claim.resupply?.shipment) return fallback;
  return claim.resupply.shipment.status === "DELIVERED"
    ? "Допоставка получена — документы не закрыты" : "Допоставка отправлена — ожидается получение";
}

type DispatchDetails = Pick<Extract<OrderDiscrepancyCommand, { action: "DISPATCH_RESUPPLY" }>, "carrierName" | "trackingNumber" | "acknowledged">;
const deliveryLabels: Record<string, string> = { CARRIER: "через перевозчика", PICKUP: "самовывоз", SUPPLIER_CITY: "доставка поставщика по городу", SELECTED_CITIES: "доставка в выбранные города", NATIONWIDE: "доставка по стране", MARKETPLACE_LOGISTICS: "логистика площадки", PRICE_ON_REQUEST: "по согласованным условиям", SPECIAL: "специальная доставка" };
export function OrderResupplyPanel({ claim, supplier, disabled, events, onDispatch, onShipment }: {
  claim: OrderDiscrepancyView; supplier: boolean; disabled: boolean; events: OrderWorkflowResponse["events"];
  onDispatch: (details: DispatchDetails) => Promise<void>; onShipment: (id: string) => void;
}) {
  const [carrier, setCarrier] = useState(""), [tracking, setTracking] = useState("");
  const [acknowledged, setAcknowledged] = useState(false), [attempted, setAttempted] = useState(false);
  const plan = claim.resupply;
  if (!plan) return null;
  const trackingMissing = plan.method === "CARRIER" && !tracking.trim();
  const receiptEvents = events.filter(event => event.action === "RECEIVE_SHIPMENT" && event.details.shipmentId === plan.shipment?.id);
  return <section aria-label="Исполнение допоставки"><DmFormSections>
    <h3>Допоставка по согласованной недостаче</h3>
    <p>Исходная партия: {claim.source.shipmentNumber}. Количество заказа и сумма оплаты сохраняются.</p>
    <DmTable caption="Недостающий товар" columns={[{ key: "name", label: "Позиция" }, { key: "original", label: "Принято в исходной партии" }, { key: "extra", label: "Допоставка" }, { key: "received", label: "Принято по допоставке" }]}>
      {plan.lines.map(line => <tr key={line.shipmentItemId}><td data-label="Позиция">{line.name} · {line.uom}</td><td data-label="Принято в исходной партии">{line.originalReceivedQuantity}</td><td data-label="Допоставка">{line.quantity}</td><td data-label="Принято по допоставке">{line.deliveredQuantity}</td></tr>)}
    </DmTable>
    <DmFeedback presentation="inline" tone="warning" title="Документы не закрыты" description="Получение допоставки завершает поставку товара. Исходная накладная и заявление сохраняются; документальное урегулирование и необходимые подписи ещё не завершены." />
    {plan.shipment ? <>
      <p>Допоставка {plan.shipment.number} · {formatStatus(plan.shipment.status)}</p>
      <p>{plan.shipment.carrierName ?? "Перевозчик не указан"} · Трек: {plan.shipment.trackingNumber ?? "не указан"}</p>
      {plan.shipment.dispatchedAt ? <p>Отправлена {formatDate(plan.shipment.dispatchedAt, true)}.</p> : null}
      <DmButton onClick={() => onShipment(plan.shipment!.id)}>Перейти к допоставке</DmButton>
      {receiptEvents.length ? <div><h3>Приёмка допоставки</h3><ol>{receiptEvents.map(event => <li key={event.id}>{formatDate(event.createdAt, true)} — клиника подтвердила фактическое получение.</li>)}</ol></div> : <p>Подтверждения приёмки допоставки пока нет.</p>}
    </> : <>
      <p>Склад: {plan.warehouseName}. Получатель: {plan.recipientName}. Способ доставки: {deliveryLabels[plan.method] ?? "как в исходной партии"}. Адрес и контакты — как в исходной партии.</p>
      {plan.issues.length ? <DmFeedback presentation="inline" tone="warning" title="Допоставка пока недоступна" description={plan.issues.join(" ")} /> : null}
      {supplier && plan.canDispatch ? <form noValidate onSubmit={event => { event.preventDefault(); setAttempted(true); if (!disabled && acknowledged && !trackingMissing) void onDispatch({ acknowledged: true, carrierName: carrier.trim() || null, trackingNumber: tracking.trim() || null }); }}><DmFormSections>
        <p>Подтвердите фактическую отправку указанных недостающих единиц. Они будут дополнительно списаны со склада; новый счёт и новая продажа не создаются.</p>
        <DmField label="Перевозчик допоставки"><DmInput disabled={disabled} maxLength={200} value={carrier} onChange={(_, data) => setCarrier(data.value)} /></DmField>
        <DmField label="Трек-номер допоставки" required={plan.method === "CARRIER"} validationState={attempted && trackingMissing ? "error" : "none"} validationMessage={attempted && trackingMissing ? "Укажите новый трек-номер" : undefined}><DmInput disabled={disabled} maxLength={160} value={tracking} onChange={(_, data) => setTracking(data.value)} /></DmField>
        <DmField validationState={attempted && !acknowledged ? "error" : "none"} validationMessage={attempted && !acknowledged ? "Подтвердите отправку и дополнительное списание" : undefined}><DmCheckbox disabled={disabled} checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} label="Недостающий товар отправлен. Подтверждаю дополнительное списание указанного количества." /></DmField>
        <DmButton appearance="primary" type="submit" disabled={disabled}>Подтвердить отправку допоставки</DmButton>
      </DmFormSections></form> : !supplier ? <p>После отправки поставщиком здесь появится связанная допоставка. Подтвердите её фактическое получение в разделе поставок.</p> : null}
    </>}
  </DmFormSections></section>;
}
