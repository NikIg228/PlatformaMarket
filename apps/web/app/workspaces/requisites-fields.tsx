"use client";
import { Add20Regular } from "@fluentui/react-icons/svg/add";
import type { OrganizationRequisitesFields, OrganizationTaxPeriod } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmDropdown, DmHeading, DmFormSections } from "@marketplace/ui";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";
import { RequisitesTaxPeriod } from "./requisites-tax-period";

export type RequisitesDraft = Omit<OrganizationRequisitesFields, "taxPeriods"> & {
  taxPeriods: Array<Omit<OrganizationTaxPeriod, "status"> & { status: OrganizationTaxPeriod["status"] | "" }>;
};
export const emptyRequisitesDraft = (): RequisitesDraft => ({ legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] });

export function RequisitesFields({ value, onChange, disabled, errors, supplier }: {
  value: RequisitesDraft; onChange: (value: RequisitesDraft) => void; disabled: boolean; errors: Record<string, string>; supplier: boolean;
}) {
  const validation = (path: string) => ({ validationState: errors[path] ? "error" as const : "none" as const, validationMessage: errors[path] });
  return <DmFormSections>
    <DmField className={layout.field} label="Юридическая форма" {...validation("legalForm")}>
      <DmDropdown value={value.legalForm ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, legalForm: data.value === "" ? null : data.value as OrganizationRequisitesFields["legalForm"] })}>
        <option value="">Выберите форму</option><option value="LEGAL_ENTITY">Юридическое лицо · БИН</option><option value="INDIVIDUAL_ENTREPRENEUR">Индивидуальный предприниматель · ИИН</option>
      </DmDropdown>
    </DmField>
    <section aria-label="Банковские счета" className={layout.stack}>
      <div className={layout.sectionHeader}><DmHeading inline level={3} title="Банковские счета" description={supplier ? "Добавьте ваш счёт в тенге для оплаты заказов. Получатель — ваша организация." : "Для оплаты поставщику ваш банковский счёт не обязателен."} /><DmButton appearance="subtle" icon={<Add20Regular />} disabled={disabled || value.bankAccounts.length >= 10} onClick={() => {
        const id = crypto.randomUUID(); onChange({ ...value, bankAccounts: [...value.bankAccounts, { id, bankName: "", iban: "", bic: "", kbe: "", currency: "KZT" }], defaultBankAccountId: value.defaultBankAccountId ?? id });
      }}>Добавить счёт</DmButton></div>
      {!value.bankAccounts.length ? <p className={styles.muted}>Вы ещё не добавили банковские счета.</p> : null}
      {value.bankAccounts.map((account, index) => <div key={account.id} role="group" aria-label={`Банковский счёт ${index + 1}`} className={layout.record}>
        <div className={layout.sectionHeader}><h3>Счёт {index + 1} · KZT</h3><DmButton appearance="subtle" disabled={disabled} onClick={() => onChange({ ...value, bankAccounts: value.bankAccounts.filter(item => item.id !== account.id), defaultBankAccountId: value.defaultBankAccountId === account.id ? null : value.defaultBankAccountId })}>Убрать счёт {index + 1}</DmButton></div>
        <div className={`${styles.two} ${layout.fields}`}>
          {([ ["bankName", "Название банка", 200], ["iban", "ИИК / IBAN", 20], ["bic", "БИК", 8], ["kbe", "КБе", 2] ] as const).map(([key, label, maxLength]) => <DmField key={key} label={label} required {...validation(`bankAccounts.${index}.${key}`)}>
            <DmInput value={account[key]} disabled={disabled} maxLength={maxLength} inputMode={key === "kbe" ? "numeric" : "text"} autoComplete="off" onChange={(_, data) => onChange({ ...value, bankAccounts: value.bankAccounts.map(item => item.id === account.id ? { ...item, [key]: key === "iban" || key === "bic" ? data.value.replace(/\s/g, "").toUpperCase() : data.value } : item) })} />
          </DmField>)}
        </div>
      </div>)}
      {value.bankAccounts.length ? <DmField className={layout.field} label="Счёт для оплаты по умолчанию" {...validation("defaultBankAccountId")}>
        <DmDropdown value={value.defaultBankAccountId ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, defaultBankAccountId: data.value || null })}>
          <option value="">Выберите счёт</option>{value.bankAccounts.map((account, index) => <option key={account.id} value={account.id}>{account.bankName || `Счёт ${index + 1}`} · {account.iban || "ИИК не заполнен"}</option>)}
        </DmDropdown>
      </DmField> : null}
    </section>
    <section aria-label="Налоговый статус" className={layout.stack}>
      <div className={layout.sectionHeader}><DmHeading inline level={3} title="Налоговый статус" description={supplier ? "Укажите ваш статус по НДС и дату, с которой он действует. По ней определяется статус на дату операции. Это не ставка НДС для всех ваших товаров." : "При необходимости укажите ваш налоговый статус. Для получения счёта от поставщика он не обязателен."} /><DmButton appearance="subtle" icon={<Add20Regular />} disabled={disabled || value.taxPeriods.length >= 20} onClick={() => onChange({ ...value, taxPeriods: [...value.taxPeriods, { id: crypto.randomUUID(), status: "", effectiveFrom: "", effectiveTo: null, reference: null }] })}>Добавить период</DmButton></div>
      {value.taxPeriods.map((period, index) => <div key={period.id} role="group" aria-label={`Налоговый период ${index + 1}`} className={layout.record}>
        <div className={layout.sectionHeader}><h3>Период {index + 1}</h3><DmButton appearance="subtle" disabled={disabled} onClick={() => onChange({ ...value, taxPeriods: value.taxPeriods.filter(item => item.id !== period.id) })}>Убрать период {index + 1}</DmButton></div>
        <RequisitesTaxPeriod value={period} index={index} errors={errors} disabled={disabled} onChange={next => onChange({ ...value, taxPeriods: value.taxPeriods.map(item => item.id === period.id ? next : item) })} />
      </div>)}
    </section>
  </DmFormSections>;
}
