"use client";
import { DmSelect, DmFileInput, DmCheckbox } from "./controls";
import { useId, useRef, useState } from "react";
import type { OrderReturn, OrderWorkflowResponse, UploadDocumentInput } from "@marketplace/schemas";
import type { WorkflowAction } from "./order-workflow-command";
import { DmButton, DmFeedback, DmField, DmInput, Section, formatMoney } from "./index";
import { documentUploadFileError } from "./document-upload-model";

type Props = { data: OrderWorkflowResponse; organizationId: string; busy: boolean; canAct: (action: WorkflowAction["action"]) => boolean;
  perform: (action: WorkflowAction) => Promise<void>; download: (id: string) => Promise<void>;
  api: { uploadDocument: (input: UploadDocumentInput) => Promise<{ id: string }> } };
const statusLabels: Record<OrderReturn["status"], string> = { REQUESTED: "Ожидает решения поставщика", REJECTED: "Отклонён", AGREED: "Согласован", GOODS_SENT: "Товар отправлен обратно", GOODS_RECEIVED: "Поставщик получил товар", REFUND_SENT: "Деньги отправлены — ожидается подтверждение клиники", REFUND_RECEIVED: "Клиника подтвердила получение денег" };
const kindLabels = { CANCELLATION: "Отмена после оплаты", GOODS: "Возврат товара", OVERPAYMENT: "Возврат переплаты" };

export function OrderReturnPanel(props: Props) {
  const { data, organizationId, busy, canAct, perform } = props;
  const buyer = organizationId === data.order.buyerOrganizationId;
  const [kind, setKind] = useState<OrderReturn["kind"]>("CANCELLATION");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const kindId = useId();
  const open = data.returns?.some(value => !["REJECTED", "REFUND_RECEIVED"].includes(value.status));
  const items = data.order.items.filter(item => quantities[item.id]?.trim() && quantities[item.id].trim() !== "0").map(item => ({ orderItemId: item.id, quantity: quantities[item.id].replace(",", "."), condition: conditions[item.id] ?? "" }));
  const invalidLines = kind === "GOODS" && (!items.length || items.some(item => !/^(?:[1-9]\d{0,11}(?:\.\d{1,6})?|0\.\d{1,6})$/.test(item.quantity) || !/[1-9]/.test(item.quantity) || item.condition.trim().length < 3));
  return <Section title="Отмена и возвраты">
    <p>Согласование, отправка и получение денег фиксируются отдельно. Перевод выполняется поставщиком в банке; площадка не отправляет деньги.</p>
    {data.returns?.length ? data.returns.map(value => <ReturnCard key={value.id} {...props} value={value} />) : <p>Обращений по возврату пока нет.</p>}
    {buyer && !open && data.paymentSummary && data.paymentSummary.confirmedAmountMinor !== "0" && data.paymentStatus !== "REFUNDED" ? <div style={{ display: "grid", gap: "var(--dm-space-3)" }}>
      <DmField label={{ htmlFor: kindId, children: "Причина обращения" }}><DmSelect id={kindId} disabled={busy} value={kind} onChange={event => setKind(event.target.value as OrderReturn["kind"])}>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
      <p>{kind === "CANCELLATION" ? "До отправки поставщик должен подтвердить остановку всего заказа. После отправки выберите возврат товара." : kind === "GOODS" ? "Укажите количество и состояние возвращаемых позиций. Поставщик согласует эти сведения и сумму по ценам заказа." : "Сумма определяется остатком подтверждённой переплаты с учётом предыдущих возвратов."}</p>
      {kind === "GOODS" ? data.order.items.map((item, index) => <div key={item.id}><p>{item.offer?.productVariant.product.canonicalName ?? `Позиция ${index + 1}`} · согласовано {item.acceptedQuantity}</p>
        <DmField label={`Количество возврата, позиция ${index + 1}`}><DmInput disabled={busy} inputMode="decimal" value={quantities[item.id] ?? ""} onChange={(_, value) => setQuantities(current => ({ ...current, [item.id]: value.value }))} /></DmField>
        <DmField label={`Состояние товара, позиция ${index + 1}`}><DmInput disabled={busy} value={conditions[item.id] ?? ""} onChange={(_, value) => setConditions(current => ({ ...current, [item.id]: value.value }))} /></DmField>
      </div>) : null}
      <DmField label="Причина и комментарий к возврату"><DmInput disabled={busy} value={reason} onChange={(_, value) => setReason(value.value)} /></DmField>
      {invalidLines ? <p>Для каждой выбранной позиции укажите положительное количество и состояние товара (не менее 3 символов).</p> : null}
      <DmButton disabled={busy || !canAct("REQUEST_RETURN") || reason.trim().length < 3 || invalidLines} onClick={() => void perform({ action: "REQUEST_RETURN", kind, reason, items: kind === "GOODS" ? items : [] })}>Отправить заявку на возврат</DmButton>
    </div> : null}
  </Section>;
}

