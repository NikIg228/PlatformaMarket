"use client";
import { useId, useState } from "react";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmFeedback, Section, formatDate, formatMoney } from "./index";
import { parseMoneyInput, moneyInputValue } from "./money";
import type { WorkflowAction } from "./order-workflow-command";

type Shared = { data: OrderWorkflowResponse; busy: boolean; canAct: (action: WorkflowAction["action"]) => boolean; perform: (action: WorkflowAction) => Promise<void> };
const statuses: Record<string, string> = { PENDING: "Ожидает проверки", NEEDS_INFORMATION: "Запрошено уточнение", NOT_RECEIVED: "Проверено — не поступило", DISPUTED: "Спор по переводу", CONFIRMED: "Поступление подтверждено" };

export function PaymentSummaryPanel({ data }: { data: OrderWorkflowResponse }) {
  const summary = data.paymentSummary;
  if (!summary) return null;
  return <Section title="Расчёт оплаты"><dl>
    <dt>Согласованная сумма</dt><dd>{formatMoney(data.order.subtotalAmountMinor, data.order.currency)}</dd>
    <dt>Поставщик подтвердил получение</dt><dd>{formatMoney(summary.confirmedAmountMinor, data.order.currency)}</dd>
    <dt>Осталось оплатить</dt><dd>{formatMoney(summary.remainingAmountMinor, data.order.currency)}</dd>
    <dt>Переплата к возврату</dt><dd>{formatMoney(summary.overpaidAmountMinor, data.order.currency)}</dd>
  </dl><p>Квитанции не входят в полученную сумму до проверки поставщиком. Сборка доступна после полной оплаты. Переплата учитывается отдельно и не переносится на другие заказы.</p>
    {data.paymentReviewConfigured === false ? <DmFeedback tone="warning" title="График проверки оплаты не настроен" description="Уведомление о переводе поступит поставщику. Для напоминаний через 15/30/60 рабочих минут поставщику нужно назначить ответственных и рабочие часы." /> : null}
  </Section>;
}

export function TransferReviewPanel(props: Shared & { supplier: boolean; party: boolean; download: (id: string) => Promise<void> }) {
  const [question, setQuestion] = useState("");
  if (!props.data.claims.length) return null;
  const unsettled = props.data.claims.some(claim => claim.status !== "CONFIRMED");
  return <Section title="Проверка перевода">
    {props.data.claims.map((claim, index) => <TransferReview key={claim.id} {...props} claim={claim} index={index + 1} />)}
    {props.supplier && unsettled ? <><DmField label="Что нужно уточнить по оплате"><DmInput value={question} disabled={props.busy} onChange={(_, d) => setQuestion(d.value)} /></DmField>
      <DmButton disabled={props.busy || !props.canAct("REQUEST_PAYMENT_DETAILS") || question.trim().length < 3} onClick={() => void props.perform({ action: "REQUEST_PAYMENT_DETAILS", comment: question })}>Запросить уточнение</DmButton></> : null}
  </Section>;
}

function TransferReview({ claim, index, busy, supplier, party, canAct, perform, download }: Shared & { claim: OrderWorkflowResponse["claims"][number]; index: number; supplier: boolean; party: boolean; download: (id: string) => Promise<void> }) {
  const [amount, setAmount] = useState(() => moneyInputValue(claim.amountMinor));
  const [acknowledged, setAcknowledged] = useState(false);
  const [nextCheck, setNextCheck] = useState("");
  const [reason, setReason] = useState("");
  const checkId = useId();
  const received = parseMoneyInput(amount);
  const nextDate = nextCheck ? new Date(nextCheck) : null;
  const validNextDate = nextDate && Number.isFinite(nextDate.getTime()) && nextDate.getTime() > Date.now() && nextDate.getTime() <= Date.now() + 7 * 86400000;
  return <article style={{ display: "grid", gap: 12, paddingBlock: 16, borderBottom: "1px solid var(--colorNeutralStroke2)" }}>
    <h3>Перевод {index} · {statuses[claim.status] ?? claim.status}</h3>
    <p>{formatDate(claim.paidAt, true)} · Заявлено {formatMoney(claim.amountMinor, claim.currency)}{claim.status === "CONFIRMED" ? ` · Получено ${formatMoney(claim.receivedAmountMinor ?? claim.amountMinor, claim.currency)}` : ""}</p>
    {claim.comment ? <p>{claim.comment}</p> : null}
    {claim.checkedAt ? <p>Проверено {formatDate(claim.checkedAt, true)}. {claim.nextCheckAt ? `Следующая проверка: ${formatDate(claim.nextCheckAt, true)}.` : ""}</p> : null}
    {claim.supportTicketId ? <p>Обращение в поддержку создано. Поддержка координирует проверку; поступление денег подтверждает поставщик.</p> : null}
    <DmButton appearance="subtle" onClick={() => void download(claim.documentId)}>Скачать квитанцию</DmButton>
    {claim.status !== "CONFIRMED" && party ? <>
      {supplier ? <>
        <DmField label={`Фактически поступило по переводу ${index}, ${claim.currency}`} validationState={amount && !received ? "error" : "none"} validationMessage={amount && !received ? "Укажите положительную сумму с точностью до двух знаков" : undefined}>
          <DmInput inputMode="decimal" value={amount} disabled={busy} onChange={(_, d) => { setAmount(d.value); setAcknowledged(false); }} />
        </DmField>
        <label htmlFor={checkId}><input id={checkId} type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} /> Проверено по счёту поставщика: указанная сумма действительно поступила</label>
        <DmButton disabled={busy || !canAct("CONFIRM_TRANSFER") || !received || !acknowledged} onClick={() => received && void perform({ action: "CONFIRM_TRANSFER", claimId: claim.id, receivedAmountMinor: received })}>Подтвердить фактически полученную сумму</DmButton>
        <DmField label={`Следующая проверка перевода ${index}`} hint="Укажите местные дату и время в пределах семи дней"><DmInput type="datetime-local" value={nextCheck} disabled={busy} onChange={(_, d) => setNextCheck(d.value)} /></DmField>
      </> : null}
      <DmField label={`Комментарий к проверке или спору по переводу ${index}`}><DmInput value={reason} disabled={busy} onChange={(_, d) => setReason(d.value)} /></DmField>
      {supplier ? <DmButton disabled={busy || !canAct("RECORD_TRANSFER_CHECK") || !validNextDate || reason.trim().length < 3} onClick={() => nextDate && void perform({ action: "RECORD_TRANSFER_CHECK", claimId: claim.id, nextCheckAt: nextDate.toISOString(), comment: reason })}>Проверено — деньги не поступили</DmButton> : null}
      {claim.status !== "DISPUTED" ? <DmButton disabled={busy || !canAct("OPEN_PAYMENT_DISPUTE") || reason.trim().length < 3} onClick={() => void perform({ action: "OPEN_PAYMENT_DISPUTE", claimId: claim.id, reason })}>Открыть спор по переводу</DmButton> : null}
    </> : null}
  </article>;
}

