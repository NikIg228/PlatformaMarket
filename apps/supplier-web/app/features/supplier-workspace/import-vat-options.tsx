"use client";
import { useCallback, useEffect, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { vatLabel, type SupplierColumnMappingInput, type SupplierVatSettings } from "@marketplace/schemas";
import { DmButton, DmCheckbox, DmDropdown, DmField, ErrorState, LoadingState, errorMessage } from "@marketplace/ui";
import { VatFields, parseVatDraft, vatDraft } from "./vat-fields";

export type ImportVatOptionsValue = Pick<SupplierColumnMappingInput, "priceIncludesVat" | "defaultVat" | "expectedRequisitesVersion" | "taxAcknowledged">;
export function ImportVatOptions({ api, supplierId, disabled, onChange }: {
  api: MarketplaceApiClient; supplierId: string; disabled: boolean; onChange: (value: ImportVatOptionsValue | null) => void;
}) {
  const [settings, setSettings] = useState<SupplierVatSettings | null>(null), [error, setError] = useState("");
  const [priceKind, setPriceKind] = useState(""), [override, setOverride] = useState(false);
  const [draft, setDraft] = useState(vatDraft()), [ack, setAck] = useState(false);
  const load = useCallback(async () => { setError(""); setAck(false); try { setSettings(await api.getSupplierVatSettings(supplierId)); } catch (cause) { setError(errorMessage(cause)); } }, [api, supplierId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const parsed = parseVatDraft(draft);
    onChange(settings?.profile && !settings.profileIssue && ack && priceKind && (!override || parsed.success)
      ? { priceIncludesVat: priceKind === "GROSS", expectedRequisitesVersion: settings.profile.version, taxAcknowledged: true,
        ...(override && parsed.success ? { defaultVat: parsed.data } : {}) } : null);
  }, [settings, ack, priceKind, override, draft, onChange]);
  if (!settings) return error ? <ErrorState description={error} action={<DmButton onClick={() => void load()}>Повторить загрузку НДС</DmButton>} /> : <LoadingState label="Загружаем настройки НДС" />;
  return <section aria-label="НДС в прайсе">
    <h3>НДС в прайсе</h3>
    {error || settings.profileIssue ? <ErrorState description={error || settings.profileIssue!} /> : null}
    {settings.defaultIssue ? <p role="alert">Настройка по умолчанию устарела. Подтвердите её в настройках НДС или укажите режим для новых товаров этой загрузки.</p> : null}
    {!settings.profile || settings.profileIssue ? <a href="/supplier/settings?tab=requisites">Подтвердить реквизиты поставщика</a> : null}
    <p>Пустые налоговые поля сохраняют условия существующего предложения. Для новых используется {settings.defaultTax ? vatLabel(settings.defaultTax.selection) : "режим, указанный в строке или настройках этой загрузки"}.</p>
    <p>Значения столбца режима: TAXABLE, NOT_VAT_PAYER, EXEMPT, ZERO_RATED. Ставка — число без знака %. Индивидуальные условия строки имеют приоритет.</p>
    <DmField label="НДС в цене файла" required><DmDropdown value={priceKind} disabled={disabled} onChange={(_, data) => { setPriceKind(data.value); setAck(false); }}>
      <option value="">Укажите формат цены</option><option value="GROSS">Конечная цена с применимым НДС</option><option value="NET">Цена без НДС — начислить сверху</option>
    </DmDropdown></DmField>
    <DmCheckbox label="Указать режим для новых товаров этой загрузки" checked={override} disabled={disabled} onChange={(_, data) => { setOverride(data.checked === true); setAck(false); }} />
    {override ? <VatFields value={draft} onChange={value => { setDraft(value); setAck(false); }} date={settings.date} profile={settings.profile} disabled={disabled} /> : null}
    <DmCheckbox label="Подтверждаю налоговые условия строк и формат цен этого прайса" checked={ack} disabled={disabled || !settings.profile || Boolean(settings.profileIssue)} onChange={(_, data) => setAck(data.checked === true)} />
    <DmButton disabled={disabled} onClick={() => void load()}>Обновить налоговый профиль</DmButton>
  </section>;
}
