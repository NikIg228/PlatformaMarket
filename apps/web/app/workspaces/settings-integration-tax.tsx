"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { vatLabel, type IntegrationTaxBinding, type SupplierVatSettings } from "@marketplace/schemas";
import { DmButton, DmCheckbox, DmDropdown, DmFeedback, DmField, DmInput, DmSurface, ErrorState, LoadingState, errorMessage, usePermissions } from "@marketplace/ui";
import { VatFields, parseVatDraft, vatDraft } from "../../../supplier-web/app/features/supplier-workspace/vat-fields";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

export function SettingsIntegrationTax({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(() => api.listIntegrationTaxBindings(organizationId), [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  const [selected, setSelected] = useState("");
  const binding = resource.data?.find(item => item.id === selected);
  return <DmSurface className={styles.card}>
    <h2>НДС в подключённых ERP</h2>
    <p>Укажите формат входящей цены. Новые настройки применяются при следующей синхронизации; существующие цены сейчас не меняются.</p>
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку источников</DmButton>} /> : null}
    {!resource.data && resource.loading ? <LoadingState label="Загружаем источники цен" /> : null}
    {resource.data?.length === 0 ? <p>Подключённых источников цен пока нет.</p> : null}
    {!binding && resource.data?.length ? <DmField className={layout.field} label="Источник цен"><DmDropdown value={selected} onChange={(_, data) => setSelected(data.value)}><option value="">Выберите подключённый источник</option>{resource.data.map(item => <option key={item.id} value={item.id}>{item.connectionName} · {item.offerId ? "отдельное предложение" : item.warehouseId ? "склад" : "все предложения"} · приоритет {item.priority}</option>)}</DmDropdown></DmField> : null}
    {binding ? <IntegrationTaxEditor key={binding.id} initial={binding} onDirtyChange={onDirtyChange} onClose={() => setSelected("")} /> : null}
  </DmSurface>;
}
function IntegrationTaxEditor({ initial, onDirtyChange, onClose }: { initial: IntegrationTaxBinding; onDirtyChange: (dirty: boolean) => void; onClose: () => void }) {
  const { api, organizationId } = useWorkspace(), has = usePermissions();
  const [saved, setSaved] = useState(initial), [settings, setSettings] = useState<SupplierVatSettings | null>(null);
  const [kind, setKind] = useState(initial.priceTax ? initial.priceTax.priceIncludesVat ? "GROSS" : "NET" : "");
  const [override, setOverride] = useState(Boolean(initial.priceTax?.defaultVat)), [draft, setDraft] = useState(vatDraft(initial.priceTax?.defaultVat));
  const [columns, setColumns] = useState({ vatMode: initial.priceTax?.vatMode ?? "", vatRate: initial.priceTax?.vatRate ?? "", vatBasis: initial.priceTax?.vatBasis ?? "" });
  const [dirty, setDirty] = useState(false), [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [conflict, setConflict] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false), retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const editable = has("integration.manage") && has("pricing.manage");
  const load = useCallback(async () => {
    try { const [profile, bindings] = await Promise.all([api.getSupplierVatSettings(organizationId), api.listIntegrationTaxBindings(organizationId)]);
      const latest = bindings.find(item => item.id === initial.id); if (!latest) throw new Error("Источник больше недоступен");
      setSettings(profile); setSaved(latest); setConflict(false); setAck(false); setError(""); retry.current = null;
    } catch (cause) { setError(errorMessage(cause)); }
  }, [api, organizationId, initial.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const changed = () => { setDirty(true); setAck(false); setNotice(""); };
  const save = async () => {
    const parsed = parseVatDraft(draft);
    if (lock.current || !editable || conflict || !settings?.profile || settings.profileIssue || !ack || !kind || (override && !parsed.success)) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const body = { expectedUpdatedAt: saved.updatedAt, priceTax: { priceIncludesVat: kind === "GROSS", expectedRequisitesVersion: settings.profile.version, taxAcknowledged: true as const,
        ...(override && parsed.success ? { defaultVat: parsed.data } : {}), ...Object.fromEntries(Object.entries(columns).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) } };
      const fingerprint = JSON.stringify(body); if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
      setSaved(await api.updateIntegrationTax(organizationId, initial.connectionId, initial.id, { ...body, idempotencyKey: retry.current.key }));
      setDirty(false); setAck(false); retry.current = null; setNotice("Условия сохранены для следующей синхронизации.");
    } catch (cause) { setError(errorMessage(cause)); if (cause && typeof cause === "object" && "status" in cause && cause.status === 409) setConflict(true); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className={layout.stack}>
    <h3>{initial.connectionName}</h3>
    {error ? <ErrorState description={error} /> : null}
    {!settings ? <LoadingState label="Загружаем налоговый профиль" /> : <>
      {settings.profileIssue ? <ErrorState description={settings.profileIssue} /> : null}
      {settings.defaultIssue ? <p role="alert">Настройка по умолчанию устарела. Подтвердите её в настройках НДС или укажите режим для новых товаров этого источника.</p> : null}
      <p>Настройка поставщика для новых товаров: {settings.defaultTax ? vatLabel(settings.defaultTax.selection) : "не задана"}. Пустые поля существующих предложений сохраняют прежние условия.</p>
      <DmField className={layout.field} label="Формат цены ERP" required><DmDropdown value={kind} disabled={busy || !editable} onChange={(_, data) => { setKind(data.value); changed(); }}><option value="">Выберите формат</option><option value="GROSS">Цена включает применимый НДС</option><option value="NET">Цена без НДС — начислить сверху</option></DmDropdown></DmField>
      <DmCheckbox label="Задать режим для новых товаров этого источника" checked={override} disabled={busy || !editable} onChange={(_, data) => { setOverride(data.checked === true); changed(); }} />
      {override ? <VatFields value={draft} onChange={value => { setDraft(value); changed(); }} date={settings.date} profile={settings.profile} disabled={busy || !editable} /> : null}
      <p>Если ERP передаёт индивидуальные условия, укажите имена полей. Значения режима: TAXABLE, NOT_VAT_PAYER, EXEMPT, ZERO_RATED; ставка — число без знака %.</p>
      {([ ["vatMode", "Поле режима НДС"], ["vatRate", "Поле ставки НДС"], ["vatBasis", "Поле основания НДС"] ] as const).map(([key, label]) => <DmField className={layout.field} key={key} label={label}><DmInput value={columns[key]} maxLength={120} disabled={busy || !editable} onChange={(_, data) => { setColumns(value => ({ ...value, [key]: data.value })); changed(); }} /></DmField>)}
      <DmCheckbox label="Подтверждаю формат цен и налоговые условия источника" checked={ack} disabled={busy || !editable} onChange={(_, data) => setAck(data.checked === true)} />
    </>}
    {conflict ? <p role="alert">Обновите данные и проверьте введённые условия перед повторным сохранением.</p> : null}
    {notice ? <DmFeedback tone="success" title="Сохранено" description={notice} /> : null}
    <div className={layout.actions}><DmButton disabled={busy} onClick={() => void load()}>Обновить данные источника</DmButton><DmButton disabled={busy || dirty} onClick={onClose}>Другой источник</DmButton><DmButton appearance="primary" disabled={busy || !editable || conflict || !ack || !kind || !settings?.profile || Boolean(settings.profileIssue) || (override && !parseVatDraft(draft).success)} onClick={() => void save()}>Сохранить НДС источника</DmButton></div>
  </div>;
}
