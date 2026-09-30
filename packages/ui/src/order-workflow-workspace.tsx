"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { OrderWorkflowCommand, OrderWorkflowResponse, OrderWorkflowResult, UploadDocumentInput } from "@marketplace/schemas";
import { documentUploadFileError } from "./document-upload-model";
import { DmButton, DmField, DmInput, DmFeedback, LoadingState, Section, formatDate, formatMoney, formatStatus, errorMessage as describeError } from "./index";
import { usePermissions } from "./permissions";
import { WorkflowCommandTracker, type WorkflowAction as Action } from "./order-workflow-command";

const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? describeError(cause) : fallback;
type Api = {
  getOrderWorkflow(id: string): Promise<OrderWorkflowResponse>;
  executeOrderWorkflow(id: string, input: OrderWorkflowCommand): Promise<OrderWorkflowResult>;
  uploadDocument(input: UploadDocumentInput): Promise<{ id: string }>;
};
const labels: Record<string, string> = { ACCEPT_COMPOSITION: "Клиника согласовала состав", ISSUE_INVOICE: "Поставщик выставил счёт", REPORT_TRANSFER: "Клиника сообщила о переводе", REQUEST_PAYMENT_DETAILS: "Поставщик запросил уточнение оплаты", CONFIRM_TRANSFER: "Поставщик подтвердил поступление", CANCEL: "Клиника отменила неоплаченный заказ" };

type WorkflowProps = { orderId: string; organizationId: string; api: Api; onDownload: (id: string) => Promise<void>; renderFulfillment?: (data: OrderWorkflowResponse, refresh: () => Promise<void>) => ReactNode; backHref?: string; backLabel?: string };
export function OrderWorkflowWorkspace(props: WorkflowProps) {
  return <OrderWorkflowSession key={`${props.organizationId}:${props.orderId}`} {...props} />;
}

