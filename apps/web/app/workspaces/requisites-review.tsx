"use client";
import type { OrganizationRequisitesRevision } from "@marketplace/schemas";
import styles from "./account-settings.module.css";
import layout from "./requisites.module.css";

function date(value: string) { return new Intl.DateTimeFormat("ru-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qyzylorda" }).format(new Date(value)); }

export function RequisitesReview({ value }: { value: OrganizationRequisitesRevision }) {
  const { fields, source } = value;
  return <div className={layout.stack}>
    <dl className={layout.summary}>
      <dt>Организация / получатель</dt><dd>{source.legalName}</dd>
      <dt>{fields.legalForm === "INDIVIDUAL_ENTREPRENEUR" ? "ИИН" : "БИН"}</dt><dd>{source.identifier}</dd>
      <dt>Юридическая форма</dt><dd>{fields.legalForm === "LEGAL_ENTITY" ? "Юридическое лицо" : fields.legalForm === "INDIVIDUAL_ENTREPRENEUR" ? "Индивидуальный предприниматель" : "Не указана"}</dd>
      <dt>Юридический адрес</dt><dd>{source.legalAddressText ?? "Не заполнен"}</dd>
      <dt>Адрес получения</dt><dd>{source.deliveryAddressText ?? "Не заполнен"}</dd>
      <dt>Рабочий контакт</dt><dd>{source.profile ? `${source.profile.contactName} · ${source.profile.phone} · ${source.profile.email}` : "Не заполнен"}</dd>
    </dl>
    {fields.bankAccounts.map((account, index) => <div key={account.id} className={layout.record}>
      <strong>Счёт {index + 1}{account.id === fields.defaultBankAccountId ? " · для оплаты по умолчанию" : ""}</strong>
      <dl className={layout.summary}><dt>Банк</dt><dd>{account.bankName}</dd><dt>ИИК / IBAN</dt><dd>{account.iban}</dd><dt>БИК · КБе · валюта</dt><dd>{account.bic} · {account.kbe} · {account.currency}</dd></dl>
    </div>)}
    {!fields.bankAccounts.length ? <p className={styles.muted}>Банковские счета не добавлены.</p> : null}
    {fields.taxPeriods.map(period => <div key={period.id} className={layout.record}>
      <strong>{period.status === "VAT_PAYER" ? "Плательщик НДС" : "Не является плательщиком НДС"}</strong>
      <p>С {period.effectiveFrom}{period.effectiveTo ? ` по ${period.effectiveTo} включительно` : "; дата окончания не указана"}</p>
      {period.reference ? <p className={styles.muted}>{period.reference}</p> : null}
    </div>)}
    {!fields.taxPeriods.length ? <p className={styles.muted}>Налоговый статус не указан.</p> : null}
    <p className={styles.muted}>Версия {value.version} · сохранена {date(value.createdAt)} · {value.createdBy.displayName}</p>
    {value.confirmedAt ? <p>Подтверждена {date(value.confirmedAt)} · {value.confirmedBy?.displayName}</p> : <p>Черновик · ожидает подтверждения</p>}
  </div>;
}
