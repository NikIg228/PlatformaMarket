"use client";
import { useRef, useState } from "react";
import type { OrganizationRequisitesHistory, OrganizationRequisitesRevision } from "@marketplace/schemas";
import { DmButton, DmDialog, DmFeedback, DmSurface, LoadingState, errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
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

export function RequisitesHistory() {
  const { api, organizationId } = useWorkspace();
  const [history, setHistory] = useState<OrganizationRequisitesHistory | null>(null), [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [selected, setSelected] = useState<OrganizationRequisitesRevision | null>(null);
  const lock = useRef(false), trigger = useRef<HTMLButtonElement | null>(null);
  async function load(more = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setOpen(true);
    try {
      const next = await api.getOrganizationRequisitesHistory(more && history?.nextBeforeVersion ? { beforeVersion: history.nextBeforeVersion } : {});
      setHistory(previous => more && previous ? { ...next, items: [...previous.items, ...next.items] } : next);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <DmSurface className={styles.card} role="region" aria-label="История реквизитов" key={organizationId}>
    <div className={styles.toolbar}><h2>История версий</h2><DmButton appearance="subtle" disabled={busy} onClick={() => open ? setOpen(false) : void load()}>{open ? "Свернуть историю" : "Показать историю"}</DmButton></div>
    {open ? <>
      {busy && !history ? <LoadingState label="Загружаем историю реквизитов" /> : null}
      {history?.items.length === 0 ? <p className={styles.muted}>Сохранённых версий пока нет.</p> : null}
      <ul className={styles.list}>{history?.items.map(item => <li key={item.id} className={layout.historyRow}><div><strong>Версия {item.version} · {item.confirmedAt ? "Подтверждена" : "Черновик"}</strong><p>{date(item.createdAt)} · {item.createdBy.displayName}</p></div><DmButton appearance="subtle" onClick={event => { trigger.current = event.currentTarget; setSelected(item); }}>Открыть версию {item.version}</DmButton></li>)}</ul>
      {error ? <DmFeedback tone="danger" presentation="inline" alert title="История не загружена" description={error} action={<DmButton disabled={busy} onClick={() => void load(Boolean(history?.nextBeforeVersion))}>Повторить</DmButton>} /> : null}
      {history?.nextBeforeVersion ? <div className={styles.refresh}><DmButton disabled={busy} onClick={() => void load(true)}>{busy ? "Загружаем…" : "Показать ещё"}</DmButton></div> : null}
    </> : null}
    <DmDialog open={selected !== null} title={`Реквизиты · версия ${selected?.version ?? ""}`} onOpenChange={next => { if (!next) setSelected(null); }} onClosed={() => trigger.current?.focus()} actions={<DmButton onClick={() => setSelected(null)}>Закрыть</DmButton>}>
      {selected ? <RequisitesReview value={selected} /> : null}
    </DmDialog>
  </DmSurface>;
}