function OrderWorkflowSession({ orderId, organizationId, api, onDownload, renderFulfillment, backHref = "/", backLabel = "В кабинет" }: WorkflowProps) {
  const has = usePermissions();
  const fileInputId = useId();
  const canAct = (action: Action["action"]) => has(action === "CONFIRM_TRANSFER" ? "payment.transfer.confirm" : ["ISSUE_INVOICE", "REQUEST_PAYMENT_DETAILS"].includes(action) ? "order.confirm" : "order.approve");
  const [data, setData] = useState<OrderWorkflowResponse | null>(null);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [noTransfer, setNoTransfer] = useState(false);
  const working = useRef(false);
  const alive = useRef(true);
  const readSequence = useRef(0);
  const readPending = useRef<Promise<void> | null>(null);
  const pending = useRef(new WorkflowCommandTracker());
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const uploadNumber = useRef("");
  const refresh = useCallback(async () => {
    if (readPending.current) await readPending.current;
    if (!alive.current) return;
    if (!navigator.onLine) { setReadError("Нет сети. Показаны последние полученные данные."); return; }
    const sequence = ++readSequence.current;
    const request = (async () => {
    try { const next = await api.getOrderWorkflow(orderId); if (alive.current && sequence === readSequence.current) { setData(next); setReadError(""); } }
    catch (cause) { if (alive.current && sequence === readSequence.current) setReadError(errorMessage(cause, "Не удалось обновить заказ. Показаны последние полученные данные.")); }
    })();
    readPending.current = request;
    await request;
    if (readPending.current === request) readPending.current = null;
  }, [api, orderId]);
  useEffect(() => {
    alive.current = true; void refresh();
    const check = () => { if (!document.hidden && !working.current && !readPending.current) void refresh(); };
    const offline = () => setReadError("Нет сети. Показаны последние полученные данные.");
    const timer = setInterval(check, 5000); window.addEventListener("focus", check);
    window.addEventListener("online", check); window.addEventListener("offline", offline);
    return () => { alive.current = false; ++readSequence.current; clearInterval(timer); window.removeEventListener("focus", check); window.removeEventListener("online", check); window.removeEventListener("offline", offline); };
  }, [refresh]);
  const perform = async (action: Action) => {
    if (!data || working.current || !alive.current || !canAct(action.action)) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await api.executeOrderWorkflow(orderId, pending.current.command(action, data.version));
      if (!alive.current) return;
      pending.current.succeeded(); setNotice("Изменение сохранено. Обе стороны увидят обновлённый статус."); await refresh();
    }
    catch (cause) {
      if (!alive.current) return;
      setError(errorMessage(cause, "Действие не подтверждено. Повторите запрос."));
      if (pending.current.rejected(cause)) await refresh();
    }
    finally { working.current = false; if (alive.current) setBusy(false); }
  };
  const sendFile = async () => {
    if (!data || !file || working.current) return;
    const supplier = organizationId === data.order.supplierOrganizationId;
    if (!has("document.upload") || !canAct(supplier ? "ISSUE_INVOICE" : "REPORT_TRANSFER")) { setError("Действие недоступно вашей роли. Ввод сохранён."); return; }
    if (!supplier && (!paidAt || !data.invoiceDocumentId)) { setError("Укажите дату перевода и дождитесь счёта поставщика."); return; }
    const fileError = documentUploadFileError(file);
    if (fileError || !file.name.toLowerCase().endsWith(".pdf")) { setError(fileError ?? "Выберите файл PDF."); return; }
    working.current = true; setBusy(true); setError("");
    try {
      if (uploaded.current?.file !== file) {
        if (!uploadNumber.current) uploadNumber.current = `ORDER-${crypto.randomUUID()}`;
        const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.readAsDataURL(file); });
        const doc = await api.uploadDocument({ ownerOrganizationId: organizationId, supplierOrderId: orderId, kind: supplier ? "INVOICE" : "PAYMENT_PROOF", format: "PDF", title: supplier ? "Счёт на оплату заказа" : "Квитанция о заявленном переводе", documentNumber: uploadNumber.current, amountMinor: data.order.subtotalAmountMinor, currency: data.order.currency, fileName: file.name, contentBase64, requiredSignatureCount: 0 });
        if (!alive.current) return;
        uploaded.current = { file, id: doc.id };
      }
      working.current = false;
      await perform(supplier ? { action: "ISSUE_INVOICE", documentId: uploaded.current.id } : { action: "REPORT_TRANSFER", documentId: uploaded.current.id, invoiceDocumentId: data.invoiceDocumentId!, amountMinor: data.order.subtotalAmountMinor, paidAt: new Date(paidAt).toISOString(), comment });
    } catch (cause) { if (alive.current) setError(errorMessage(cause, "Файл не отправлен. Проверьте соединение и повторите.")); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  };
  if (!data) return <>{readError ? <DmFeedback tone="danger" title="Заказ недоступен" description={readError} action={<DmButton onClick={() => void refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем этапы заказа" />}</>;
  const buyer = organizationId === data.order.buyerOrganizationId;
  const supplier = organizationId === data.order.supplierOrganizationId;
  const unpaid = data.paymentStatus === "UNPAID";
  const reserveOverdue = ["DUE", "EXPIRED"].includes(data.reservationState?.status ?? "");
  const mayInvoice = supplier && unpaid && !reserveOverdue && ["CONFIRMED", "AWAITING_PAYMENT"].includes(data.status) && !data.claims.length;
  const mayReport = buyer && unpaid && !reserveOverdue && data.status === "AWAITING_PAYMENT";
  const download = async (id: string) => { try { await onDownload(id); } catch (cause) { if (alive.current) setError(errorMessage(cause, "Не удалось скачать документ")); } };
  return <div style={{ display: "grid", gap: 20 }}>
    <header><a href={backHref}>{backLabel}</a><h1>Заказ {data.order.orderNumber}</h1><p>{formatMoney(data.order.subtotalAmountMinor, data.order.currency)} · {formatStatus(data.status)}</p></header>
    {readError ? <DmFeedback tone="warning" title="Не удалось обновить заказ" description={readError} action={<DmButton disabled={busy} onClick={() => void refresh()}>Повторить загрузку</DmButton>} /> : null}
    {error ? <DmFeedback tone="danger" title="Требуется внимание" description={error} action={<DmButton disabled={busy} onClick={() => void refresh()}>Обновить условия</DmButton>} /> : null}
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
    {data.reservationState?.status === "HELD_TRANSFER" ? <DmFeedback tone="neutral" title="Резерв удерживается" description="Перевод заявлен. Автоматическая отмена и снятие резерва приостановлены, в том числе при уточнении оплаты. Если проверка затянулась, обратитесь в поддержку." /> : null}
    {data.reservationState?.status === "HELD_EXTERNAL" ? <DmFeedback tone="neutral" title="Резерв управляется платёжным или складским контуром" description="Автоматическое локальное освобождение недоступно. Изменение требует завершения соответствующей операции." /> : null}
    {reserveOverdue ? <DmFeedback tone="warning" title={data.reservationState?.status === "EXPIRED" ? "Срок резерва истёк" : "Срок резерва истёк, освобождение ожидается"} description="Оплата не была заявлена до окончания срока. Не переводите деньги по прежнему счёту. Для новой покупки заново проверьте цену и наличие в каталоге." /> : null}
    {data.reservationState?.status === "ACTIVE" && data.reservationState.expiresAt ? <p>Локальный резерв действует до {formatDate(data.reservationState.expiresAt, true)}. После заявления перевода автоматическое снятие приостанавливается.</p> : null}
    <Section title="Этапы заказа"><ol><li>Состав: {data.status === "AWAITING_CONFIRMATION" ? "ожидается ответ поставщика" : data.status === "PARTIALLY_CONFIRMED" ? "нужно согласие клиники" : "согласование завершено"}</li><li>Счёт: {data.invoiceDocumentId ? <DmButton appearance="subtle" onClick={() => void download(data.invoiceDocumentId!)}>Скачать счёт</DmButton> : "ещё не выставлен"}</li><li>Оплата: {data.paymentStatus === "PAID" ? "поступление подтверждено поставщиком" : data.claims.length ? "перевод заявлен — ожидается подтверждение поставщика (pending)" : "ожидается оплата"}</li><li>Исполнение: {formatStatus(data.status)}</li></ol><p>Статусы обновляются каждые 5 секунд, пока страница открыта. Квитанция сама по себе не подтверждает поступление денег.</p></Section>
    <Section title="Согласованный состав"><ul>{data.order.items.map(item => <li key={item.id}>{item.offer?.productVariant.product.canonicalName ?? "Товар"}: заказано {item.quantity}, подтверждено {item.acceptedQuantity ?? "0"}; {formatMoney(item.totalPriceMinor, item.currency)}{item.decisionReason ? ` — ${item.decisionReason}` : ""}</li>)}</ul>{buyer && data.status === "PARTIALLY_CONFIRMED" ? <DmButton disabled={busy || !canAct("ACCEPT_COMPOSITION")} onClick={() => void perform({ action: "ACCEPT_COMPOSITION" })}>Принять состав и сумму</DmButton> : null}</Section>
    {(mayInvoice || mayReport) ? <Section title={mayInvoice ? "Выставить банковский счёт" : "Сообщить о переводе"}><p>{mayInvoice ? "Загрузите счёт с реквизитами и суммой заказа. После заявления перевода замена счёта недоступна." : "Переведите полную сумму по реквизитам счёта поставщика и приложите квитанцию. Уточнения сохраняются в истории."}</p><DmField label={{ htmlFor: fileInputId, children: mayInvoice ? "Счёт, PDF до 10 МБ (10 000 000 байт)" : "Квитанция, PDF до 10 МБ (10 000 000 байт)" }}><input id={fileInputId} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); uploaded.current = null; uploadNumber.current = ""; }} /></DmField>{mayReport ? <><DmField label="Дата и время перевода"><DmInput type="datetime-local" value={paidAt} onChange={(_, d) => setPaidAt(d.value)} /></DmField><DmField label="Комментарий к переводу"><DmInput value={comment} onChange={(_, d) => setComment(d.value)} /></DmField></> : null}<DmButton disabled={busy || !file || !has("document.upload") || !canAct(mayInvoice ? "ISSUE_INVOICE" : "REPORT_TRANSFER")} onClick={() => void sendFile()}>{busy ? "Сохраняем…" : mayInvoice ? "Выставить счёт" : "Отправить квитанцию"}</DmButton></Section> : null}
    {data.claims.length ? <Section title="Проверка перевода">{data.claims.map(claim => <article key={claim.id}><p>{formatDate(claim.paidAt, true)} · {formatMoney(claim.amountMinor, claim.currency)} · {claim.status === "CONFIRMED" ? "Подтверждено" : claim.status === "NEEDS_INFORMATION" ? "Запрошено уточнение" : "Ожидает проверки"}</p><p>{claim.comment}</p><DmButton onClick={() => void download(claim.documentId)}>Скачать квитанцию</DmButton>{supplier && unpaid ? <DmButton disabled={busy || !canAct("CONFIRM_TRANSFER")} onClick={() => void perform({ action: "CONFIRM_TRANSFER", claimId: claim.id })}>Подтверждаю поступление полной суммы</DmButton> : null}</article>)}{supplier && unpaid ? <><DmField label="Что нужно уточнить по оплате"><DmInput value={comment} onChange={(_, d) => setComment(d.value)} /></DmField><DmButton disabled={busy || !canAct("REQUEST_PAYMENT_DETAILS") || comment.trim().length < 3} onClick={() => void perform({ action: "REQUEST_PAYMENT_DETAILS", comment })}>Запросить уточнение</DmButton></> : null}</Section> : null}
    {renderFulfillment?.(data, refresh)}
    {buyer ? <Section title="Поставки и получение">{data.order.shipments?.length ? data.order.shipments.map(shipment => <article key={shipment.id}><h3>{shipment.shipmentNumber}</h3><p>{formatStatus(shipment.status)} · {shipment.carrierName ?? "Перевозчик не указан"} · Трек: {shipment.trackingNumber ?? "ещё не присвоен"}</p>{["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(shipment.status) ? <ReceiptForm shipment={shipment} busy={busy || !canAct("RECEIVE_SHIPMENT")} onReceive={items => perform({ action: "RECEIVE_SHIPMENT", shipmentId: shipment.id, items })} /> : null}</article>) : <p>Поставщик ещё не создал поставку.</p>}</Section> : null}
    {buyer && unpaid && !data.claims.length && ["AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT"].includes(data.status) ? <Section title="Отмена до оплаты"><DmField label="Причина отмены"><DmInput value={comment} onChange={(_, d) => setComment(d.value)} /></DmField><label><input type="checkbox" checked={noTransfer} onChange={e => setNoTransfer(e.target.checked)} /> Перевод по этому заказу не выполнялся</label><DmButton disabled={busy || !canAct("CANCEL") || !noTransfer || comment.trim().length < 3} onClick={() => void perform({ action: "CANCEL", reason: comment, transferNotMade: true })}>Отменить заказ</DmButton></Section> : null}
    <Section title="История действий">{data.events.length ? <ol>{data.events.map(event => <li key={event.id}>{formatDate(event.createdAt, true)} — {labels[event.action] ?? event.action}{typeof event.details.comment === "string" && event.details.comment ? `: ${event.details.comment}` : ""}{typeof event.details.reason === "string" ? `: ${event.details.reason}` : ""}</li>)}</ol> : <p>Действий по оплате пока нет.</p>}</Section>
  </div>;
}

function ReceiptForm({ shipment, busy, onReceive }: { shipment: NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number]; busy: boolean; onReceive: (items: { shipmentItemId: string; deliveredQuantity: string }[]) => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  return <div><p>Укажите суммарное количество уже полученных упаковок по каждой позиции. Неполученные позиции оставьте без изменений.</p>{shipment.items.map((item, index) => <DmField key={item.id} label={`Позиция ${index + 1}: отправлено ${item.quantity}, ранее получено ${item.deliveredQuantity}`}><DmInput inputMode="decimal" value={quantities[item.id] ?? item.deliveredQuantity} onChange={(_, d) => setQuantities(current => ({ ...current, [item.id]: d.value.replace(",", ".") }))} /></DmField>)}<DmButton disabled={busy} onClick={() => void onReceive(shipment.items.map(item => ({ shipmentItemId: item.id, deliveredQuantity: quantities[item.id] ?? item.deliveredQuantity })))}>Подтвердить фактическое получение</DmButton></div>;
}
