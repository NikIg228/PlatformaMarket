"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { vatLabel, type OfferVatInput, type SupplierVatSettings, type VatSelection } from "@marketplace/schemas";
import { DmButton, DmCheckbox, ErrorState, LoadingState, errorMessage } from "@marketplace/ui";
import { VatFields, parseVatDraft, vatDraft } from "./vat-fields";

export function OfferVatEditor({ api, supplierId, initial, applyDefault = false, disabled = false, onChange, onDirty }: {
  api: MarketplaceApiClient; supplierId: string; initial?: VatSelection | null; applyDefault?: boolean; disabled?: boolean;
  onChange: (input: OfferVatInput | undefined) => void;
  onDirty?: () => void;
}) {
  const [settings, setSettings] = useState<SupplierVatSettings | null>(null), [error, setError] = useState("");
  const [draft, setDraft] = useState(() => vatDraft(initial)), [acknowledged, setAcknowledged] = useState(false);
  const defaultApplied = useRef(false);
  const load = useCallback(async () => { setError(""); try { setSettings(await api.getSupplierVatSettings(supplierId)); } catch (cause) { setError(errorMessage(cause)); } }, [api, supplierId]);
  useEffect(() => { let alive = true; void api.getSupplierVatSettings(supplierId).then(value => { if (alive) setSettings(value); }).catch(cause => { if (alive) setError(errorMessage(cause)); }); return () => { alive = false; }; }, [api, supplierId]);
  useEffect(() => { setDraft(vatDraft(initial)); setAcknowledged(false); }, [initial]);
  useEffect(() => {
    setAcknowledged(false);
    if (settings && applyDefault && !defaultApplied.current && !settings.defaultIssue) { defaultApplied.current = true; setDraft(current => current.mode ? current : vatDraft(settings.defaultTax?.selection)); }
  }, [settings, applyDefault]);
  useEffect(() => {
    const parsed = parseVatDraft(draft);
    onChange(parsed.success && acknowledged && settings?.profile && !settings.profileIssue
      ? { selection: parsed.data, expectedRequisitesVersion: settings.profile.version, acknowledged: true } : undefined);
  }, [draft, acknowledged, settings, onChange]);
  if (!settings) return error ? <ErrorState description={error} action={<DmButton type="button" onClick={() => void load()}>Повторить загрузку НДС</DmButton>} /> : <LoadingState label="Загружаем налоговые условия" />;
  return <section aria-label="Налоговые условия предложения">
    <h3>НДС</h3><p>Цена указана за упаковку и включает применимый НДС.</p>
    {settings.profileIssue ? <ErrorState description={settings.profileIssue} /> : null}
    {settings.defaultIssue ? <p role="status">Настройка по умолчанию требует подтверждения. Укажите актуальные условия этого товара или обновите настройку НДС.</p> : null}
    {!settings.profile || settings.profileIssue ? <a href="/supplier/settings?tab=requisites">Заполнить и подтвердить реквизиты</a> : <p>Статус поставщика: {settings.profile.status === "VAT_PAYER" ? "плательщик НДС" : "неплательщик НДС"}.</p>}
    {applyDefault && settings.defaultTax && !settings.defaultIssue ? <p>Для нового предложения: {vatLabel(settings.defaultTax.selection)}. При необходимости измените режим этого товара.</p> : null}
    <VatFields value={draft} onChange={value => { setDraft(value); setAcknowledged(false); onDirty?.(); }} date={settings.date} profile={settings.profile} disabled={disabled || !settings.canEdit || !settings.profile || Boolean(settings.profileIssue)} />
    <DmCheckbox label="Подтверждаю применимость режима и ставки к этому товару" checked={acknowledged} disabled={disabled || !parseVatDraft(draft).success || !settings.profile || Boolean(settings.profileIssue)} onChange={(_, data) => setAcknowledged(data.checked === true)} />
    {error || settings?.profileIssue ? <DmButton type="button" appearance="subtle" disabled={disabled} onClick={() => void load()}>Повторить загрузку</DmButton> : null}
  </section>;
}
