"use client";
import Link from "next/link";
import { ArrowRight20Regular } from "@fluentui/react-icons/svg/arrow-right";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupplierVatSettings } from "@marketplace/schemas";
import { DmHeading, DmButton, DmCheckbox, DmFeedback, DmSurface, ErrorState, LoadingState, errorMessage, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import { VatFields, parseVatDraft, vatDraft } from "../../../supplier-web/app/features/supplier-workspace/vat-fields";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";
import { SettingsIntegrationTax } from "./settings-integration-tax";

export function SettingsVat({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(() => api.getSupplierVatSettings(organizationId), [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем настройки НДС" />;
  return <VatSettingsEditor key={organizationId} initial={resource.data} onDirtyChange={onDirtyChange} />;
}
function VatSettingsEditor({ initial, onDirtyChange }: { initial: SupplierVatSettings; onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace(), has = usePermissions();
  const [saved, setSaved] = useState(initial), [enabled, setEnabled] = useState(Boolean(initial.defaultTax));
  const [draft, setDraft] = useState(() => vatDraft(initial.defaultTax?.selection)), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [conflict, setConflict] = useState(false);
  const lock = useRef(false), retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const [integrationDirty, setIntegrationDirty] = useState(false);
  const dirty = integrationDirty || enabled !== Boolean(saved.defaultTax) || (enabled && JSON.stringify(draft) !== JSON.stringify(vatDraft(saved.defaultTax?.selection)));
  const editable = saved.canEdit && has("pricing.manage");
  useUnsavedChanges(dirty);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const refresh = async () => {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { setSaved(await api.getSupplierVatSettings(organizationId)); setConflict(false); setAcknowledged(false); setError(""); retry.current = null; }
    catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (lock.current || !editable || conflict) return;
    setError(""); setNotice("");
    const parsed = parseVatDraft(draft);
    if (enabled && !parsed.success) { setError("Выберите налоговый режим, действующую ставку и основание, если оно требуется."); return; }
    if (!acknowledged) { setError("Подтвердите условия применения настройки."); return; }
    lock.current = true; setBusy(true);
    try {
      const body = { expectedVersion: saved.version, expectedRequisitesVersion: saved.profile?.version ?? null, selection: enabled && parsed.success ? parsed.data : null, acknowledged: true as const };
      const fingerprint = JSON.stringify(body);
      if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
      const result = await api.saveSupplierVatSettings(organizationId, { ...body, idempotencyKey: retry.current.key });
      setSaved(result); setDraft(vatDraft(result.defaultTax?.selection)); setEnabled(Boolean(result.defaultTax)); setAcknowledged(false); retry.current = null;
      setNotice("Настройка сохранена. Условия существующих предложений не изменены.");
    } catch (cause) { setError(errorMessage(cause)); if (cause && typeof cause === "object" && "status" in cause && cause.status === 409) setConflict(true); }
    finally { lock.current = false; setBusy(false); }
  };
  const requisitesLink = <Link {...dmLinkButtonProps({ appearance: "secondary" })} href="/supplier/settings?tab=requisites">Реквизиты и налоговый статус<ArrowRight20Regular aria-hidden="true" /></Link>;
  return <div className={`${styles.page} ${layout.page}`}><DmSurface className={styles.card}>
    <div className={styles.toolbar}><DmHeading inline title="НДС для новых предложений" description="Выберите условия для ваших новых товаров. Исключения можно указать в предложении или строке импорта. Для существующих товаров используйте массовое изменение в списке товаров." />{!saved.profileIssue && !saved.defaultIssue ? requisitesLink : null}</div>
    <form className={layout.form} onSubmit={event => { event.preventDefault(); void save(); }}>
      {!editable ? <DmFeedback presentation="note" tone="warning" title="Настройка доступна для просмотра" description="Для изменения нужно право на управление ценами." /> : null}
      {saved.profileIssue ? <DmFeedback presentation="note" tone="warning" title="Проверьте реквизиты" description={saved.profileIssue} action={requisitesLink} /> : null}
      {saved.defaultIssue ? <DmFeedback presentation="note" tone="warning" title="Подтвердите настройку заново" description={saved.defaultIssue} action={!saved.profileIssue ? requisitesLink : undefined} /> : null}
      <DmCheckbox label="Подставлять налоговый режим для новых предложений" checked={enabled} disabled={busy || !editable} onChange={(_, data) => { setEnabled(data.checked === true); setAcknowledged(false); }} />
      {enabled ? <VatFields value={draft} onChange={value => { setDraft(value); setAcknowledged(false); }} date={saved.date} profile={saved.profile} disabled={busy || !editable || !saved.profile || Boolean(saved.profileIssue)} /> : <p>Для каждого нового предложения налоговые условия нужно выбрать отдельно.</p>}
      <DmCheckbox label="Подтверждаю настройку только для новых предложений и ответственность за применимость режима" checked={acknowledged} disabled={busy || !editable} onChange={(_, data) => setAcknowledged(data.checked === true)} />
      {error ? <ErrorState description={error} /> : null}{notice ? <DmFeedback tone="success" title="Сохранено" description={notice} /> : null}
      {conflict ? <p role="alert">Настройки или реквизиты изменились. Обновите данные и проверьте сохранённый ввод.</p> : null}
      <div className={layout.actions}>{error || conflict ? <DmButton type="button" disabled={busy} onClick={() => void refresh()}>Повторить загрузку</DmButton> : null}<DmButton type="submit" appearance="primary" disabled={busy || !editable || conflict || (enabled && (!saved.profile || Boolean(saved.profileIssue)))}>{busy ? "Сохраняем…" : "Сохранить настройку НДС"}</DmButton></div>
    </form>
  </DmSurface>{has("integration.view") ? <SettingsIntegrationTax onDirtyChange={setIntegrationDirty} /> : null}</div>;
}
