"use client";
import { useEffect, useRef, useState } from "react";
import type { DiscrepancyStatement, OrderDiscrepancyCommand, OrderDiscrepancyResult, OrderDiscrepancyView, OrderWorkflowResponse } from "@marketplace/schemas";
import { DmButton } from "./actions";
import { DmDialog, DmFeedback, DmTable, LoadingState, Section } from "./primitives";
import { DmDropdown } from "./dm-dropdown";
import { DmField, DmTextarea } from "./controls";
import { DmFormSections } from "./heading";
import { errorMessage, formatDate } from "./format";
import { DiscrepancyForm, discrepancyKinds, discrepancyResolutions } from "./order-discrepancy-form";
import { useOrderDiscrepancies, type OrderDiscrepancyApi } from "./order-discrepancy-resource";
import { OrderResupplyPanel, discrepancyExecutionLabel } from "./order-resupply-panel";
import { ResupplyDocumentPanel, type ResupplyDocumentApi } from "./resupply-document-panel";
const statusLabels: Record<OrderDiscrepancyView["status"], string> = { DRAFT: "Черновик клиники", SUBMITTED: "Ожидает ответа поставщика", RESOLUTION_PROPOSED: "Ожидает решения клиники", REJECTED: "Отклонено — расхождение не урегулировано", AGREED: "Решение согласовано — требуется исполнение" };
const eventLabels: Record<string, string> = { CREATE: "Создан черновик", SAVE: "Сохранён черновик", SUBMIT: "Клиника отправила заявление", RESPOND: "Поставщик ответил", DECIDE: "Клиника рассмотрела предложение", DISPATCH_RESUPPLY: "Поставщик отправил допоставку", OPERATOR_REVIEW: "Рекомендация оператора для клиники и поставщика" };
export function OrderDiscrepancyPanel({ api, orderId, orderVersion, events, onChanged }: { api: OrderDiscrepancyApi; orderId: string; orderVersion: number; events: OrderWorkflowResponse["events"]; onChanged?: () => Promise<void> }) {
  const resource = useOrderDiscrepancies(api, orderId, orderVersion), { data } = resource;
  const [selectedId, setSelectedId] = useState<string | null>(null), [newShipment, setNewShipment] = useState<string | null>(null);
  const [previousId, setPreviousId] = useState<string | null>(null), [editing, setEditing] = useState(false);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { if ((selectedId || newShipment) && !resource.busy) { content.current?.focus({ preventScroll: true }); content.current?.parentElement?.scrollTo({ top: 0 }); } }, [selectedId, newShipment, resource.busy, resource.error, data?.discrepancies.find(row => row.id === selectedId)?.version]);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const shipmentFocus = useRef<string | null>(null);
  const selected = data?.discrepancies.find(row => row.id === selectedId), shipment = data?.shipments.find(row => row.id === (newShipment ?? selected?.shipmentId));
  const open = Boolean(selectedId || newShipment), disabled = resource.busy || resource.uncertain || resource.conflict || !data?.canWrite;
  const completed = async (result: OrderDiscrepancyResult | null) => { if (result) { setSelectedId(result.discrepancyId); setNewShipment(null); setEditing(false); setPreviousId(null); await onChanged?.(); } };
  const command = (input: OrderDiscrepancyCommand) => resource.run(input).then(completed);
  const base = () => ({ expectedOrderVersion: data!.orderVersion, expectedShipmentVersion: shipment!.version, idempotencyKey: crypto.randomUUID() });
  const existing = () => ({ ...base(), discrepancyId: selected!.id, expectedExceptionVersion: editing && editingVersion !== null ? editingVersion : selected!.version });
  const upload = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024 || !/\.(pdf|png|jpe?g)$/i.test(file.name)) throw new Error("Выберите PDF, PNG или JPEG размером до 5 МБ");
      const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.onload = () => resolve(String(reader.result).split(",")[1]!); reader.readAsDataURL(file); });
      return await api.uploadDiscrepancyAttachment(orderId, { fileName: file.name, contentBase64 });
    } catch (cause) { resource.setError(errorMessage(cause)); return null; }
  };
  const download = async (assetId: string) => {
    if (!selected) return;
    try { const value = await api.downloadDiscrepancyAttachment(orderId, selected.id, assetId);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(value.contentBase64), char => char.charCodeAt(0))], { type: value.mimeType }));
      const link = document.createElement("a"); link.href = url; link.download = value.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { resource.setError(errorMessage(cause)); }
  };
  const feedback = <>
    {resource.error ? <DmFeedback presentation="inline" tone="danger" title="Действие не завершено" description={resource.error} /> : null}
    {resource.notice ? <DmFeedback presentation="inline" tone="success" title="Готово" description={resource.notice} /> : null}
    {resource.uncertain ? <><p>Результат запроса пока неизвестен. Повторите то же действие для сверки; введённые данные сохранены.</p><DmButton disabled={resource.busy} onClick={() => void resource.retry().then(completed)}>Повторить действие</DmButton></> : null}
    {resource.conflict ? <><p>Сначала обновите данные и сравните количества и историю. Ввод сохранён.</p><DmButton disabled={resource.loading} onClick={() => void resource.reload()}>Обновить данные расхождения</DmButton>{resource.reviewReady ? <DmButton onClick={() => { setEditingVersion(selected?.version ?? null); resource.reviewed(); }}>Данные проверены, продолжить</DmButton> : null}</> : null}
  </>;
  return <Section title="Расхождения по отправлениям">
    {!open ? feedback : null}
    {resource.loading && !data ? <LoadingState label="Загружаем расхождения" /> : null}
    {!data && resource.error ? <DmButton onClick={() => void resource.reload()}>Повторить загрузку расхождений</DmButton> : null}
    {data ? <DmFormSections><p>Заявление и согласование решения сохраняются отдельно от получения товара, оплаты и подписания документов.</p>
      {data.party === "BUYER" ? <div>{data.shipments.filter(row => row.eligible).map(row => <p key={row.id}><DmButton disabled={disabled} onClick={event => { trigger.current = event.currentTarget; setSelectedId(null); setNewShipment(row.id); setPreviousId(null); setEditing(true); }}>{`Сообщить о расхождении · ${row.number}`}</DmButton></p>)}</div> : null}
      {!data.discrepancies.length ? <p>Заявлений о расхождениях пока нет.</p> : data.discrepancies.map(row => <article key={row.id}><h3>{discrepancyKinds[row.statement.kind]} · {row.source.shipmentNumber}</h3><p>{discrepancyExecutionLabel(row, statusLabels[row.status])}</p><p>{row.statement.reason}</p><DmButton onClick={event => { trigger.current = event.currentTarget; setSelectedId(row.id); setNewShipment(null); setEditing(false); }}>{`Открыть заявление · ${row.source.shipmentNumber} · редакция ${row.version}`}</DmButton></article>)}
      <DmButton disabled={resource.loading} onClick={() => void resource.reload()}>Обновить список расхождений</DmButton>
    </DmFormSections> : null}
    <DmDialog open={open} mobileFullscreen title={newShipment ? "Новое заявление о расхождении" : "Заявление о расхождении"}
      onOpenChange={next => { if (!next && !resource.busy && !resource.uncertain) { setSelectedId(null); setNewShipment(null); setEditing(false); } }} onClosed={() => {
        if (shipmentFocus.current) { const target = document.getElementById(`shipment-${shipmentFocus.current}`); shipmentFocus.current = null; target?.scrollIntoView({ block: "center" }); target?.focus(); }
        else trigger.current?.focus();
      }}>
      <div ref={content} tabIndex={-1}><DmFormSections>{feedback}
        {shipment && data ? <>
          {selected ? <div><p>{discrepancyExecutionLabel(selected, statusLabels[selected.status])} · {selected.source.shipmentNumber} · редакция {selected.version}</p>
            <p>{selected.source.documentId ? `Исходная накладная: версия ${selected.source.documentVersion}. Контрольная сумма: ${selected.source.documentChecksum ?? "не указана"}` : "Исходная выпущенная накладная отсутствует."}</p>
            {selected.previousDiscrepancyId ? <p>Новая редакция после отклонения. Предыдущее заявление сохранено в списке.</p> : null}
            <DiscrepancyComparison claim={selected} />
            <p>{selected.statement.reason}</p><p>Предложение клиники: {discrepancyResolutions[selected.statement.requestedResolution]}.</p>
            {selected.resolution ? <p>Вариант поставщика: {discrepancyResolutions[selected.resolution]}.</p> : null}
            {selected.status === "AGREED" ? <p>Согласование само по себе не выполняет допоставку или возврат денег и не закрывает комплект документов.</p> : null}
            {selected.attachments.map(asset => <DmButton key={asset.id} onClick={() => void download(asset.id)}>Скачать {asset.name}</DmButton>)}
          </div> : null}
          {editing ? <DiscrepancyForm key={selected?.id ?? `${shipment.id}:${previousId ?? "new"}`} shipment={shipment} initial={selected} disabled={disabled}
            receiptEvents={events.filter(event => event.action === "RECEIVE_SHIPMENT" && event.details.shipmentId === shipment.id).map(event => ({ id: event.id, label: formatDate(event.createdAt, true) }))}
            onUpload={upload} onSave={async (statement, documentId, receiptId) => {
              if (selected) await command({ ...existing(), action: "SAVE", statement });
              else { const doc = shipment.documents.find(row => row.id === documentId); await command({ ...base(), action: "CREATE", shipmentId: shipment.id,
                sourceDocumentId: documentId, sourceDocumentVersion: doc?.version ?? null, sourceDocumentChecksum: doc?.checksum ?? null,
                sourceReceiptEventId: receiptId, previousDiscrepancyId: previousId, statement }); }
            }} /> : selected?.status === "DRAFT" && data.party === "BUYER" ? <div><DmButton disabled={disabled} onClick={() => { setEditingVersion(selected.version); setEditing(true); }}>Редактировать черновик</DmButton><DmButton appearance="primary" disabled={disabled} onClick={() => void command({ ...existing(), action: "SUBMIT" })}>Отправить расхождение</DmButton></div> : null}
          {selected?.status === "SUBMITTED" && data.party === "SUPPLIER" ? <DiscrepancyReply key={selected.id} initial={selected.statement.requestedResolution} disabled={disabled} supplier
            onReply={(reason, resolution, decision) => command({ ...existing(), action: "RESPOND", decision, resolution, reason })} /> : null}
          {selected?.status === "RESOLUTION_PROPOSED" && data.party === "BUYER" ? <DiscrepancyReply key={selected.id} initial={selected.resolution ?? selected.statement.requestedResolution} disabled={disabled}
            onReply={(reason, _resolution, decision) => command({ ...existing(), action: "DECIDE", accepted: decision === "AGREE", reason })} /> : null}
          {selected?.status === "REJECTED" && data.party === "BUYER" ? <><p>Отклонение не подтверждает полное получение товара. Можно подать новую связанную редакцию или обратиться в поддержку.</p><DmButton disabled={disabled} onClick={() => { setPreviousId(selected.id); setNewShipment(selected.shipmentId); setSelectedId(null); setEditing(true); }}>Создать связанную редакцию</DmButton></> : null}
          {selected?.resupply ? <OrderResupplyPanel key={selected.id} claim={selected} supplier={data.party === "SUPPLIER"} disabled={disabled} events={events}
            onDispatch={details => command({ ...existing(), action: "DISPATCH_RESUPPLY", ...details })}
            onShipment={id => { shipmentFocus.current = id; setSelectedId(null); setNewShipment(null); }} /> : null}
          {selected?.resupply && api.getResupplyDocuments && api.prepareResupplyDocument && api.downloadResupplyDocument ? <ResupplyDocumentPanel key={selected.id} api={api as ResupplyDocumentApi} orderId={orderId} discrepancyId={selected.id} revision={orderVersion} /> : null}
          {selected ? <div><h3>История заявления</h3><ol>{selected.events.map(event => {
            const details = event.details && typeof event.details === "object" ? event.details as Record<string, unknown> : {};
            return <li key={event.id}><p>{formatDate(event.createdAt, true)} — {eventLabels[event.action] ?? event.action} · редакция {event.version}</p>
              {typeof details.reason === "string" ? <p>{details.reason}</p> : null}
              {event.action === "OPERATOR_REVIEW" ? <><p>Оператор рассмотрел эту редакцию. Рекомендация не закрывает расхождение и не заменяет решение или подпись сторон.</p>{typeof details.nextStep === "string" ? <p>Следующий шаг: {details.nextStep}</p> : null}</> : null}
              {typeof details.decision === "string" ? <p>{details.decision === "AGREE" ? "Согласовано" : details.decision === "REJECT" ? "Отклонено" : "Встречное предложение"}</p> : null}
              {typeof details.accepted === "boolean" ? <p>{details.accepted ? "Клиника согласна" : "Клиника не согласна"}</p> : null}
            </li>;
          })}</ol></div> : null}
        </> : <LoadingState label="Загружаем заявление" />}
      </DmFormSections></div>
    </DmDialog>
  </Section>;
}
function DiscrepancyComparison({ claim }: { claim: OrderDiscrepancyView }) {
  return <DmTable caption="Сравнение количеств" columns={[{ key: "item", label: "Позиция" }, { key: "sent", label: "Отправлено" }, { key: "actual", label: "Заявлено полученным" }, { key: "damaged", label: "Повреждено" }]}>{claim.source.lines.map(line => {
    const actual = claim.statement.lines.find(item => item.shipmentItemId === line.shipmentItemId);
    return <tr key={line.shipmentItemId}><td data-label="Позиция">{line.name} · {line.uom}</td><td data-label="Отправлено">{line.sentQuantity}</td><td data-label="Заявлено полученным">{actual?.actualQuantity}</td><td data-label="Повреждено">{actual?.damagedQuantity}</td></tr>;
  })}</DmTable>;
}
function DiscrepancyReply({ initial, supplier = false, disabled, onReply }: { initial: DiscrepancyStatement["requestedResolution"]; supplier?: boolean; disabled: boolean;
  onReply: (reason: string, resolution: DiscrepancyStatement["requestedResolution"], decision: "AGREE" | "COUNTER" | "REJECT") => Promise<void> }) {
  const [reason, setReason] = useState(""), [resolution, setResolution] = useState(initial), [decision, setDecision] = useState<"AGREE" | "COUNTER" | "REJECT">("AGREE");
  const [attempted, setAttempted] = useState(false);
  return <form onSubmit={event => { event.preventDefault(); setAttempted(true); if (reason.trim().length >= 3) void onReply(reason, decision === "AGREE" ? initial : resolution, decision); }}><DmFormSections>
    <DmField label="Ответ"><DmDropdown disabled={disabled} value={decision} onChange={(_, d) => setDecision(d.value as typeof decision)}><option value="AGREE">{supplier ? "Согласовать предложение клиники" : "Принять предложение"}</option>{supplier ? <option value="COUNTER">Предложить другой вариант</option> : null}<option value="REJECT">Отклонить</option></DmDropdown></DmField>
    {supplier && decision === "COUNTER" ? <DmField label="Встречное решение"><DmDropdown disabled={disabled} value={resolution} onChange={(_, d) => setResolution(d.value as typeof resolution)}>{Object.entries(discrepancyResolutions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmDropdown></DmField> : null}
    <DmField label="Причина ответа" required validationState={attempted && reason.trim().length < 3 ? "error" : "none"} validationMessage={attempted && reason.trim().length < 3 ? "Укажите причину ответа" : undefined}><DmTextarea disabled={disabled} value={reason} maxLength={3000} onChange={(_, d) => setReason(d.value)} /></DmField>
    <DmButton type="submit" appearance="primary" disabled={disabled}>Отправить ответ</DmButton>
  </DmFormSections></form>;
}
