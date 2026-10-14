"use client";
import { Add20Regular } from "@fluentui/react-icons/svg/add";
import type { OrganizationRequisitesFields, OrganizationTaxPeriod } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect } from "@marketplace/ui";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

export type RequisitesDraft = Omit<OrganizationRequisitesFields, "taxPeriods"> & {
  taxPeriods: Array<Omit<OrganizationTaxPeriod, "status"> & { status: OrganizationTaxPeriod["status"] | "" }>;
};
export const emptyRequisitesDraft = (): RequisitesDraft => ({ legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] });

export function RequisitesFields({ value, onChange, disabled, errors, supplier }: {
  value: RequisitesDraft; onChange: (value: RequisitesDraft) => void; disabled: boolean; errors: Record<string, string>; supplier: boolean;
}) {
  const validation = (path: string) => ({ validationState: errors[path] ? "error" as const : "none" as const, validationMessage: errors[path] });
  return <div className={layout.stack}>
    <DmField label="Юридическая форма" {...validation("legalForm")}>
      <DmSelect value={value.legalForm ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, legalForm: data.value === "" ? null : data.value as OrganizationRequisitesFields["legalForm"] })}>
        <option value="">Выберите форму</option><option value="LEGAL_ENTITY">Юридическое лицо · БИН</option><option value="INDIVIDUAL_ENTREPRENEUR">Индивидуальный предприниматель · ИИН</option>
      </DmSelect>
    </DmField>
    <section aria-label="Банковские счета" className={layout.stack}>
      <div className={styles.toolbar}><h3>Банковские счета</h3><DmButton appearance="subtle" icon={<Add20Regular />} disabled={disabled || value.bankAccounts.length >= 10} onClick={() => {
        const id = crypto.randomUUID(); onChange({ ...value, bankAccounts: [...value.bankAccounts, { id, bankName: "", iban: "", bic: "", kbe: "", currency: "KZT" }], defaultBankAccountId: value.defaultBankAccountId ?? id });
      }}>Добавить счёт</DmButton></div>
      {!value.bankAccounts.length ? <p className={styles.muted}>{supplier ? "Добавьте счёт в тенге для оплаты заказов. Получатель — ваша организация." : "Для оплаты поставщику банковский счёт клиники не обязателен."}</p> : null}
      {value.bankAccounts.map((account, index) => <div key={account.id} role="group" aria-label={`Банковский счёт ${index + 1}`} className={layout.record}>
        <div className={styles.toolbar}><h3>Счёт {index + 1} · KZT</h3><DmButton appearance="subtle" disabled={disabled} onClick={() => onChange({ ...value, bankAccounts: value.bankAccounts.filter(item => item.id !== account.id), defaultBankAccountId: value.defaultBankAccountId === account.id ? null : value.defaultBankAccountId })}>Убрать счёт {index + 1}</DmButton></div>
        <div className={`${styles.two} ${layout.fields}`}>
          {([ ["bankName", "Название банка", 200], ["iban", "ИИК / IBAN", 20], ["bic", "БИК", 8], ["kbe", "КБе", 2] ] as const).map(([key, label, maxLength]) => <DmField key={key} label={label} required {...validation(`bankAccounts.${index}.${key}`)}>
            <DmInput value={account[key]} disabled={disabled} maxLength={maxLength} inputMode={key === "kbe" ? "numeric" : "text"} autoComplete="off" onChange={(_, data) => onChange({ ...value, bankAccounts: value.bankAccounts.map(item => item.id === account.id ? { ...item, [key]: key === "iban" || key === "bic" ? data.value.replace(/\s/g, "").toUpperCase() : data.value } : item) })} />
          </DmField>)}
        </div>
      </div>)}
      {value.bankAccounts.length ? <DmField label="Счёт для оплаты по умолчанию" {...validation("defaultBankAccountId")}>
        <DmSelect value={value.defaultBankAccountId ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, defaultBankAccountId: data.value || null })}>
          <option value="">Выберите счёт</option>{value.bankAccounts.map((account, index) => <option key={account.id} value={account.id}>{account.bankName || `Счёт ${index + 1}`} · {account.iban || "ИИК не заполнен"}</option>)}
        </DmSelect>
      </DmField> : null}
    </section>
    <section aria-label="Налоговый статус" className={layout.stack}>
      <div className={styles.toolbar}><h3>Налоговый статус</h3><DmButton appearance="subtle" icon={<Add20Regular />} disabled={disabled || value.taxPeriods.length >= 20} onClick={() => onChange({ ...value, taxPeriods: [...value.taxPeriods, { id: crypto.randomUUID(), status: "", effectiveFrom: "", effectiveTo: null, reference: null }] })}>Добавить период</DmButton></div>
      <p className={styles.muted}>{supplier ? "Укажите статус поставщика и даты его действия. Это не ставка НДС для всех товаров." : "При необходимости укажите налоговый статус клиники. Для получения счёта от поставщика он не обязателен."}</p>
      {value.taxPeriods.map((period, index) => <div key={period.id} role="group" aria-label={`Налоговый период ${index + 1}`} className={layout.record}>
        <div className={styles.toolbar}><h3>Период {index + 1}</h3><DmButton appearance="subtle" disabled={disabled} onClick={() => onChange({ ...value, taxPeriods: value.taxPeriods.filter(item => item.id !== period.id) })}>Убрать период {index + 1}</DmButton></div>
        <div className={`${styles.two} ${layout.fields}`}>
          <DmField label="Статус по НДС" required {...validation(`taxPeriods.${index}.status`)}><DmSelect disabled={disabled} value={period.status} onChange={(_, data) => onChange({ ...value, taxPeriods: value.taxPeriods.map(item => item.id === period.id ? { ...item, status: data.value as OrganizationTaxPeriod["status"] | "" } : item) })}>
            <option value="">Выберите статус</option><option value="VAT_PAYER">Плательщик НДС</option><option value="NOT_VAT_PAYER">Не является плательщиком НДС</option>
          </DmSelect></DmField>
          <DmField label="Основание / регистрационные сведения" {...validation(`taxPeriods.${index}.reference`)}><DmInput value={period.reference ?? ""} maxLength={200} disabled={disabled} onChange={(_, data) => onChange({ ...value, taxPeriods: value.taxPeriods.map(item => item.id === period.id ? { ...item, reference: data.value || null } : item) })} /></DmField>
          <DmField label="Действует с" required {...validation(`taxPeriods.${index}.effectiveFrom`)}><DmInput type="date" value={period.effectiveFrom} disabled={disabled} onChange={(_, data) => onChange({ ...value, taxPeriods: value.taxPeriods.map(item => item.id === period.id ? { ...item, effectiveFrom: data.value } : item) })} /></DmField>
          <DmField label="Последний день действия" hint="Не заполняйте, если дата окончания не определена" {...validation(`taxPeriods.${index}.effectiveTo`)}><DmInput type="date" value={period.effectiveTo ?? ""} disabled={disabled} onChange={(_, data) => onChange({ ...value, taxPeriods: value.taxPeriods.map(item => item.id === period.id ? { ...item, effectiveTo: data.value || null } : item) })} /></DmField>
        </div>
      </div>)}
    </section>
  </div>;
}
