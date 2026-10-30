"use client";
import { dmLinkButtonProps } from "./link-button";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderInvoicesResponse, OrderInvoiceView, PrepareOrderInvoiceInput, OrderWorkflowCommand, OrderWorkflowResult } from "@marketplace/schemas";
import { vatLabel } from "@marketplace/schemas";
import { DmButton } from "./actions";
import { DmCheckbox } from "./controls";
import { DmDialog, DmFeedback, DmTable, LoadingState, Section } from "./primitives";
import { formatMoney } from "./money";
import { formatDate, errorMessage } from "./format";
import { WorkflowCommandTracker } from "./order-workflow-command";

export type OrderInvoiceApi = {
  getOrderInvoices(id: string): Promise<OrderInvoicesResponse>;
  prepareOrderInvoice(id: string, input: PrepareOrderInvoiceInput): Promise<OrderInvoiceView>;
  executeOrderWorkflow(id: string, input: OrderWorkflowCommand): Promise<OrderWorkflowResult>;
};
export function useOrderInvoices(api: Partial<OrderInvoiceApi>, orderId: string, orderVersion?: number) {
  const [data, setData] = useState<OrderInvoicesResponse | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(false); const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!api.getOrderInvoices || orderVersion === undefined) return;
    const request = ++sequence.current; setLoading(true);
    try { const value = await api.getOrderInvoices(orderId); if (request === sequence.current) { setData(value); setError(""); } }
    catch (cause) { if (request === sequence.current) setError(errorMessage(cause)); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [api, orderId, orderVersion]);
  useEffect(() => {
    void reload(); const focus = () => { if (!document.hidden) void reload(); };
    window.addEventListener("focus", focus); window.addEventListener("online", focus);
    return () => { ++sequence.current; window.removeEventListener("focus", focus); window.removeEventListener("online", focus); };
  }, [reload]);
  return { data, error, loading, reload, supported: Boolean(api.getOrderInvoices && api.prepareOrderInvoice) };
}
type Resource = ReturnType<typeof useOrderInvoices>;
const statusLabel = { GENERATING: "Формируется", FAILED: "Не сформирован", PREVIEW: "Черновик", CONFIRMED: "Выставлен", SUPERSEDED: "Заменён новой версией" };
export function OrderInvoiceHistory({ resource, onDownload }: { resource: Resource; onDownload: (id: string) => Promise<void> }) {
  if (!resource.supported) return null;
  const history = resource.data?.invoices.filter(invoice => invoice.confirmedAt) ?? [];
  return <Section title="История счетов">
    {resource.error ? <DmFeedback presentation="inline" tone="danger" title="Не удалось загрузить счета" description={resource.error} action={<DmButton onClick={() => void resource.reload()}>Повторить загрузку счетов</DmButton>} /> : null}
    {resource.loading && !resource.data ? <LoadingState label="Загружаем счета…" /> : history.length ? history.map(invoice => <div className="dm-order-document" key={invoice.documentId}>
      <div><strong>{invoice.number} · R{invoice.version}</strong><p>{statusLabel[invoice.status]} · {formatDate(invoice.confirmedAt!, true)}</p><p>{formatMoney(invoice.snapshot.totalMinor, invoice.snapshot.currency)}</p></div>
      <DmButton onClick={() => void onDownload(invoice.documentId)}>Скачать R{invoice.version}</DmButton>
    </div>) : !resource.error ? <p>Подтверждённые счета пока отсутствуют.</p> : null}
  </Section>;
}

