"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DmButton, DmDialog, DmFeedback, DmField, DmInfoTip, DmInput, DmSurface, DmTextarea, ErrorState, LoadingState, errorMessage, formatStatus, usePermissions, useSaveToast, useUnsavedChanges } from "@marketplace/ui";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import type { SupplierDataSource } from "../../../supplier-web/app/features/supplier-workspace/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import styles from "./account-settings.module.css";

const connectors = [
  { id: "one-c", name: "1С", description: "Передавайте товары, цены и остатки из вашей базы 1С.", field: "Название базы или конфигурации 1С", placeholder: "Например, Управление торговлей", preparation: "Уточните название и версию своей программы у специалиста, который обслуживает 1С." },
  { id: "moysklad", name: "МойСклад", description: "Используйте ассортимент, цены и остатки вашей организации в МоемСкладе.", field: "Название организации в МоемСкладе", placeholder: "Как указано в вашем кабинете", preparation: "Подготовьте название организации и выберите склады, товары которых хотите продавать на площадке." },
] as const;
type Connector = typeof connectors[number];

export function SettingsSources({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`, { signal }), [api, organizationId]);
  const resource = useResource(load);
  const [selected, setSelected] = useState<Connector | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [tickets, setTickets] = useState<Record<string, string>>({});
  return <div className={styles.page}>
    <DmSurface role="region" className={styles.card} aria-label="Источники товаров">
      <div className={styles.toolbar}><h2>Источники товаров</h2><Link {...dmLinkButtonProps({ appearance: "primary" })} href="/supplier/products/import">Загрузить прайс</Link></div>
      <div className={styles.connectorGrid}>{connectors.map(connector => <DmSurface key={connector.id} className={styles.connector} role="region" aria-label={connector.name}>
        <h3>{connector.name}</h3><p className={styles.muted}>{connector.description}</p><p className={styles.muted}>Подключение с помощью специалиста</p>
        <div className={styles.connectorActions}><DmButton appearance="primary" onClick={event => { trigger.current = event.currentTarget; setSelected(connector); setConnectionOpen(true); }}>Подключить</DmButton>{tickets[connector.id] ? <Link href={`/supplier/support?ticketId=${tickets[connector.id]}`}>Открыть обращение</Link> : null}</div>
      </DmSurface>)}</div>
    </DmSurface>
    <DmSurface className={styles.card}><h2>Источники загруженных товаров</h2>
      {resource.error ? <ErrorState description={resource.error} action={<DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
      {!resource.data && resource.loading ? <LoadingState label="Загружаем источники" /> : null}
      {resource.data?.length === 0 ? <div className={styles.empty} role="status">Пока нет загрузок. Добавьте товары из прайса или выберите учётную систему.</div> : <ul className={styles.list}>{resource.data?.map(source => <li key={source.id}><strong>{source.name}</strong><p className={styles.muted}>{formatStatus(source.type)} · {formatStatus(source.status)}</p></li>)}</ul>}
    </DmSurface>
    {selected ? <ConnectionRequest connector={selected} open={connectionOpen} onDirtyChange={onDirtyChange} onClose={() => setConnectionOpen(false)} onClosed={() => { setSelected(null); trigger.current?.focus(); }} onSent={id => { setTickets(current => ({ ...current, [selected.id]: id })); setConnectionOpen(false); }} /> : null}
  </div>;
}

function ConnectionRequest({ connector, open, onClose, onClosed, onSent, onDirtyChange }: { connector: Connector; open: boolean; onClose: () => void; onClosed: () => void; onSent: (id: string) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { api } = useWorkspace(), has = usePermissions(), notify = useSaveToast();
  const [name, setName] = useState(""), [comment, setComment] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [invalid, setInvalid] = useState(false);
  const lock = useRef(false), retry = useRef<{ payload: string; key: string } | null>(null), nameInput = useRef<HTMLInputElement>(null);
  const dirty = Boolean(name || comment || pending);
  useUnsavedChanges(dirty);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const close = () => { if (!lock.current && (!dirty || window.confirm("Закрыть заявку без отправки? Введённые данные будут удалены."))) onClose(); };
  async function submit() {
    if (lock.current || !has("support.ticket.create")) return;
    if (name.trim().length < 2) { setInvalid(true); nameInput.current?.focus(); return; }
    const input = { category: "GENERAL", subject: `Подключение ${connector.name}`, description: `${connector.field}: ${name.trim()}\n\n${comment.trim() || "Прошу помочь с подключением товаров, цен и остатков."}`, priority: "NORMAL" as const, links: [] };
    const payload = JSON.stringify(input);
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    lock.current = true; setPending(true); setError(null);
    try { const ticket = await api.createSupportTicket({ ...input, idempotencyKey: retry.current.key }); notify(`Заявка на подключение ${connector.name} отправлена`); onSent(ticket.id); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setPending(false); }
  }
  return <DmDialog open={open} onClosed={onClosed} onOpenChange={open => { if (!open) close(); }} title={`Подключение ${connector.name}`} description="Отправьте заявку. Специалист поможет настроить обмен и проверить первую загрузку вместе с вами."
    actions={<><DmButton appearance="subtle" disabled={pending} onClick={close}>Отмена</DmButton><DmButton appearance="primary" disabled={pending || !has("support.ticket.create")} onClick={() => void submit()}>{pending ? "Отправляем…" : "Отправить заявку"}</DmButton></>}>
    <ol className={styles.connectionSteps}><li>{connector.preparation}</li><li>Согласуйте со специалистом, какие товары, цены и остатки передавать на площадку.</li><li>Проверьте результат первой загрузки перед публикацией предложений.</li></ol>
    <div className={styles.page}>
      <DmField label={connector.field} required validationState={invalid ? "error" : "none"} validationMessage={invalid ? "Укажите название: не менее двух символов" : undefined}><DmInput ref={nameInput} value={name} maxLength={160} placeholder={connector.placeholder} disabled={pending} onChange={(_, data) => { setName(data.value); setInvalid(false); }} /></DmField>
      <div><div className={styles.contactHeading}><label htmlFor="connection-comment">Комментарий</label><DmInfoTip label="Подсказка: комментарий">Укажите, какие склады хотите подключить или что нужно уточнить перед началом работы.</DmInfoTip></div><DmTextarea id="connection-comment" value={comment} maxLength={2000} disabled={pending} onChange={(_, data) => setComment(data.value)} /></div>
      {error ? <DmFeedback tone="danger" title="Заявка не отправлена" description={error} alert /> : null}
      {!has("support.ticket.create") ? <DmFeedback tone="warning" title="Нет права отправить заявку" description="Попросите администратора вашей организации обратиться в поддержку." /> : null}
    </div>
  </DmDialog>;
}