export function PaymentReductionPanel({ data, busy, organizationId, canAct, perform }: Shared & { organizationId: string }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const pending = data.reductions?.find(reduction => reduction.status === "PENDING");
  const mayPropose = data.paymentStatus === "UNPAID" && data.status === "AWAITING_PAYMENT" && data.claims.length > 0 && data.claims.every(claim => claim.status === "CONFIRMED") && !pending;
  const names: Record<string, string> = { PENDING: "Ожидает согласия другой стороны", ACCEPTED: "Согласовано", REJECTED: "Отклонено", SUPERSEDED: "Закрыто после полной оплаты" };
  if (!mayPropose && !data.reductions?.length) return null;
  return <Section title="Согласование уменьшения заказа">
    <p>После подтверждённой недоплаты можно уменьшить количества. Изменение вступит в силу только после согласия второй стороны. Прежний счёт останется в истории, поставщик выставит новый.</p>
    {data.reductions?.map(reduction => <article key={reduction.id}>
      <h3>{names[reduction.status]}</h3><p>{formatMoney(reduction.previousAmountMinor, data.order.currency)} → {formatMoney(reduction.proposedAmountMinor, data.order.currency)} · {reduction.reason}</p>
      <ul>{reduction.items.map(line => <li key={line.itemId}>{data.order.items.find(item => item.id === line.itemId)?.offer?.productVariant.product.canonicalName ?? "Товар"}: {line.previousQuantity} → {line.acceptedQuantity}; {formatMoney(line.totalPriceMinor, data.order.currency)}</li>)}</ul>
      {reduction.status === "PENDING" && reduction.proposedByOrganizationId !== organizationId ? <>
        <label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} /> Согласен с новым составом и суммой</label>
        <DmButton disabled={busy || !canAct("DECIDE_PAYMENT_REDUCTION") || !acknowledged} onClick={() => void perform({ action: "DECIDE_PAYMENT_REDUCTION", reductionId: reduction.id, accepted: true })}>Принять уменьшение</DmButton>
        <DmButton disabled={busy || !canAct("DECIDE_PAYMENT_REDUCTION")} onClick={() => void perform({ action: "DECIDE_PAYMENT_REDUCTION", reductionId: reduction.id, accepted: false })}>Отклонить уменьшение</DmButton>
      </> : null}
    </article>)}
    {mayPropose ? <>
      {data.order.items.map((item, index) => <DmField key={item.id} label={`${item.offer?.productVariant.product.canonicalName ?? `Позиция ${index + 1}`}: новое количество (сейчас ${item.acceptedQuantity})`}><DmInput inputMode="decimal" disabled={busy} value={quantities[item.id] ?? item.acceptedQuantity ?? "0"} onChange={(_, d) => setQuantities(current => ({ ...current, [item.id]: d.value.replace(",", ".") }))} /></DmField>)}
      <DmField label="Причина уменьшения заказа"><DmInput disabled={busy} value={reason} onChange={(_, d) => setReason(d.value)} /></DmField>
      <DmButton disabled={busy || !canAct("PROPOSE_PAYMENT_REDUCTION") || reason.trim().length < 3} onClick={() => void perform({ action: "PROPOSE_PAYMENT_REDUCTION", reason, items: data.order.items.map(item => ({ itemId: item.id, acceptedQuantity: quantities[item.id] ?? item.acceptedQuantity ?? "0" })) })}>Предложить уменьшение</DmButton>
    </> : null}
  </Section>;
}
