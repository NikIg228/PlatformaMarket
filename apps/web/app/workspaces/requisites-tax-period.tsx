"use client";
import { useLayoutEffect, useRef } from "react";
import { ChevronDown20Regular } from "@fluentui/react-icons/svg/chevron-down";
import { DmDisclosureSummary, DmDropdown, DmField, DmInput } from "@marketplace/ui";
import type { RequisitesDraft } from "./requisites-fields";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

type TaxPeriod = RequisitesDraft["taxPeriods"][number];
export function RequisitesTaxPeriod({ value, onChange, disabled, errors, index }: {
  value: TaxPeriod; onChange: (value: TaxPeriod) => void; disabled: boolean;
  errors: Record<string, string>; index: number;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const referenceError = errors[`taxPeriods.${index}.reference`], endError = errors[`taxPeriods.${index}.effectiveTo`];
  useLayoutEffect(() => {
    if ((referenceError || endError) && details.current) details.current.open = true;
  }, [errors, referenceError, endError]);
  const validation = (field: keyof TaxPeriod) => {
    const error = errors[`taxPeriods.${index}.${field}`];
    return { validationState: error ? "error" as const : "none" as const, validationMessage: error };
  };
  return <>
    <div className={`${styles.two} ${layout.fields}`}>
      <DmField label="Статус по НДС" required {...validation("status")}><DmDropdown disabled={disabled} value={value.status} onChange={(_, data) => onChange({ ...value, status: data.value as TaxPeriod["status"] })}>
        <option value="">Выберите статус</option><option value="VAT_PAYER">Плательщик НДС</option><option value="NOT_VAT_PAYER">Не является плательщиком НДС</option>
      </DmDropdown></DmField>
      <DmField label="Действует с" required {...validation("effectiveFrom")}><DmInput type="date" value={value.effectiveFrom} disabled={disabled} onChange={(_, data) => onChange({ ...value, effectiveFrom: data.value })} /></DmField>
    </div>
    <details ref={details}>
      <DmDisclosureSummary><ChevronDown20Regular aria-hidden="true" />Дополнительные сведения{value.reference || value.effectiveTo ? " · заполнены" : ""}</DmDisclosureSummary>
      <div className={`${styles.two} ${layout.fields} ${layout.detailsFields}`}>
        <DmField label="Основание / регистрационные сведения" hint="Необязательная справочная запись о вашем статусе" {...validation("reference")}><DmInput value={value.reference ?? ""} maxLength={200} disabled={disabled} onChange={(_, data) => onChange({ ...value, reference: data.value || null })} /></DmField>
        <DmField label="Последний день действия" hint="Не заполняйте, если дата окончания не определена" {...validation("effectiveTo")}><DmInput type="date" value={value.effectiveTo ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, effectiveTo: data.value || null })} /></DmField>
      </div>
    </details>
  </>;
}