function ReturnCard(props: Props & { value: OrderReturn }) {
  const { value, data, busy, canAct, perform, organizationId } = props;
  const buyer = organizationId === data.order.buyerOrganizationId;
  const supplier = organizationId === data.order.supplierOrganizationId;
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = useRef<{ file: File; id: string } | null>(null);
  const fileId = useId();
  const lock = useRef(false);
  const hasRefundAction = supplier && value.status === (value.kind === "GOODS" ? "GOODS_RECEIVED" : "AGREED");
  const send = async () => {
    if (!file || busy || lock.current || !canAct("SEND_MANUAL_REFUND")) return;
    const invalid = documentUploadFileError(file);
    if (invalid || !file.name.toLowerCase().endsWith(".pdf")) { setError(invalid ?? "Выберите PDF."); return; }
    lock.current = true; setUploading(true); setError("");
    try {
      if (upload.current?.file !== file) {
        const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.readAsDataURL(file); });
        const document = await props.api.uploadDocument({ ownerOrganizationId: organizationId, supplierOrderId: data.orderId, kind: "PAYMENT_PROOF", format: "PDF", title: "Подтверждение отправки возврата", documentNumber: `RETURN-${value.id}`, amountMinor: value.amountMinor, currency: value.currency, fileName: file.name, contentBase64, requiredSignatureCount: 0 });
        upload.current = { file, id: document.id };
      }
      await perform({ action: "SEND_MANUAL_REFUND", returnId: value.id, documentId: upload.current.id });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось загрузить квитанцию. Повторите отправку."); }
    finally { lock.current = false; setUploading(false); }
  };
  return <article style={{ borderBottom: "1px solid var(--colorNeutralStroke2)", paddingBottom: "var(--dm-space-4)", marginBottom: "var(--dm-space-4)" }}>
    <h3>{kindLabels[value.kind]} · {formatMoney(value.amountMinor, value.currency)}</h3><p>{statusLabels[value.status]}</p><p>{value.reason}</p>
    {value.items.map(line => <p key={line.orderItemId}>{data.order.items.find(item => item.id === line.orderItemId)?.offer?.productVariant.product.canonicalName ?? "Товар"}: {line.quantity} · {line.condition}</p>)}
    {value.decisionReason ? <p>Решение поставщика: {value.decisionReason}</p> : null}
    {value.refundDocumentId ? <DmButton appearance="subtle" onClick={() => void props.download(value.refundDocumentId!)}>Скачать квитанцию возврата</DmButton> : null}
    {error ? <DmFeedback tone="danger" title="Квитанция не отправлена" description={error} /> : null}
    {supplier && value.status === "REQUESTED" ? <><DmField label="Комментарий к решению о возврате"><DmInput value={reason} disabled={busy} onChange={(_, field) => setReason(field.value)} /></DmField>
      <DmButton disabled={busy || !canAct("DECIDE_RETURN") || reason.trim().length < 3} onClick={() => void perform({ action: "DECIDE_RETURN", returnId: value.id, accepted: true, reason })}>{value.kind === "CANCELLATION" ? "Подтвердить остановку заказа и возврат" : "Согласовать указанные условия и сумму"}</DmButton>
      <DmButton disabled={busy || !canAct("DECIDE_RETURN") || reason.trim().length < 3} onClick={() => void perform({ action: "DECIDE_RETURN", returnId: value.id, accepted: false, reason })}>Отклонить заявку</DmButton></> : null}
    {buyer && value.kind === "GOODS" && value.status === "AGREED" ? <DmButton disabled={busy || !canAct("SEND_RETURN_GOODS")} onClick={() => void perform({ action: "SEND_RETURN_GOODS", returnId: value.id })}>Подтвердить отправку товара обратно</DmButton> : null}
    {supplier && value.status === "GOODS_SENT" ? <><p>Подтверждайте получение только при совпадении количества и состояния с согласованным. При расхождении обратитесь в поддержку. Товар не возвращается в продажу автоматически.</p><DmButton disabled={busy || !canAct("RECEIVE_RETURN_GOODS")} onClick={() => void perform({ action: "RECEIVE_RETURN_GOODS", returnId: value.id })}>Подтвердить получение согласованного товара</DmButton></> : null}
    {hasRefundAction ? <><DmField label={{ htmlFor: fileId, children: "Квитанция возврата, PDF до 10 МБ" }}><DmFileInput id={fileId}  accept=".pdf,application/pdf" disabled={busy || uploading} onChange={event => { setFile(event.target.files?.[0] ?? null); upload.current = null; }} /></DmField><DmButton disabled={busy || uploading || !file || !canAct("SEND_MANUAL_REFUND")} onClick={() => void send()}>Приложить квитанцию отправленного возврата</DmButton></> : null}
    {buyer && value.status === "REFUND_SENT" ? <><DmCheckbox checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} label="Деньги в указанной сумме поступили на счёт клиники" /><DmButton disabled={busy || !confirmed || !canAct("RECEIVE_MANUAL_REFUND")} onClick={() => void perform({ action: "RECEIVE_MANUAL_REFUND", returnId: value.id })}>Подтвердить получение возврата</DmButton></> : null}
  </article>;
}
