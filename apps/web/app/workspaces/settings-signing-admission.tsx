"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { DmButton, DmFeedback, DmField, DmFileInput, DmHeading, DmSurface, DmTextarea, ErrorState, LoadingState, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import { useWorkspace } from "./workspace";
import { useSigningAdmission } from "./use-signing-admission";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

export function SettingsSigningAdmission({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const state = useSigningAdmission(), { role } = useWorkspace(), has = usePermissions();
  const fileId = useId(), form = useRef<HTMLFormElement>(null);
  const dirty = Boolean(state.file || state.description || state.busy);
  useUnsavedChanges(dirty);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { if (Object.keys(state.validation).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [state.validation]);
  const data = state.data, admission = data?.admission;
  const ip = data?.requisites.current?.fields.legalForm === "INDIVIDUAL_ENTREPRENEUR";
  const verified = data?.identity.status === "VERIFIED";
  const requisitesReady = Boolean(data?.requisites.current?.confirmedAt && data.requisites.current.fields.legalForm && !data.requisites.readiness.issues.some(issue => issue.code === "SOURCE_CHANGED"));
  const canApply = verified && requisitesReady && (!admission || admission.status === "REJECTED");
  return <DmSurface variant="card" className={`${styles.card} ${layout.page} ${layout.stack}`} role="region" aria-label="Допуск подписанта">
    <DmHeading title="Допуск подписанта" level={2} />
    <p>Руководитель организации или ИП подаёт основание своих полномочий. Оператор проверяет документы и связь с организацией.</p>
    {state.loading ? <LoadingState label="Загружаем состояние допуска" /> : null}
    {state.error ? <ErrorState presentation="inline" title="Не удалось завершить действие" description={state.error} action={<DmButton disabled={state.busy || state.loading} onClick={() => void state.refresh()}>Проверить состояние заявки</DmButton>} /> : null}
    {data ? <>
      <dl className={layout.summary}><dt>Организация</dt><dd>{data.requisites.source.legalName}</dd><dt>Подписант</dt><dd>{ip ? "Индивидуальный предприниматель лично" : "Руководитель юридического лица"}</dd>
        {data.identity.status === "VERIFIED" ? <><dt>Подтверждённый ИИН</dt><dd>{data.identity.maskedIin}</dd></> : null}</dl>
      {!verified ? <DmFeedback presentation="note" tone="warning" title="Сначала подтвердите личность" description="Используйте свою ЭЦП в личном профиле." action={<Link href={`/${role}/profile`} {...dmLinkButtonProps()}>Открыть профиль</Link>} /> : null}
      {!requisitesReady ? <DmFeedback presentation="note" tone="warning" title="Нужны подтверждённые реквизиты" description="Проверьте юридическую форму и актуальность реквизитов организации." action={<Link href={`/${role}/settings?tab=requisites`} {...dmLinkButtonProps()}>Открыть реквизиты</Link>} /> : null}
      {admission?.status === "PENDING_REVIEW" ? <DmFeedback presentation="inline" tone="info" title="Заявка на проверке" description="Основание получено. Можно закрыть страницу и вернуться позже. Повторная заявка не требуется." /> : null}
      {admission?.status === "APPROVED" ? <DmFeedback presentation="inline" tone="success" title="Первичный допуск подтверждён" description="Оператор подтвердил ваши полномочия руководителя или ИП. Для смены подписанта обратитесь в поддержку." /> : null}
      {admission?.status === "REJECTED" ? <DmFeedback presentation="inline" tone="warning" title="Заявка отклонена" description={`${admission.reason} Исправьте основание и отправьте новую заявку.`} /> : null}
      {admission?.status === "SUPERSEDED" ? <DmFeedback presentation="note" tone="warning" title="Допуск заменён" description="Для уточнения полномочий обратитесь в поддержку." /> : null}
      {state.uncertain ? <DmFeedback presentation="note" tone="warning" title="Результат отправки неизвестен" description="Сначала проверьте состояние заявки. Если она ещё не появилась, повторите отправку — документ и ключ запроса будут сохранены." /> : null}
      {canApply ? <form ref={form} className={layout.form} noValidate onSubmit={event => { event.preventDefault(); void state.submit(); }}>
        <DmField label="Основание полномочий" required validationState={state.validation.description ? "error" : "none"} validationMessage={state.validation.description}
          hint={ip ? "Уведомление о начале деятельности ИП с подтверждением приёма." : "Документ о назначении руководителем: название, номер и дата."}>
          <DmTextarea value={state.description} maxLength={1000} disabled={state.busy || state.uncertain} onChange={(_, value) => state.setDescription(value.value)} />
        </DmField>
        <DmField label={{ children: "Документ основания", htmlFor: fileId }} required validationState={state.validation.file ? "error" : "none"} validationMessage={state.validation.file} hint="PDF или DOCX, до 10 МБ. Файл будет сохранён в архиве организации.">
          <DmFileInput id={fileId} aria-invalid={Boolean(state.validation.file)} disabled={state.busy || state.uncertain || !has("document.upload")} accept=".pdf,.docx" onChange={event => state.setFile(event.target.files?.[0] ?? null)} />
        </DmField>
        {!has("document.upload") ? <DmFeedback presentation="note" tone="warning" title="Нужно право загрузки документов" description="Попросите администратора организации предоставить доступ к загрузке документов, чтобы приложить основание." /> : null}
        <div className={layout.actions}><DmButton type="submit" appearance="primary" disabled={state.busy || state.loading || !has("document.upload")}>{state.uncertain ? "Повторить отправку заявки" : "Отправить на проверку"}</DmButton></div>
      </form> : null}
      {state.busy ? <LoadingState label="Сохраняем документ и заявку" /> : null}
      <div className={layout.actions}><DmButton disabled={state.busy || state.loading} onClick={() => void state.refresh()}>Обновить статус</DmButton><Link href={`/${role}/support`} {...dmLinkButtonProps()}>Обратиться в поддержку</Link></div>
    </> : null}
  </DmSurface>;
}
