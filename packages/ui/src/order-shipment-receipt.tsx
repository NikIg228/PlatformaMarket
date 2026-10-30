"use client";
import { useState } from "react";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
import { DmButton } from "./actions";
import { DmField, DmInput } from "./controls";
import { Section } from "./primitives";
import { formatStatus } from "./format";
type Shipment = NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number];
type Items = { shipmentItemId: string; deliveredQuantity: string }[];
export function OrderShipmentReceipts({ shipments, busy, onReceive }: { shipments: Shipment[]; busy: boolean; onReceive: (shipmentId: string, items: Items) => Promise<void> }) {
  return <Section title="Поставки и получение">{shipments.length ? shipments.map(shipment => <article key={shipment.id} id={`shipment-${shipment.id}`} tabIndex={-1}>
    <h3>{shipment.shipmentNumber}</h3>
    {shipment.resupplyDiscrepancyId ? <p>Допоставка по расхождению. Новая оплата не требуется; документальное урегулирование ещё не завершено.</p> : null}
    <p>{formatStatus(shipment.status)} · {shipment.carrierName ?? "Перевозчик не указан"} · Трек: {shipment.trackingNumber ?? "ещё не присвоен"}</p>
    {shipment.items.some(item => Number(item.resupplyQuantity ?? 0) > 0) ? <><p>Исходная приёмка сохранена. Недостающее количество передано в связанную допоставку; подтвердите получение в ней.</p>
      {shipment.items.map((item, index) => <p key={item.id}>Позиция {index + 1}: отправлено {item.quantity}, принято {item.deliveredQuantity}, в допоставке {item.resupplyQuantity ?? "0"}.</p>)}</>
      : ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(shipment.status) ? <ReceiptForm shipment={shipment} busy={busy} onReceive={items => onReceive(shipment.id, items)} />
        : shipment.resupplyDiscrepancyId ? <p>Получено по допоставке: {shipment.items.map(item => item.deliveredQuantity).join(", ")}.</p> : null}
  </article>) : <p>Поставщик ещё не создал поставку.</p>}</Section>;
}
function ReceiptForm({ shipment, busy, onReceive }: { shipment: Shipment; busy: boolean; onReceive: (items: Items) => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  return <div><p>Укажите суммарное количество уже полученных упаковок по каждой позиции. Неполученные позиции оставьте без изменений.</p>{shipment.items.map((item, index) => <DmField key={item.id} label={`Позиция ${index + 1}: отправлено ${item.quantity}, ранее получено ${item.deliveredQuantity}`}><DmInput disabled={busy} inputMode="decimal" value={quantities[item.id] ?? item.deliveredQuantity} onChange={(_, d) => setQuantities(current => ({ ...current, [item.id]: d.value.replace(",", ".") }))} /></DmField>)}<DmButton disabled={busy} onClick={() => void onReceive(shipment.items.map(item => ({ shipmentItemId: item.id, deliveredQuantity: quantities[item.id] ?? item.deliveredQuantity })))}>Подтвердить фактическое получение</DmButton></div>;
}
