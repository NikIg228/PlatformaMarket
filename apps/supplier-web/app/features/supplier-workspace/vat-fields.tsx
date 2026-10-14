"use client";
import { VAT_RATE_RULES, vatSelectionSchema, type VatProfile, type VatSelection } from "@marketplace/schemas";
import { DmDropdown, DmField, DmInput } from "@marketplace/ui";
import styles from "./product-forms.module.css";

export type VatDraft = { mode: VatSelection["mode"] | ""; rate: string; basis: string };
export const vatDraft = (selection?: VatSelection | null): VatDraft => ({ mode: selection?.mode ?? "", rate: selection?.rate ?? "", basis: selection?.basis ?? "" });
export const parseVatDraft = (draft: VatDraft) => vatSelectionSchema.safeParse({ mode: draft.mode, rate: draft.rate || null, basis: draft.basis.trim() || null });
export function VatFields({ value, onChange, date, profile, disabled = false }: {
  value: VatDraft; onChange: (draft: VatDraft) => void; date: string; profile: VatProfile | null; disabled?: boolean;
}) {
  const basisRequired = value.mode === "EXEMPT" || value.mode === "ZERO_RATED" || (value.mode === "TAXABLE" && value.rate !== "16");
  return <div className={styles.mapping}>
    <DmField label="Налоговый режим" required><DmDropdown value={value.mode} disabled={disabled} onChange={(_, data) => {
      const mode = data.value as VatDraft["mode"];
      onChange({ mode, rate: mode === "ZERO_RATED" ? "0" : "", basis: "" });
    }}><option value="">Выберите режим</option>
      <option value="TAXABLE" disabled={profile?.status === "NOT_VAT_PAYER"}>Облагается НДС</option>
      <option value="NOT_VAT_PAYER" disabled={profile?.status === "VAT_PAYER"}>Без НДС — неплательщик</option>
      <option value="EXEMPT" disabled={profile?.status === "NOT_VAT_PAYER"}>Освобождено от НДС</option>
      <option value="ZERO_RATED" disabled={profile?.status === "NOT_VAT_PAYER"}>Нулевая ставка НДС</option>
    </DmDropdown></DmField>
    {value.mode === "TAXABLE" ? <DmField label="Ставка НДС" required><DmDropdown value={value.rate} disabled={disabled} onChange={(_, data) => onChange({ ...value, rate: data.value })}>
      <option value="">Выберите ставку</option>{VAT_RATE_RULES.filter(rule => rule.from <= date && (!rule.to || date <= rule.to)).map(rule => <option key={rule.id} value={rule.rate}>{rule.label}</option>)}
    </DmDropdown></DmField> : null}
    {basisRequired ? <DmField label="Основание применения" required hint="Укажите норму или перечень, по которому применяете этот режим к товару."><DmInput value={value.basis} disabled={disabled} maxLength={500} onChange={(_, data) => onChange({ ...value, basis: data.value })} /></DmField> : null}
  </div>;
}
