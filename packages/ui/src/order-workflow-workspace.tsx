"use client";
import { DmFileInput, DmCheckbox, DmTabList } from "./controls";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { OrderWorkflowCommand, OrderWorkflowResponse, OrderWorkflowResult, UploadDocumentInput } from "@marketplace/schemas";
import { Tab } from "@fluentui/react-components";
import { OrderDetailOverview, OrderDetailItems, OrderDetailDocuments } from "./order-detail-overview";
import { OrderSupplierContacts } from "./order-supplier-contacts";
import { orderOverview, type OrderDetailTab } from "./order-presentation";
import { documentUploadFileError } from "./document-upload-model";
import { DmButton, DmField, DmInput, DmFeedback, LoadingState, Section, formatDate, formatMoney, formatStatus, errorMessage as describeError } from "./index";
import { usePermissions } from "./permissions";
import { WorkflowCommandTracker, type WorkflowAction as Action } from "./order-workflow-command";
import { moneyInputValue, parseMoneyInput } from "./money";
import { PaymentSummaryPanel, TransferReviewPanel, PaymentReductionPanel } from "./manual-payment-panels";
import type { PaymentPolicyApi } from "./supplier-payment-policy-panel";
const SupplierPaymentPolicyPanel = lazy(() => import("./supplier-payment-policy-panel").then(module => ({ default: module.SupplierPaymentPolicyPanel })));
const OrderReturnPanel = lazy(() => import("./order-return-panel").then(module => ({ default: module.OrderReturnPanel })));
const OrderPromotionSummary = lazy(() => import("./order-promotion-summary").then(module => ({ default: module.OrderPromotionSummary })));

const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? describeError(cause) : fallback;
type Api = Partial<PaymentPolicyApi> & {
  getOrderWorkflow(id: string): Promise<OrderWorkflowResponse>;
  executeOrderWorkflow(id: string, input: OrderWorkflowCommand): Promise<OrderWorkflowResult>;
  uploadDocument(input: UploadDocumentInput): Promise<{ id: string }>;
};
const labels: Record<string, string> = { ACCEPT_COMPOSITION: "Клиника согласовала состав", ISSUE_INVOICE: "Поставщик выставил счёт", REPORT_TRANSFER: "Клиника сообщила о переводе", REQUEST_PAYMENT_DETAILS: "Поставщик запросил уточнение оплаты", CONFIRM_TRANSFER: "Поставщик подтвердил поступление", CANCEL: "Клиника отменила неоплаченный заказ", RECORD_TRANSFER_CHECK: "Поставщик проверил перевод и назначил повторную проверку", OPEN_PAYMENT_DISPUTE: "Открыт спор по переводу", PROPOSE_PAYMENT_REDUCTION: "Предложено уменьшение заказа", DECIDE_PAYMENT_REDUCTION: "Рассмотрено уменьшение заказа" };

Object.assign(labels, { REQUEST_RETURN: "Клиника запросила возврат", DECIDE_RETURN: "Поставщик рассмотрел возврат", SEND_RETURN_GOODS: "Клиника отправила товар обратно", RECEIVE_RETURN_GOODS: "Поставщик получил возвращённый товар", SEND_MANUAL_REFUND: "Поставщик сообщил об отправке денег", RECEIVE_MANUAL_REFUND: "Клиника подтвердила получение возврата", REORDER: "Создана корзина для повторной закупки" });
type WorkflowProps = { hideHeading?: boolean; orderId: string; organizationId: string; api: Api; onDownload: (id: string) => Promise<void>; conversation?: ReactNode; renderConfirmation?: (data: OrderWorkflowResponse, refresh: () => Promise<void>) => ReactNode; renderFulfillment?: (data: OrderWorkflowResponse, refresh: () => Promise<void>) => ReactNode; backHref?: string; backLabel?: string; cartHref?: string };
export function OrderWorkflowWorkspace(props: WorkflowProps) {
  return <OrderWorkflowSession key={`${props.organizationId}:${props.orderId}`} {...props} />;
}

