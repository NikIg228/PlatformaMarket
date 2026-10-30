"use client";
import { useId, useState } from "react";
import { discrepancyStatementSchema, type DiscrepancyStatement, type OrderDiscrepanciesResponse, type OrderDiscrepancyView } from "@marketplace/schemas";
import { DmButton, DmFileInput } from "./actions";
import { DmDropdown } from "./dm-dropdown";
import { DmField, DmInput, DmTextarea } from "./controls";
import { DmFormSections } from "./heading";
export const discrepancyKinds: Record<DiscrepancyStatement["kind"], string> = { SHORTAGE: "Недостача", DAMAGED: "Повреждение", NOT_RECEIVED: "Ничего не получено", EXCESS: "Излишек", WRONG_GOODS: "Другой товар", RECEIPT_ERROR: "Ошибка записи получения" };
export const discrepancyResolutions: Record<DiscrepancyStatement["requestedResolution"], string> = { RESUPPLY: "Допоставка", REDUCTION: "Уменьшение обязательства", RETURN: "Возврат", CORRECTION: "Исправление", OTHER: "Другой вариант" };
type Shipment = OrderDiscrepanciesResponse["shipments"][number];
export function DiscrepancyForm({ shipment, initial, disabled, onSave, onUpload, receiptEvents }: {
  shipment: Shipment; initial?: OrderDiscrepancyView; disabled: boolean;
  onSave: (statement: DiscrepancyStatement, documentId: string | null, receiptId: string | null) => Promise<void>;
  onUpload: (file: File) => Promise<{ id: string; name: string } | null>;
  receiptEvents: { id: string; label: string }[];
}) {
  const [value, setValue] = useState<DiscrepancyStatement>(() => initial?.statement ?? { kind: "SHORTAGE", reason: "", requestedResolution: "RESUPPLY", attachmentIds: [], lines: shipment.lines.map(line => ({ shipmentItemId: line.shipmentItemId, actualQuantity: line.recordedReceivedQuantity, damagedQuantity: "0" })) });
  const [documentId, setDocumentId] = useState(initial?.source.documentId ?? ""), [receiptId, setReceiptId] = useState(initial?.source.sourceReceiptEventId ?? "");
  const [attachments, setAttachments] = useState(() => initial?.attachments.map(a => ({ id: a.id, name: a.name })) ?? []);
  const [uploading, setUploading] = useState(false), [attempted, setAttempted] = useState(false); const fileId = useId();
  const parsed = discrepancyStatementSchema.safeParse(value), invalid = attempted && !parsed.success;
  const source = initial?.source.lines ?? shipment.lines;
  const setLine = (index: number, key: "actualQuantity" | "damagedQuantity", next: string) => setValue(previous => ({ ...previous, lines: previous.lines.map((line, i) => i === index ? { ...line, [key]: next.replace(",", ".") } : line) }));
  return <form onSubmit={event => { event.preventDefault(); setAttempted(true); if (parsed.success) void onSave(parsed.data, documentId || null, receiptId || null); }}>
    <DmFormSections>
      <div><p>Отправление {shipment.number}. Укажите суммарный фактический результат по каждой позиции. Заявление не заменяет подтверждение получения.</p>
        {!initial ? <DmField label="Исходная накладная"><DmDropdown disabled={disabled} value={documentId} onChange={(_, d) => setDocumentId(d.value)}><option value="">Нет доступной выпущенной накладной</option>{shipment.documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title} · версия {doc.version}</option>)}</DmDropdown></DmField> : <p>{initial.source.documentId ? `Накладная: версия ${initial.source.documentVersion}` : "Без выпущенной накладной"}</p>}
        <DmField label="Тип расхождения"><DmDropdown disabled={disabled} value={value.kind} onChange={(_, d) => setValue(v => ({ ...v, kind: d.value as DiscrepancyStatement["kind"] }))}>{Object.entries(discrepancyKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmDropdown></DmField>
        {value.kind === "RECEIPT_ERROR" && !initial ? <DmField label="Ошибочное событие получения"><DmDropdown disabled={disabled} value={receiptId} onChange={(_, d) => setReceiptId(d.value)}><option value="">Выберите событие</option>{receiptEvents.map(event => <option key={event.id} value={event.id}>{event.label}</option>)}</DmDropdown></DmField> : null}
      </div>
      {value.lines.map((line, i) => <div key={line.shipmentItemId}><h3>{source.find(s => s.shipmentItemId === line.shipmentItemId)?.name ?? `Позиция ${i + 1}`}</h3><p>Отправлено: {source[i]?.sentQuantity} {source[i]?.uom}. Ранее зарегистрировано получение: {source[i]?.recordedReceivedQuantity}.</p>
        <DmField label={`Фактически получено — позиция ${i + 1}`} validationState={invalid && !/^\d+(\.\d{1,6})?$/.test(line.actualQuantity) ? "error" : "none"} validationMessage={invalid && !/^\d+(\.\d{1,6})?$/.test(line.actualQuantity) ? "Укажите неотрицательное количество, до 6 знаков после запятой" : undefined}><DmInput disabled={disabled} inputMode="decimal" value={line.actualQuantity} onChange={(_, d) => setLine(i, "actualQuantity", d.value)} /></DmField>
        <DmField label={`Из них повреждено — позиция ${i + 1}`}><DmInput disabled={disabled} inputMode="decimal" value={line.damagedQuantity} onChange={(_, d) => setLine(i, "damagedQuantity", d.value)} /></DmField></div>)}
      <div><DmField label="Причина и описание" required validationState={attempted && value.reason.trim().length < 3 ? "error" : "none"} validationMessage={attempted && value.reason.trim().length < 3 ? "Опишите расхождение, не менее 3 символов" : undefined}><DmTextarea disabled={disabled} value={value.reason} maxLength={3000} onChange={(_, d) => setValue(v => ({ ...v, reason: d.value }))} /></DmField>
        <DmField label="Предлагаемое решение"><DmDropdown disabled={disabled} value={value.requestedResolution} onChange={(_, d) => setValue(v => ({ ...v, requestedResolution: d.value as DiscrepancyStatement["requestedResolution"] }))}>{Object.entries(discrepancyResolutions).filter(([key]) => !["SHORTAGE", "NOT_RECEIVED"].includes(value.kind) || ["RESUPPLY", "REDUCTION"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmDropdown></DmField>
      </div>
      <div><DmField label={{ children: "Доказательства (необязательно)", htmlFor: fileId }}><DmFileInput id={fileId} disabled={disabled || uploading || attachments.length >= 10} accept=".pdf,.png,.jpg,.jpeg" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const asset = await onUpload(file); if (asset) { setAttachments(v => [...v, asset]); setValue(v => ({ ...v, attachmentIds: [...v.attachmentIds, asset.id] })); } } finally { setUploading(false); } }} /></DmField><p>PDF, PNG или JPEG, до 5 МБ; не более 10 файлов.</p>
        {attachments.map(asset => <p key={asset.id}>{asset.name} <DmButton disabled={disabled} onClick={() => { setAttachments(a => a.filter(item => item.id !== asset.id)); setValue(v => ({ ...v, attachmentIds: v.attachmentIds.filter(id => id !== asset.id) })); }}>Убрать {asset.name}</DmButton></p>)}</div>
      <DmButton appearance="primary" type="submit" disabled={disabled || uploading}>{uploading ? "Проверяем файл…" : "Сохранить черновик"}</DmButton>
    </DmFormSections>
  </form>;
}
