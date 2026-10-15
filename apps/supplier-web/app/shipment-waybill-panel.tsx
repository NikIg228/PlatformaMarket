"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { vatLabel, type PrepareShipmentWaybillInput, type ShipmentWaybillView, type ShipmentWaybillsResponse } from "@marketplace/schemas";
import { DmButton, DmDialog, DmFeedback, DmTable, LoadingState, errorMessage, formatMoney } from "@marketplace/ui";

export function ShipmentWaybillPanel({ api, orderId, shipmentId, shipmentVersion, busy: outerBusy }: {
  api: MarketplaceApiClient; orderId: string; shipmentId: string; shipmentVersion: number; busy: boolean;
}) {
  const [open, setOpen] = useState(false), [data, setData] = useState<ShipmentWaybillsResponse | null>(null);
  const [selected, setSelected] = useState<ShipmentWaybillView | null>(null), [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const request = useRef<PrepareShipmentWaybillInput | null>(null), sequence = useRef(0), working = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const reload = useCallback(async () => {
    const n = ++sequence.current; setLoading(true);
    try {
      const next = await api.getShipmentWaybills(orderId, shipmentId);
      if (n === sequence.current) { setData(next); setSelected(previous => next.waybills.find(row => row.documentId === previous?.documentId) ?? next.waybills[0] ?? null); setError(""); }
    } catch (cause) { if (n === sequence.current) { setData(null); setError(errorMessage(cause)); } }
    finally { if (n === sequence.current) setLoading(false); }
  }, [api, orderId, shipmentId]);
  useEffect(() => {
    if (open) void reload();
    return () => { ++sequence.current; };
  }, [open, reload, shipmentVersion]);
  const prepare = async () => {
    if (!data || working.current || !data.canPrepare) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    request.current ??= { expectedOrderVersion: data.orderVersion, expectedShipmentVersion: data.shipmentVersion, idempotencyKey: crypto.randomUUID() };
    try {
      const result = await api.prepareShipmentWaybill(orderId, shipmentId, request.current);
      request.current = null; await reload(); setSelected(result); setNotice("Предпросмотр подготовлен. Подписи сторон отсутствуют.");
    } catch (cause) {
      if ((cause as { status?: number }).status === 409) { request.current = null; await reload(); }
      setError(errorMessage(cause));
    } finally { working.current = false; setBusy(false); }
  };
  const download = async () => {
    if (!selected || working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      const { blob, fileName } = await api.downloadDocument(selected.documentId);
      const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName ?? "waybill-preview.pdf";
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { working.current = false; setBusy(false); }
  };
  return <>
    <DmButton ref={trigger} disabled={outerBusy} onClick={() => setOpen(true)}>Накладная партии</DmButton>
    <DmDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }} onClosed={() => trigger.current?.focus()} mobileFullscreen
      title="Накладная партии" description="Проверьте состав фактической партии и реквизиты. Подписание и приёмка пока недоступны."
      actions={<><DmButton disabled={busy} onClick={() => setOpen(false)}>Закрыть</DmButton><DmButton appearance="primary" disabled={busy || loading || outerBusy || !data?.canPrepare} onClick={() => void prepare()}>
        {busy ? "Формируем…" : request.current ? "Повторить формирование" : selected ? "Новая версия" : "Подготовить предпросмотр"}</DmButton></>}>
      {error ? <DmFeedback presentation="inline" tone="danger" title="Накладная не обновлена" description={error} alert action={!data ? <DmButton disabled={loading} onClick={() => void reload()}>Повторить загрузку</DmButton> : undefined} /> : null}
      {notice ? <DmFeedback presentation="inline" tone="success" title="Черновик готов" description={notice} /> : null}
      {loading ? <LoadingState label="Загружаем накладные партии…" /> : null}
      {data?.issues.map((issue, i) => <DmFeedback presentation="inline" key={`${i}:${issue}`} tone="warning" title="Проверьте данные партии" description={issue} />)}
      {selected ? <div className="dm-stack">
        {selected.status === "STALE" ? <DmFeedback presentation="inline" tone="warning" title="Предпросмотр устарел" description="Данные партии или реквизиты изменились. Сформируйте новую версию." /> : null}
        {selected.status === "FAILED" || selected.status === "GENERATING" ? <DmFeedback presentation="inline" tone="warning" title="Файл ещё не готов" description="Повторите формирование, чтобы получить PDF." /> : null}
        <p><strong>{selected.number} · R{selected.version}</strong> · Не подписано</p>
        <p>Заказ {selected.snapshot.orderNumber} · партия {selected.snapshot.shipmentNumber}</p>
        <div><strong>Поставщик</strong><p>{selected.snapshot.supplier.source.legalName} · {selected.snapshot.supplier.source.identifier}</p><p>{selected.snapshot.supplier.source.legalAddressText}</p></div>
        <div><strong>Получатель</strong><p>{selected.snapshot.buyer.source.legalName} · {selected.snapshot.buyer.source.identifier}</p><p>{selected.snapshot.recipient.name} · {selected.snapshot.recipient.address}</p></div>
        <p>Склад: {selected.snapshot.warehouse.name} · {selected.snapshot.warehouse.address}</p>
        <p>Перевозчик: {selected.snapshot.carrierName ?? "не указан"} · трек: {selected.snapshot.trackingNumber ?? "не указан"}</p>
        <DmTable caption="Состав партии" columns={[{ key: "item", label: "Позиция" }, { key: "quantity", label: "Количество" }, { key: "total", label: "Сумма" }]}>
          {selected.snapshot.lines.map(line => <tr key={line.shipmentItemId}><td data-label="Позиция">{line.name}<p>{line.gift ? "Подарок" : vatLabel(line.tax?.declaration.selection)}</p></td><td data-label="Количество">{line.quantity} {line.unit}<p>В заказе: {line.orderedQuantity}</p></td><td data-label="Сумма">{formatMoney(line.totalMinor, selected.snapshot.currency)}</td></tr>)}
        </DmTable>
        <p>Без НДС: {formatMoney(selected.snapshot.baseMinor, "KZT")} · НДС: {formatMoney(selected.snapshot.vatMinor, "KZT")}</p>
        <p><strong>Сумма партии: {formatMoney(selected.snapshot.totalMinor, "KZT")}</strong></p>
        <DmButton disabled={busy || !selected.checksum} onClick={() => void download()}>Скачать предпросмотр PDF</DmButton>
      </div> : !loading && data ? <p>Накладная этой партии ещё не подготовлена.</p> : null}
      {data && data.waybills.length > 1 ? <div className="dm-order-actions" aria-label="Версии накладной">{data.waybills.map(row => <DmButton key={row.documentId} disabled={busy} onClick={() => { setSelected(row); setNotice(""); }}>Открыть R{row.version}</DmButton>)}</div> : null}
      {data ? <div><strong>Документы доставки</strong>{data.deliveryDocuments.length ? data.deliveryDocuments.map(doc => <p key={doc.id}>{doc.title}</p>) : <p>Для этой партии документы доставки пока не добавлены.</p>}</div> : null}
    </DmDialog>
  </>;
}