export function OrderInvoicePanel({ api, resource, orderId, orderVersion, onConfirmed, onDownload, canIssue, busy: outerBusy }: {
  api: Partial<OrderInvoiceApi>; resource: Resource; orderId: string; orderVersion: number;
  onConfirmed: () => Promise<void>; onDownload: (id: string) => Promise<void>; canIssue: boolean; busy: boolean;
}) {
  const [preview, setPreview] = useState<OrderInvoiceView | null>(null), [open, setOpen] = useState(false), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [conflict, setConflict] = useState(false);
  const [unknownConfirmation, setUnknownConfirmation] = useState(false);
  const prepareRequest = useRef<PrepareOrderInvoiceInput | null>(null), confirmation = useRef(new WorkflowCommandTracker());
  const working = useRef(false), alive = useRef(true), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const stale = Boolean(preview && preview.snapshot.orderVersion !== orderVersion);
  const prepare = async () => {
    if (working.current || outerBusy || !api.prepareOrderInvoice || unknownConfirmation) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    prepareRequest.current ??= { expectedVersion: orderVersion, idempotencyKey: crypto.randomUUID() };
    try {
      const value = await api.prepareOrderInvoice(orderId, prepareRequest.current);
      if (!alive.current) return;
      prepareRequest.current = null; setPreview(value); setAcknowledged(false); setConflict(false); setOpen(true); await resource.reload();
    } catch (cause) {
      if (!alive.current) return;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
      if (typeof status === "number" && status >= 400 && status < 500 && status !== 408) prepareRequest.current = null;
      setError(errorMessage(cause));
      if (status === 409) { setConflict(true); await onConfirmed(); await resource.reload(); }
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  const confirm = async () => {
    if (working.current || outerBusy || !api.executeOrderWorkflow || !preview?.checksum || !acknowledged || !canIssue || (!unknownConfirmation && (conflict || stale))) return;
    working.current = true; setBusy(true); setError("");
    try {
      await api.executeOrderWorkflow(orderId, confirmation.current.command({ action: "ISSUE_INVOICE", documentId: preview.documentId, previewChecksum: preview.checksum }, preview.snapshot.orderVersion));
      if (!alive.current) return;
      confirmation.current.succeeded(); setUnknownConfirmation(false); setOpen(false); setPreview(null); setNotice("Счёт выставлен и доступен покупателю.");
      await onConfirmed(); await resource.reload(); trigger.current?.focus();
    } catch (cause) {
      if (!alive.current) return;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
      setUnknownConfirmation(!(typeof status === "number" && status >= 400 && status < 500 && status !== 408));
      setConflict(confirmation.current.rejected(cause)); setError(errorMessage(cause));
      if (status === 409) { await onConfirmed(); await resource.reload(); }
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  if (!resource.supported) return null;
  const issues = resource.data?.issues ?? [];
  const latest = resource.data?.invoices.find(invoice => invoice.status === "PREVIEW" && invoice.snapshot.orderVersion === orderVersion);
  const mutationFeedback = error ? <DmFeedback presentation="inline" tone="danger" title="Не удалось завершить действие" description={error} /> : null;
  const downloadPreview = async () => {
    if (!preview) return;
    try { await onDownload(preview.documentId); }
    catch (cause) { if (alive.current) setError(errorMessage(cause)); }
  };
  return <Section title="Счёт на оплату">
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
    {resource.error ? <DmFeedback presentation="inline" tone="danger" title="Не удалось загрузить данные счёта" description={resource.error} action={<DmButton onClick={() => void resource.reload()}>Повторить загрузку счетов</DmButton>} /> : null}
    {!open ? mutationFeedback : null}
    {resource.loading && !resource.data ? <LoadingState label="Проверяем данные счёта…" /> : null}
    {issues.length ? <DmFeedback tone="warning" title="Для формирования счёта нужны данные" description={issues.map(issue => `${issue.party === "BUYER" ? "Покупатель: " : issue.party === "SUPPLIER" ? "Поставщик: " : ""}${issue.message}`).join(". ")}
      action={issues.some(issue => issue.party === "SUPPLIER") ? <a {...dmLinkButtonProps({ appearance: "subtle" })} href="/supplier/settings?tab=requisites">Открыть реквизиты поставщика</a> : undefined} /> : null}
    {!canIssue ? <p>Формирование и подтверждение счёта доступны сотруднику с правами подтверждения заказов и выпуска документов.</p> : null}
    <div className="dm-order-actions">
      <DmButton ref={trigger} appearance="primary" disabled={busy || outerBusy || !canIssue || !resource.data?.canPrepare || Boolean(resource.error) || unknownConfirmation} onClick={() => void prepare()}>
        {busy && !open ? "Формируем…" : prepareRequest.current ? "Повторить формирование счёта" : resource.data?.currentDocumentId ? "Сформировать новую версию" : "Сформировать счёт"}
      </DmButton>
      {latest || preview ? <DmButton disabled={busy || outerBusy} onClick={() => { setPreview(preview ?? latest ?? null); setOpen(true); }}>Открыть предпросмотр</DmButton> : null}
    </div>
    <DmDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }} onClosed={() => trigger.current?.focus()} mobileFullscreen title="Предпросмотр счёта"
      description="Проверьте стороны, банковские реквизиты и итог. Покупатель получит счёт после подтверждения."
      actions={<><DmButton disabled={busy} onClick={() => setOpen(false)}>Закрыть</DmButton>{(conflict || stale) && !unknownConfirmation ? <DmButton disabled={busy || unknownConfirmation || !resource.data?.canPrepare} onClick={() => void prepare()}>Сформировать актуальный счёт</DmButton>
        : <DmButton appearance="primary" disabled={busy || outerBusy || !acknowledged || !canIssue || !preview?.checksum} onClick={() => void confirm()}>{busy ? "Подтверждаем…" : unknownConfirmation ? "Повторить подтверждение" : "Выставить счёт"}</DmButton>}</>}>
      {mutationFeedback}
      {stale || conflict ? <DmFeedback tone="warning" title="Предпросмотр устарел" description="Заказ или реквизиты изменились. Сформируйте и проверьте новую версию." /> : null}
      {preview ? <div className="dm-stack">
        <p><strong>{preview.number} · R{preview.version}</strong> · Черновик</p>
        <div><strong>Поставщик</strong><p>{preview.snapshot.supplier.source.legalName} · {preview.snapshot.supplier.source.identifier}</p><p>{preview.snapshot.supplier.source.legalAddressText}</p></div>
        <div><strong>Покупатель</strong><p>{preview.snapshot.buyer.source.legalName} · {preview.snapshot.buyer.source.identifier}</p><p>{preview.snapshot.buyer.source.legalAddressText}</p></div>
        <div><strong>Получатель платежа: {preview.snapshot.supplier.source.legalName}</strong><p>ИИК: {preview.snapshot.bankAccount.iban}</p><p>{preview.snapshot.bankAccount.bankName} · БИК: {preview.snapshot.bankAccount.bic} · КБе: {preview.snapshot.bankAccount.kbe}</p></div>
        <DmTable caption="Позиции счёта" columns={[{ key: "item", label: "Позиция" }, { key: "quantity", label: "Количество" }, { key: "total", label: "Сумма" }]}>
          {preview.snapshot.lines.map(line => <tr key={line.id}><td data-label="Позиция">{line.name}<p>{line.gift ? "Подарок" : vatLabel(line.tax?.declaration.selection)}</p></td><td data-label="Количество">{line.quantity} {line.unit}</td><td data-label="Сумма">{formatMoney(line.totalMinor, preview.snapshot.currency)}</td></tr>)}
        </DmTable>
        <p>Без НДС: {formatMoney(preview.snapshot.baseMinor, preview.snapshot.currency)} · НДС: {formatMoney(preview.snapshot.vatMinor, preview.snapshot.currency)}</p>
        <p><strong>К оплате: {formatMoney(preview.snapshot.totalMinor, preview.snapshot.currency)}</strong></p>
        <DmButton onClick={() => void downloadPreview()}>Скачать предпросмотр PDF</DmButton>
        <DmCheckbox label="Проверил реквизиты, состав и сумму счёта" checked={acknowledged} disabled={busy || unknownConfirmation || stale || conflict} onChange={(_, data) => setAcknowledged(data.checked === true)} />
      </div> : null}
    </DmDialog>
  </Section>;
}
