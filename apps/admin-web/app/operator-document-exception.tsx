"use client";
import { useEffect, useRef, useState } from "react";
import { adminSectionQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmDialog, DmFeedback, DmField, DmSurface, DmTable, DmTextarea, LoadingState, StatusTag, formatDate } from "@marketplace/ui";
import { useAdminQuery } from "./use-admin-query";
import { useOperatorException } from "./use-operator-exception";
import { orderHref, orderNavigate } from "./operator-order-navigation";
import { orderStatusLabel } from "./operator-order-labels";
import { DocumentDialog as OperatorDocumentDialog } from "./operator-order-documents";
import styles from "./operator-orders.module.css";

const events: Record<string, string> = { SUBMIT: "Клиника отправила заявление", RESPOND: "Поставщик ответил", DECIDE: "Клиника рассмотрела предложение", DISPATCH_RESUPPLY: "Поставщик отправил допоставку", OPERATOR_REVIEW: "Рекомендация оператора для обеих сторон" };
export function OperatorDocumentException({ id }: { id: string }) {
  const { state, write } = useAdminQuery(), resource = useOperatorException(id), { data } = resource;
  const [reason, setReason] = useState(""), [nextStep, setNextStep] = useState(""), [confirm, setConfirm] = useState(false), [documentOpen, setDocumentOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement>(null), documentTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { heading.current?.focus(); }, [id]);
  const disabled = resource.busy || resource.loading || resource.uncertain || resource.conflict || resource.applied;
  const orderTarget: AdminQuery = { ...adminSectionQuery(state, "orders"), orderId: data?.order.id };
  const publish = async (retry = false) => {
    if (!data && !retry) return;
    setConfirm(false);
    const saved = await resource.publish(retry ? undefined : { expectedOrderVersion: data!.order.version, expectedShipmentVersion: data!.shipment.version,
      expectedExceptionVersion: data!.version, idempotencyKey: crypto.randomUUID(), reason: reason.trim(), nextStep: nextStep.trim() });
    if (saved) { setReason(""); setNextStep(""); }
  };
  return <section className={styles.section} aria-label="Документальное расхождение" aria-busy={resource.loading || resource.busy}>
    <div className={styles.header}><h2 ref={heading} tabIndex={-1}>Документальное расхождение{data ? ` · ${data.order.number}` : ""}</h2><DmButton disabled={resource.busy || resource.loading} onClick={() => void resource.refresh()}>Обновить расхождение</DmButton></div>
    {resource.error ? <DmFeedback presentation="inline" tone="danger" title="Не удалось завершить действие" description={resource.error} /> : null}
    {resource.notice ? <DmFeedback presentation="inline" tone="success" title="Рекомендация опубликована" description={resource.notice} /> : null}
    {resource.loading && !data ? <LoadingState label="Открываем документальное расхождение" /> : null}
    {!data && !resource.loading ? <DmButton onClick={() => void resource.refresh()}>Повторить загрузку расхождения</DmButton> : null}
    {resource.uncertain ? <DmSurface variant="section" className={styles.section}><p>Результат запроса неизвестен. Введённая рекомендация сохранена; повтор отправит ту же команду.</p><p>{reason}</p><p>Следующий шаг: {nextStep}</p><DmButton disabled={resource.busy || resource.loading} onClick={() => void publish(true)}>Повторить публикацию</DmButton></DmSurface> : null}
    {resource.conflict ? <DmSurface variant="section" className={styles.section}><p>Стороны или другой оператор изменили данные. Обновите расхождение и сравните историю. Ваш текст сохранён.</p>{resource.reviewReady ? <DmButton disabled={resource.busy || resource.loading} onClick={resource.reviewed}>Данные проверены, продолжить</DmButton> : null}</DmSurface> : null}
    {data ? <>
      <DmSurface variant="section" className={styles.section}>
        <div className={styles.tags}><StatusTag>{orderStatusLabel(data.status)}</StatusTag><StatusTag tone={data.reviewStatus === "REVIEWED" ? "success" : "warning"}>{data.reviewStatus === "REVIEWED" ? "Редакция рассмотрена оператором" : "Требует рекомендации оператора"}</StatusTag></div>
        <dl className={styles.details}><div><dt>Клиника</dt><dd>{data.buyer.name}</dd></div><div><dt>Поставщик</dt><dd>{data.supplier.name}</dd></div><div><dt>Партия</dt><dd>{data.shipment.number} · {orderStatusLabel(data.shipment.status)}</dd></div><div><dt>Редакция заявления</dt><dd>{data.version}</dd></div></dl>
        <p>{data.reason}</p><p>Решение сторон: {orderStatusLabel(data.resolution ?? "NOT_SELECTED")}.</p>
        <p>Рекомендация оператора не подтверждает получение товара, оплату, подпись или документальное урегулирование. Новый ответ стороны возвращает случай в очередь.</p>
        <div className={styles.actions}><DmButton as="a" href={orderHref(orderTarget)} onClick={event => orderNavigate(event, orderTarget, write)}>Открыть заказ {data.order.number}</DmButton>
          {data.sourceDocument ? <DmButton ref={documentTrigger} onClick={() => setDocumentOpen(true)}>Открыть исходную накладную · редакция {data.sourceDocument.version}</DmButton> : null}</div>
        {!data.canViewDocuments ? <p>Для просмотра исходного документа требуется право доступа к документам.</p> : !data.sourceDocument ? <p>Исходная накладная не указана в заявлении.</p> : null}
      </DmSurface>
      <DmSurface variant="section" className={styles.section}><h3>Количество в исходной партии</h3><DmTable caption="Сравнение количеств по расхождению" columns={[{ key: "item", label: "Позиция" }, { key: "sent", label: "Отправлено" }, { key: "reported", label: "Заявлено полученным" }, { key: "damaged", label: "Повреждено" }, { key: "received", label: "Зафиксировано полученным" }]}>{data.lines.map(line => <tr key={line.id}><td data-label="Позиция">{line.name} · {line.uom}</td><td data-label="Отправлено">{line.sentQuantity}</td><td data-label="Заявлено полученным">{line.reportedQuantity}</td><td data-label="Повреждено">{line.damagedQuantity}</td><td data-label="Зафиксировано полученным">{line.receivedQuantity}</td></tr>)}</DmTable></DmSurface>
      <DmSurface variant="section" className={styles.section}><h3>История расхождения</h3>{data.events.length ? <ol className={styles.timeline}>{data.events.map(event => <li key={event.id}><strong>{events[event.action] ?? "Обновление расхождения"}</strong><p>{formatDate(event.at, true)} · редакция {event.version}</p>{event.reason ? <p>{event.reason}</p> : null}{event.nextStep ? <p>Следующий шаг: {event.nextStep}</p> : null}{event.decision ? <p>{event.decision === "AGREE" ? "Предложение согласовано" : event.decision === "REJECT" ? "Предложение отклонено" : "Встречное предложение"}</p> : null}{event.accepted !== null ? <p>{event.accepted ? "Клиника согласна" : "Клиника не согласна"}</p> : null}</li>)}</ol> : <p>Публичных событий пока нет.</p>}</DmSurface>
      {data.canPublish && !resource.applied ? <DmSurface variant="section" className={styles.section}><h3>Публичная рекомендация</h3><p>Рекомендацию и следующий шаг увидят клиника и поставщик.</p><form className={styles.section} onSubmit={event => { event.preventDefault(); if (!disabled && reason.trim().length >= 10 && nextStep.trim().length >= 3) setConfirm(true); }}>
        <DmField label="Рекомендация оператора" required hint="Не менее 10 символов. Укажите результат проверки."><DmTextarea value={reason} maxLength={3000} disabled={disabled} onChange={(_, d) => setReason(d.value)} /></DmField>
        <DmField label="Следующий шаг для сторон" required hint="Укажите, кому и что нужно сделать."><DmTextarea value={nextStep} maxLength={1000} disabled={disabled} onChange={(_, d) => setNextStep(d.value)} /></DmField>
        <div><DmButton ref={trigger} appearance="primary" type="submit" disabled={disabled || reason.trim().length < 10 || nextStep.trim().length < 3}>Опубликовать рекомендацию</DmButton></div>
      </form></DmSurface> : data.reviewStatus === "REVIEWED" || resource.applied ? <p>Операторская обработка этой редакции завершена. Документальное расхождение сохраняет свой статус.</p> : <p>Для публикации рекомендации требуется право управления обращениями.</p>}
      <DmSurface variant="section" className={styles.section}><h3>Связанные обращения</h3>{!data.canViewSupport ? <p>Для просмотра обращений требуется право доступа к поддержке.</p> : !data.tickets.length ? <p>Связанных обращений нет.</p> : data.tickets.map(ticket => {
        const target = { ...adminSectionQuery(state, "support"), ticketId: ticket.id };
        return <div key={ticket.id} className={styles.header}><p>{ticket.number} · {ticket.subject} · {orderStatusLabel(ticket.status)}</p><DmButton as="a" href={orderHref(target)} onClick={event => orderNavigate(event, target, write)}>Открыть обращение {ticket.number}</DmButton></div>;
      })}</DmSurface>
    </> : null}
    <div><DmButton disabled={resource.busy} onClick={() => write(adminSectionQuery(state, "overview"))}>Вернуться к очереди</DmButton></div>
    <DmDialog open={confirm} title="Публикация рекомендации" onOpenChange={setConfirm} onClosed={() => { if (trigger.current && !trigger.current.disabled) trigger.current.focus(); else heading.current?.focus(); }} actions={<><DmButton onClick={() => setConfirm(false)}>Отмена</DmButton><DmButton appearance="primary" disabled={resource.busy} onClick={() => void publish()}>Подтвердить публикацию</DmButton></>}>
      <div className={styles.section}><p>Текст будет виден клинике и поставщику. Случай исчезнет из очереди до нового ответа стороны; само расхождение не закрывается.</p><p>{reason}</p><p>Следующий шаг: {nextStep}</p></div>
    </DmDialog>
    {documentOpen && data?.sourceDocument ? <OperatorDocumentDialog id={data.sourceDocument.id} orderId={data.order.id} close={() => { setDocumentOpen(false); documentTrigger.current?.focus(); }} /> : null}
  </section>;
}
