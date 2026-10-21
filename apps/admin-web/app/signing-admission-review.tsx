"use client";
import { useEffect, useId, useRef } from "react";
import { DmButton, DmCheckbox, DmFeedback, DmField, DmFileInput, DmHeading, DmSelect, DmSurface, DmTextarea, ErrorState, LoadingState, useUnsavedChanges } from "@marketplace/ui";
import { useSigningAdmissionReview } from "./use-signing-admission-review";
import styles from "./signing-admissions.module.css";

export function SigningAdmissionReview({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useSigningAdmissionReview(id), fileId = useId(), form = useRef<HTMLFormElement>(null);
  const dirty = Boolean(state.note || state.file || state.busy); useUnsavedChanges(dirty);
  useEffect(() => { if (Object.keys(state.validation).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [state.validation]);
  const admission = state.data?.admission, organization = state.data?.organization;
  const basis = admission?.application.basis;
  const evidence = basis?.kind === "LEGAL_ENTITY_HEAD" ? basis.appointment : basis?.registrationNotice;
  return <DmSurface variant="card" className={styles.card} role="region" aria-label="Проверка допуска подписанта">
    <div className={styles.actions}><DmHeading title="Проверка допуска подписанта" level={3} /><DmButton disabled={state.busy} onClick={() => { if (!dirty || window.confirm("Есть несохранённое решение. Вернуться к очереди?")) onClose(); }}>К очереди</DmButton></div>
    {state.loading ? <LoadingState label="Загружаем заявку и организацию" /> : null}
    {state.error ? <ErrorState presentation="inline" description={state.error} action={<DmButton disabled={state.loading || state.busy} onClick={() => void state.refresh()}>Проверить состояние заявки</DmButton>} /> : null}
    {admission && organization ? <>
      <dl className={styles.details}><dt>Организация</dt><dd>{organization.legalName}</dd><dt>{basis?.kind === "INDIVIDUAL_ENTREPRENEUR" ? "ИИН ИП" : "БИН"}</dt><dd>{organization.bin}</dd>
        <dt>Заявитель</dt><dd>{admission.applicant.displayName} · ИИН {admission.applicant.maskedIin}</dd><dt>Основание</dt><dd>{evidence?.description}</dd>
        <dt>Вид допуска</dt><dd>{basis?.kind === "LEGAL_ENTITY_HEAD" ? "Руководитель юридического лица" : "Индивидуальный предприниматель лично"}</dd></dl>
      <div className={styles.actions}><DmButton disabled={state.busy} onClick={() => void state.download(evidence!.document.id)}>Скачать документ основания</DmButton><DmButton disabled={state.busy || state.loading} onClick={() => void state.refresh()}>Обновить заявку</DmButton></div>
      {admission.status === "APPROVED" ? <DmFeedback presentation="inline" tone="success" title="Допуск подтверждён" description={`Решение сохранено ${new Date(admission.reviewedAt).toLocaleString("ru-KZ")}.`} /> : null}
      {admission.status === "REJECTED" || admission.status === "SUPERSEDED" ? <DmFeedback presentation="inline" tone="warning" title={admission.status === "REJECTED" ? "Заявка отклонена" : "Допуск заменён"} description={admission.reason} /> : null}
      {state.uncertain ? <DmFeedback presentation="note" tone="warning" title="Результат решения неизвестен" description="Проверьте состояние этой заявки. Повторная отправка использует тот же документ и ключ решения." /> : null}
      {admission.status === "PENDING_REVIEW" ? <form ref={form} className={styles.stack} noValidate onSubmit={event => { event.preventDefault(); void state.review("APPROVE"); }}>
        <DmField label="Официальный источник проверки"><DmSelect value={state.source} disabled={state.busy || state.uncertain} onChange={(_, value) => state.setSource(value.value as "OFFICIAL_REGISTER" | "OFFICIAL_EXTRACT")}><option value="OFFICIAL_EXTRACT">Официальная выписка</option><option value="OFFICIAL_REGISTER">Официальный реестр</option></DmSelect></DmField>
        <DmField label={{ children: "Документ проверки", htmlFor: fileId }} validationState={state.validation.file ? "error" : "none"} validationMessage={state.validation.file} hint="Для одобрения приложите PDF или DOCX до 10 МБ: выписку или сохранённое подтверждение из официального источника.">
          <DmFileInput id={fileId} aria-invalid={Boolean(state.validation.file)} accept=".pdf,.docx" disabled={state.busy || state.uncertain} onChange={event => state.setFile(event.target.files?.[0] ?? null)} />
        </DmField>
        <DmField label="Комментарий к решению" required validationState={state.validation.note ? "error" : "none"} validationMessage={state.validation.note} hint="Укажите источник и результат проверки. При отказе объясните, что заявителю нужно исправить.">
          <DmTextarea value={state.note} maxLength={1000} disabled={state.busy || state.uncertain} onChange={(_, value) => state.setNote(value.value)} />
        </DmField>
        <DmField validationState={state.validation.checked ? "error" : "none"} validationMessage={state.validation.checked}><DmCheckbox checked={state.checked} disabled={state.busy || state.uncertain} aria-invalid={Boolean(state.validation.checked)} label="Проверены личность заявителя, основание полномочий и актуальный статус организации / ИП" onChange={(_, value) => state.setChecked(Boolean(value.checked))} /></DmField>
        <div className={styles.actions}>{state.uncertain ? <DmButton disabled={state.busy || state.loading} onClick={() => void state.retry()}>Повторить то же решение</DmButton> : <><DmButton type="submit" appearance="primary" disabled={state.busy || state.loading}>Подтвердить допуск</DmButton><DmButton disabled={state.busy || state.loading} onClick={() => void state.review("REJECT")}>Отклонить заявку</DmButton></>}</div>
      </form> : null}
      {state.busy ? <LoadingState label="Выполняем действие с заявкой" /> : null}
    </> : null}
  </DmSurface>;
}
