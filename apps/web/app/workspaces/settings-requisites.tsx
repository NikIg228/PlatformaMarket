"use client";
import Link from "next/link";
import { ArrowRight20Regular } from "@fluentui/react-icons/svg/arrow-right";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarketplaceApiError } from "@marketplace/api-client";
import { organizationRequisitesFieldsSchema, type OrganizationRequisitesFields, type OrganizationRequisitesResponse } from "@marketplace/schemas";
import { DmHeading, DmButton, DmCheckbox, DmDialog, DmFeedback, DmSurface, ErrorState, LoadingState, errorMessage, usePermissions, useSaveToast, useUnsavedChanges } from "@marketplace/ui";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { RequisitesFields, emptyRequisitesDraft, type RequisitesDraft } from "./requisites-fields";
import { RequisitesReview } from "./requisites-review";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

export function SettingsRequisites({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const result = await api.getOrganizationRequisites();
    if (result.organizationId !== organizationId) throw new Error("Реквизиты организации недоступны");
    return result;
  }, [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем реквизиты организации" />;
  return <RequisitesEditor key={organizationId} initial={resource.data} onDirtyChange={onDirtyChange} />;
}

function RequisitesEditor({ initial, onDirtyChange }: { initial: OrganizationRequisitesResponse; onDirtyChange: (dirty: boolean) => void }) {
  const { api, role, organizationId } = useWorkspace(), has = usePermissions(), notify = useSaveToast();
  const [saved, setSaved] = useState(initial), [draft, setDraft] = useState<RequisitesDraft>(initial.current?.fields ?? emptyRequisitesDraft());
  const [editing, setEditing] = useState(!initial.current), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({}), [refreshRequired, setRefreshRequired] = useState(false), [concurrentDraft, setConcurrentDraft] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false), [acknowledged, setAcknowledged] = useState(false), [reviewOpen, setReviewOpen] = useState(false);
  const lock = useRef(false), committed = useRef(false), trigger = useRef<HTMLButtonElement | null>(null), form = useRef<HTMLFormElement | null>(null);
  const saveRetry = useRef<{ fingerprint: string; key: string } | null>(null), confirmRetry = useRef<{ fingerprint: string; key: string } | null>(null);
  const editable = saved.canEdit && has("organization.members.manage");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.current?.fields ?? emptyRequisitesDraft());
  const sourceChanged = saved.readiness.issues.some(issue => issue.code === "SOURCE_CHANGED");
  useUnsavedChanges(editing && dirty || busy);
  useEffect(() => { onDirtyChange(editing && dirty || busy); return () => onDirtyChange(false); }, [editing, dirty, busy, onDirtyChange]);

  async function fresh() {
    const result = await api.getOrganizationRequisites();
    if (result.organizationId !== organizationId) throw new Error("Реквизиты организации недоступны");
    return result;
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setConfirmOpen(false);
    try {
      const result = await fresh();
      if (committed.current) { setDraft(result.current?.fields ?? emptyRequisitesDraft()); setEditing(false); committed.current = false; }
      else if (editing && dirty) setConcurrentDraft(result.version !== saved.version);
      else setDraft(result.current?.fields ?? emptyRequisitesDraft());
      setSaved(result); setRefreshRequired(false); saveRetry.current = null; confirmRetry.current = null;
      notify("Сохранённые данные обновлены");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); lock.current = false; }
  }
  function beginEdit() {
    setDraft(saved.current?.fields ?? emptyRequisitesDraft()); setEditing(true); setErrors({}); setError(null); setConcurrentDraft(false);
  }
  async function save(value: RequisitesDraft | OrganizationRequisitesFields = draft) {
    if (lock.current || !editable || refreshRequired || concurrentDraft) return;
    const parsed = organizationRequisitesFieldsSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), /[а-яё]/i.test(issue.message) ? issue.message : "Заполните поле корректно"])));
      setError("Проверьте отмеченные поля. Введённые данные сохранены в форме.");
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const command = { expectedVersion: saved.version, expectedOrganizationVersion: saved.source.organizationVersion, fields: parsed.data }, fingerprint = JSON.stringify(command);
    if (saveRetry.current?.fingerprint !== fingerprint) saveRetry.current = { fingerprint, key: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError(null); setErrors({});
    try {
      const result = await api.saveOrganizationRequisites({ ...command, idempotencyKey: saveRetry.current.key });
      committed.current = true;
      const latest = await fresh(); setSaved(latest); setDraft(latest.current?.fields ?? emptyRequisitesDraft()); setEditing(false);
      committed.current = false; saveRetry.current = null; confirmRetry.current = null; setAcknowledged(false);
      notify(`Сохранена версия ${result.version}. Проверьте её перед подтверждением.`);
    } catch (cause) {
      setError(committed.current ? "Реквизиты сохранены, но не удалось загрузить результат. Обновите данные." : errorMessage(cause));
      if (committed.current || cause instanceof MarketplaceApiError && cause.status === 409) setRefreshRequired(true);
    } finally { setBusy(false); lock.current = false; }
  }
  async function confirm() {
    if (lock.current || !editable || !acknowledged || !saved.current || !saved.readiness.complete || editing || refreshRequired) return;
    const command = { expectedVersion: saved.version, expectedOrganizationVersion: saved.source.organizationVersion, acknowledged: true as const }, fingerprint = JSON.stringify(command);
    if (confirmRetry.current?.fingerprint !== fingerprint) confirmRetry.current = { fingerprint, key: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError(null);
    try {
      await api.confirmOrganizationRequisites({ ...command, idempotencyKey: confirmRetry.current.key }); committed.current = true;
      const result = await fresh(); setSaved(result); setDraft(result.current?.fields ?? emptyRequisitesDraft());
      committed.current = false; confirmRetry.current = null; setConfirmOpen(false); setAcknowledged(false); notify("Реквизиты подтверждены");
    } catch (cause) {
      setError(committed.current ? "Подтверждение сохранено, но не удалось загрузить результат. Обновите данные." : errorMessage(cause));
      if (committed.current || cause instanceof MarketplaceApiError && cause.status === 409) { setRefreshRequired(true); setConfirmOpen(false); }
    } finally { setBusy(false); lock.current = false; }
  }
  const organizationLink = <Link href={`/${role}/settings`} {...dmLinkButtonProps({ appearance: "secondary" })}>Контакты и адреса организации<ArrowRight20Regular aria-hidden="true" /></Link>;
  const issues = saved.readiness.issues.filter(issue => issue.code !== "UNCONFIRMED");
  const problem = error ? <DmFeedback tone="danger" presentation="note" alert title="Действие не завершено" description={error} action={!confirmOpen ? <DmButton disabled={busy} onClick={() => void reload()}>Обновить сохранённые данные</DmButton> : undefined} /> : null;
  return <div className={`${styles.page} ${layout.page}`}>
    <DmSurface className={styles.card} role="region" aria-label="Реквизиты организации">
      <div className={styles.toolbar}><DmHeading inline title="Реквизиты для документов" description="Общие данные используются в документах вашей организации. Изменения сохраняются новой версией." />{!editing && editable ? <DmButton disabled={busy || refreshRequired} onClick={beginEdit}>Изменить реквизиты</DmButton> : null}</div>
      <div className={layout.stack}>
        {saved.readiness.ready ? <DmFeedback tone="success" presentation="note" title="Реквизиты подтверждены" description={`Версия ${saved.version}. Данные организации актуальны на ${saved.readiness.asOfDate}.`} action={organizationLink} /> : <DmFeedback presentation="note" tone="warning" title={saved.current?.confirmedAt ? "Реквизиты требуют обновления" : "Реквизиты не подтверждены"} description="Заполните недостающие сведения, сохраните и проверьте версию перед подтверждением." details={issues.length ? <ul className={layout.issues}>{issues.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul> : undefined} action={organizationLink} />}
        {!editable ? <DmFeedback presentation="note" tone="info" title="Доступно только для просмотра" description="Изменить и подтвердить реквизиты может сотрудник с правом управления организацией." /> : null}
        {editing && editable ? <form ref={form} noValidate aria-label="Редактирование реквизитов" className={layout.stack} onSubmit={event => { event.preventDefault(); void save(); }}>
          <dl className={layout.summary}><dt>Организация / получатель</dt><dd>{saved.source.legalName}</dd><dt>БИН / ИИН</dt><dd>{saved.source.identifier}</dd><dt>Юридический адрес</dt><dd>{saved.source.legalAddressText ?? "Заполните в настройках организации"}</dd></dl>
          <RequisitesFields value={draft} onChange={setDraft} disabled={busy || refreshRequired || concurrentDraft} errors={errors} supplier={saved.source.requiresPaymentDetails} />
          {concurrentDraft ? <DmFeedback presentation="note" tone="warning" title="Есть более новая сохранённая версия" description="Ваш черновик остался в форме. Сравните версии, затем выберите, какие данные использовать." action={<div className={layout.actions}>
            <DmButton onClick={() => setReviewOpen(true)}>Посмотреть сохранённую версию</DmButton>
            <DmButton onClick={() => { setDraft(saved.current?.fields ?? emptyRequisitesDraft()); setConcurrentDraft(false); setError(null); }}>Загрузить сохранённую версию</DmButton>
            <DmButton onClick={() => setConcurrentDraft(false)}>Продолжить с моим черновиком</DmButton>
          </div>} /> : null}
          <div className={layout.actions}><DmButton appearance="subtle" disabled={busy} onClick={() => { setDraft(saved.current?.fields ?? emptyRequisitesDraft()); setEditing(false); setErrors({}); setError(null); setConcurrentDraft(false); }}>Отмена</DmButton><DmButton appearance="primary" type="submit" disabled={busy || refreshRequired || concurrentDraft || !dirty && !sourceChanged && Boolean(saved.current)}>{busy ? "Сохраняем…" : "Сохранить черновик"}</DmButton></div>
        </form> : saved.current ? <RequisitesReview value={saved.current} /> : <p className={styles.muted}>Реквизиты пока не сохранены.</p>}
        {!confirmOpen ? problem : null}
        {!editing && editable && saved.current ? <div className={layout.actions}>
          {sourceChanged ? <DmButton disabled={busy || refreshRequired} onClick={() => void save(saved.current!.fields)}>Сохранить актуальные данные организации</DmButton> : null}
          {!saved.current.confirmedAt ? <DmButton appearance="primary" disabled={busy || !saved.readiness.complete || refreshRequired} onClick={event => { trigger.current = event.currentTarget; setAcknowledged(false); setError(null); setConfirmOpen(true); }}>Проверить и подтвердить</DmButton> : null}
        </div> : null}
      </div>
    </DmSurface>
    <DmDialog open={confirmOpen} title={`Подтверждение реквизитов · версия ${saved.version}`} onOpenChange={next => { if (!busy) setConfirmOpen(next); }} onClosed={() => trigger.current?.focus()} actions={<><DmButton disabled={busy} onClick={() => setConfirmOpen(false)}>Назад</DmButton><DmButton appearance="primary" disabled={busy || !acknowledged} onClick={() => void confirm()}>{busy ? "Подтверждаем…" : "Подтвердить реквизиты"}</DmButton></>}>
      <div className={layout.stack}>{saved.current ? <RequisitesReview value={saved.current} /> : null}<DmCheckbox disabled={busy} checked={acknowledged} label="Подтверждаю достоверность реквизитов и право действовать от имени организации" onChange={(_, data) => setAcknowledged(data.checked === true)} />{problem}</div>
    </DmDialog>
    <DmDialog open={reviewOpen} title="Сохранённая версия реквизитов" onOpenChange={setReviewOpen} actions={<DmButton onClick={() => setReviewOpen(false)}>Закрыть</DmButton>}>{saved.current ? <RequisitesReview value={saved.current} /> : null}</DmDialog>
  </div>;
}