function OrderWorkflowSession({ hideHeading = false, orderId, organizationId, api, onDownload, renderFulfillment, renderConfirmation, conversation, backHref = "/", backLabel = "В кабинет", cartHref = "/" }: WorkflowProps) {
  const has = usePermissions();
  const fileInputId = useId();
  const tabId = useId();
  const [selectedTab, setSelectedTab] = useState<OrderDetailTab | null>(null);
  const canAct = (action: Action["action"]) => has(...(action === "SEND_MANUAL_REFUND" ? ["payment.transfer.confirm", "document.upload"] : [action === "CONFIRM_TRANSFER" ? "payment.transfer.confirm" : action === "REORDER" ? "order.create" : ["ISSUE_INVOICE", "REQUEST_PAYMENT_DETAILS", "RECORD_TRANSFER_CHECK", "DECIDE_RETURN", "RECEIVE_RETURN_GOODS"].includes(action) || (["OPEN_PAYMENT_DISPUTE", "PROPOSE_PAYMENT_REDUCTION", "DECIDE_PAYMENT_REDUCTION"].includes(action) && organizationId === data?.order.supplierOrganizationId) ? "order.confirm" : "order.approve"]));
  const [data, setData] = useState<OrderWorkflowResponse | null>(null);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reordered, setReordered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [transferAmount, setTransferAmount] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [noTransfer, setNoTransfer] = useState(false);
  const working = useRef(false);
  const alive = useRef(true);
  const readSequence = useRef(0);
  const readPending = useRef<Promise<void> | null>(null);
  const pending = useRef(new WorkflowCommandTracker());
  const uploaded = useRef<{ file: File; id: string; amountMinor: string; currency: string } | null>(null);
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
      const result = await api.executeOrderWorkflow(orderId, pending.current.command(action, data.version));
      if (!alive.current) return;
      if (result.cartId) setReordered(true);
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
    const amountMinor = supplier ? data.order.subtotalAmountMinor : parseMoneyInput(transferAmount ?? moneyInputValue(data.paymentSummary?.remainingAmountMinor ?? data.order.subtotalAmountMinor));
    if (!amountMinor) { setError("Укажите положительную сумму перевода с точностью до двух знаков."); return; }
    if (!has("document.upload") || !canAct(supplier ? "ISSUE_INVOICE" : "REPORT_TRANSFER")) { setError("Действие недоступно вашей роли. Ввод сохранён."); return; }
    if (!supplier && (!paidAt || !Number.isFinite(new Date(paidAt).getTime()) || !data.invoiceDocumentId)) { setError("Укажите дату перевода и дождитесь счёта поставщика."); return; }
    const fileError = documentUploadFileError(file);
    if (fileError || !file.name.toLowerCase().endsWith(".pdf")) { setError(fileError ?? "Выберите файл PDF."); return; }
    working.current = true; setBusy(true); setError("");
    try {
      if (uploaded.current?.file !== file || uploaded.current.amountMinor !== amountMinor || uploaded.current.currency !== data.order.currency) {
        if (uploaded.current) uploadNumber.current = "";
        if (!uploadNumber.current) uploadNumber.current = `ORDER-${crypto.randomUUID()}`;
        const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.readAsDataURL(file); });
        const doc = await api.uploadDocument({ ownerOrganizationId: organizationId, supplierOrderId: orderId, kind: supplier ? "INVOICE" : "PAYMENT_PROOF", format: "PDF", title: supplier ? "Счёт на оплату заказа" : "Квитанция о заявленном переводе", documentNumber: uploadNumber.current, amountMinor, currency: data.order.currency, fileName: file.name, contentBase64, requiredSignatureCount: 0 });
        if (!alive.current) return;
        uploaded.current = { file, id: doc.id, amountMinor, currency: data.order.currency };
      }
      working.current = false;
      await perform(supplier ? { action: "ISSUE_INVOICE", documentId: uploaded.current.id } : { action: "REPORT_TRANSFER", documentId: uploaded.current.id, invoiceDocumentId: data.invoiceDocumentId!, amountMinor, paidAt: new Date(paidAt).toISOString(), comment });
    } catch (cause) { if (alive.current) setError(errorMessage(cause, "Файл не отправлен. Проверьте соединение и повторите.")); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  };
  if (!data) return <>{readError ? <DmFeedback tone="danger" title="Заказ недоступен" description={readError} action={<DmButton onClick={() => void refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем этапы заказа" />}</>;
  const buyer = organizationId === data.order.buyerOrganizationId;
  const supplier = organizationId === data.order.supplierOrganizationId;
  const unpaid = data.paymentStatus === "UNPAID";
  const reserveOverdue = ["DUE", "EXPIRED"].includes(data.reservationState?.status ?? "");
  const replacementInvoice = !data.invoiceDocumentId && data.claims.length > 0 && data.claims.every(claim => claim.status === "CONFIRMED");
  const mayInvoice = supplier && !reserveOverdue && (unpaid || replacementInvoice) && ["CONFIRMED", "AWAITING_PAYMENT", "PAID"].includes(data.status) && (!data.claims.length || replacementInvoice);
  const mayReport = buyer && !reserveOverdue && Boolean(data.invoiceDocumentId) && ["AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "PARTIALLY_FULFILLED", "DELIVERED"].includes(data.status);
  const download = async (id: string) => { try { await onDownload(id); } catch (cause) { if (alive.current) setError(errorMessage(cause, "Не удалось скачать документ")); } };
  const overview = orderOverview(data, supplier);
  const activeTab = selectedTab ?? overview.tab;
  const selectTab = (tab: OrderDetailTab) => {
    setSelectedTab(tab);
    requestAnimationFrame(() => document.getElementById(`${tabId}-${tab}`)?.focus());
  };
  const tabs: { value: OrderDetailTab; label: string }[] = [{ value: "payment", label: "Оплата" }, { value: "shipments", label: "Отгрузки" }, { value: "documents", label: "Документы" }, { value: "returns", label: "Возвраты" }, { value: "history", label: "История" }];
  const panel = (tab: OrderDetailTab) => ({ id: `${tabId}-${tab}`, role: "tabpanel", "aria-labelledby": `${tabId}-tab-${tab}`, hidden: activeTab !== tab, tabIndex: -1, className: "dm-order-tab-panel" });
  return <div className="dm-order-detail">
    <header className="dm-order-identity"><a href={backHref}>{backLabel}</a><div>{hideHeading ? <h2>Заказ № {data.order.orderNumber}</h2> : <h1>Заказ № {data.order.orderNumber}</h1>}<span>{supplier ? data.order.buyer?.displayName ?? "Клиника" : data.order.supplier?.displayName ?? "Поставщик"}{data.order.createdAt ? ` · ${formatDate(data.order.createdAt)}` : ""}</span><strong className="dm-order-identity-total">{formatMoney(data.order.subtotalAmountMinor, data.order.currency)}</strong></div></header>
    {readError ? <DmFeedback tone="warning" title="Не удалось обновить заказ" description={readError} action={<DmButton disabled={busy} onClick={() => void refresh()}>Повторить загрузку</DmButton>} /> : null}
    {error ? <DmFeedback tone="danger" title="Требуется внимание" description={error} action={<DmButton disabled={busy} onClick={() => void refresh()}>Обновить условия</DmButton>} /> : null}
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
    <OrderDetailOverview data={data} supplier={supplier} onTab={selectTab} confirmation={renderConfirmation?.(data, refresh)} conversation={conversation} />
    <Suspense fallback={null}><OrderPromotionSummary data={data} /></Suspense>
    {data.reservationState?.status === "HELD_TRANSFER" ? <DmFeedback tone="neutral" title="Резерв удерживается" description="Перевод заявлен. Автоматическая отмена и снятие резерва приостановлены, в том числе при уточнении оплаты. Если проверка затянулась, обратитесь в поддержку." /> : null}
    {data.reservationState?.status === "HELD_EXTERNAL" ? <DmFeedback tone="neutral" title="Резерв управляется платёжным или складским контуром" description="Автоматическое локальное освобождение недоступно. Изменение требует завершения соответствующей операции." /> : null}
    {reserveOverdue ? <DmFeedback tone="warning" title={data.reservationState?.status === "EXPIRED" ? "Срок резерва истёк" : "Срок резерва истёк, освобождение ожидается"} description="Оплата не была заявлена до окончания срока. Не переводите деньги по прежнему счёту. Для новой покупки заново проверьте цену и наличие в каталоге." /> : null}
    {data.reservationState?.status === "ACTIVE" && data.reservationState.expiresAt ? <p>Локальный резерв действует до {formatDate(data.reservationState.expiresAt, true)}. После заявления перевода автоматическое снятие приостанавливается.</p> : null}
    <div className="dm-order-columns"><div className="dm-order-main"><OrderDetailItems data={data} action={buyer && data.status === "PARTIALLY_CONFIRMED" ? <DmButton disabled={busy || !canAct("ACCEPT_COMPOSITION")} onClick={() => void perform({ action: "ACCEPT_COMPOSITION" })}>Принять состав и сумму</DmButton> : undefined} />

    <div className="dm-order-tabs"><DmTabList selectedValue={activeTab} onTabSelect={(_, value) => setSelectedTab(value.value as OrderDetailTab)} aria-label="Подробности заказа">{tabs.map(tab => <Tab id={`${tabId}-tab-${tab.value}`} key={tab.value} value={tab.value} aria-controls={`${tabId}-${tab.value}`}>{tab.label}{tab.value === "returns" && overview.openReturn ? " •" : ""}</Tab>)}</DmTabList></div>
    <div {...panel("payment")}>
    {!mayInvoice && !mayReport && !data.claims.length ? <p className="dm-order-muted">{overview.terminal ? "Заказ закрыт. Оплата не требуется." : "Доступные действия появятся после согласования состава и выставления счёта."}</p> : null}
    {(mayInvoice || mayReport) ? <Section title={mayInvoice ? "Выставить банковский счёт" : "Сообщить о переводе"}><p>{mayInvoice ? "Загрузите счёт с реквизитами и суммой заказа. После заявления перевода замена счёта недоступна." : "Укажите сумму этого перевода и приложите отдельную квитанцию. Доплаты учитываются после проверки поставщиком."}</p><DmField label={{ htmlFor: fileInputId, children: mayInvoice ? "Счёт, PDF до 10 МБ (10 000 000 байт)" : "Квитанция, PDF до 10 МБ (10 000 000 байт)" }}><DmFileInput id={fileInputId}  accept="application/pdf,.pdf" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); uploaded.current = null; uploadNumber.current = ""; }} /></DmField>{mayReport ? <><DmField label={`Сумма этого перевода, ${data.order.currency}`} validationState={transferAmount !== null && !parseMoneyInput(transferAmount) ? "error" : "none"} validationMessage={transferAmount !== null && !parseMoneyInput(transferAmount) ? "Укажите положительную сумму с точностью до двух знаков" : undefined}><DmInput inputMode="decimal" disabled={busy} value={transferAmount ?? moneyInputValue(data.paymentSummary?.remainingAmountMinor ?? data.order.subtotalAmountMinor)} onChange={(_, d) => setTransferAmount(d.value)} /></DmField><DmField label="Дата и время перевода"><DmInput type="datetime-local" value={paidAt} onChange={(_, d) => setPaidAt(d.value)} /></DmField><DmField label="Комментарий к переводу"><DmInput value={comment} onChange={(_, d) => setComment(d.value)} /></DmField></> : null}<DmButton disabled={busy || !file || !has("document.upload") || !canAct(mayInvoice ? "ISSUE_INVOICE" : "REPORT_TRANSFER")} onClick={() => void sendFile()}>{busy ? "Сохраняем…" : mayInvoice ? "Выставить счёт" : "Отправить квитанцию"}</DmButton></Section> : null}
    <TransferReviewPanel data={data} busy={busy} supplier={supplier} party={buyer || supplier} canAct={canAct} perform={perform} download={download} />
    {buyer || supplier ? <PaymentReductionPanel data={data} busy={busy} organizationId={organizationId} canAct={canAct} perform={perform} /> : null}
    {supplier && has("supplier.profile.manage") && api.getSupplierPaymentPolicy && api.saveSupplierPaymentPolicy ? <Suspense fallback={null}><SupplierPaymentPolicyPanel api={api as Api & PaymentPolicyApi} onSaved={refresh} /></Suspense> : null}
    </div><div {...panel("returns")}>
    {buyer || supplier || data.returns?.length ? <Suspense fallback={<LoadingState label="Загружаем возвраты" />}><OrderReturnPanel data={data} organizationId={organizationId} busy={busy} canAct={canAct} perform={perform} download={download} api={api} /></Suspense> : null}
    </div><div {...panel("documents")}><OrderDetailDocuments data={data} download={download} /></div>
    {buyer && ["DELIVERED", "CANCELLED"].includes(data.status) ? <Section title="Повторная закупка"><p>Создайте новую корзину по составу заказа. Перед оформлением проверьте текущие цены, доступность и условия; прежняя скидка не гарантируется.</p>{reordered ? <a href={cartHref}>Перейти в корзину и проверить текущие условия</a> : <DmButton disabled={busy || !canAct("REORDER")} onClick={() => void perform({ action: "REORDER" })}>Создать корзину для повторной закупки</DmButton>}</Section> : null}
    <div {...panel("shipments")}>
    {renderFulfillment?.(data, refresh)}
    {buyer ? <Section title="Поставки и получение">{data.order.shipments?.length ? data.order.shipments.map(shipment => <article key={shipment.id}><h3>{shipment.shipmentNumber}</h3><p>{formatStatus(shipment.status)} · {shipment.carrierName ?? "Перевозчик не указан"} · Трек: {shipment.trackingNumber ?? "ещё не присвоен"}</p>{["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(shipment.status) ? <ReceiptForm shipment={shipment} busy={busy || !canAct("RECEIVE_SHIPMENT")} onReceive={items => perform({ action: "RECEIVE_SHIPMENT", shipmentId: shipment.id, items })} /> : null}</article>) : <p>Поставщик ещё не создал поставку.</p>}</Section> : null}
    </div><div {...panel("history")}>
    {buyer && unpaid && !data.claims.length && ["AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT"].includes(data.status) ? <Section title="Отмена до оплаты"><DmField label="Причина отмены"><DmInput value={comment} onChange={(_, d) => setComment(d.value)} /></DmField><DmCheckbox checked={noTransfer} onChange={e => setNoTransfer(e.target.checked)} label="Перевод по этому заказу не выполнялся" /><DmButton disabled={busy || !canAct("CANCEL") || !noTransfer || comment.trim().length < 3} onClick={() => void perform({ action: "CANCEL", reason: comment, transferNotMade: true })}>Отменить заказ</DmButton></Section> : null}
    <Section title="История действий">{data.events.length ? <ol>{data.events.map(event => <li key={event.id}>{formatDate(event.createdAt, true)} — {labels[event.action] ?? "Состояние заказа обновлено"}{typeof event.details.comment === "string" && event.details.comment ? `: ${event.details.comment}` : ""}{typeof event.details.reason === "string" ? `: ${event.details.reason}` : ""}</li>)}</ol> : <p>Действий по оплате пока нет.</p>}</Section>
    </div></div>
      <aside className="dm-order-sidebar"><OrderSupplierContacts contacts={data.supplierContacts} /><div className="dm-order-card dm-order-payment-summary"><div className="dm-order-card-heading"><h2>Оплата</h2><span className="dm-order-payment-label" data-tone={overview.payment.tone}>{overview.payment.label}</span></div><PaymentSummaryPanel data={data} compact /></div><OrderDetailDocuments data={data} download={download} /></aside>
    </div>
  </div>;
}

function ReceiptForm({ shipment, busy, onReceive }: { shipment: NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number]; busy: boolean; onReceive: (items: { shipmentItemId: string; deliveredQuantity: string }[]) => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  return <div><p>Укажите суммарное количество уже полученных упаковок по каждой позиции. Неполученные позиции оставьте без изменений.</p>{shipment.items.map((item, index) => <DmField key={item.id} label={`Позиция ${index + 1}: отправлено ${item.quantity}, ранее получено ${item.deliveredQuantity}`}><DmInput inputMode="decimal" value={quantities[item.id] ?? item.deliveredQuantity} onChange={(_, d) => setQuantities(current => ({ ...current, [item.id]: d.value.replace(",", ".") }))} /></DmField>)}<DmButton disabled={busy} onClick={() => void onReceive(shipment.items.map(item => ({ shipmentItemId: item.id, deliveredQuantity: quantities[item.id] ?? item.deliveredQuantity })))}>Подтвердить фактическое получение</DmButton></div>;
}
