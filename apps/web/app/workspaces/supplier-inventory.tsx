"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { DmButton, DmField, DmInput, EmptyState, ErrorState, LoadingState, errorMessage, formatDate, formatStatus } from "@marketplace/ui";
import type { WorkspaceInventoryPage } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";
import { PageNavigation, usePageNavigation } from "./page-navigation";
import styles from "./workspace.module.css";

export function Inventory() {
  const { api } = useWorkspace();
  const navigation = usePageNavigation();
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const load = useCallback((signal: AbortSignal) => api.workspaceInventory({ cursor: navigation.cursor, q, limit: 25 }, { signal }), [api, navigation.cursor, q]);
  const resource = useResource(load);
  return <section className={styles.panel}>
    <p>Остатки меняются в редакторе предложения с проверкой версии. Активные резервы учитываются автоматически.</p>
    <form className={styles.actions} onSubmit={event => { event.preventDefault(); navigation.reset(); setQuery(draft.trim()); }}>
      <DmField label="Товар или склад"><DmInput value={draft} onChange={(_, data) => setDraft(data.value)} /></DmField><DmButton type="submit">Найти</DmButton>
    </form>
    <DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить остатки</DmButton>
    <PermissionBoundary required={["inventory.freshness.manage"]}><RecomputeInventory onChanged={resource.refreshAfterWrite} /></PermissionBoundary>
    <p>Срок первичного резерва может быть продлён заявленной оплатой. Статус оплаты показан в заказе.</p>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : !resource.data ? <LoadingState label="Загружаем остатки" /> : !resource.data.items.length ? <EmptyState title="Остатки не найдены" description="Измените поиск или добавьте остаток по складу в предложении." /> :
      <div className={styles.scroll}><table className={styles.table}><caption>Остатки, партии и активные резервы</caption><thead><tr><th>Товар и склад</th><th>На складе / доступно / резерв</th><th>Партии</th><th>Резервы</th></tr></thead><tbody>{resource.data.items.map(balance => <InventoryRow key={balance.id} balance={balance} />)}</tbody></table></div>}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
    <Overrides />
  </section>;
}
function InventoryRow({ balance }: { balance: WorkspaceInventoryPage["items"][number] }) {
  const [lotsOpen, setLotsOpen] = useState(false), [reservationsOpen, setReservationsOpen] = useState(false);
  return <tr>
    <td>{balance.productVariant.product.canonicalName}<small>{balance.warehouse.name}</small>{balance.offerId ? <Link href={`/supplier/products?offer=${balance.offerId}`}>Редактировать предложение</Link> : null}</td>
    <td>{balance.quantityOnHand} / {balance.quantityAvailable} / {balance.quantityReserved}<small>Страховой запас: {balance.safetyStock}</small><small>{formatStatus(balance.freshnessStatus)} · обновлено {formatDate(balance.updatedAt, true)}</small></td>
    <td><DmButton aria-expanded={lotsOpen} onClick={() => setLotsOpen(value => !value)}>{lotsOpen ? "Скрыть партии" : "Показать партии"}</DmButton>{lotsOpen ? <Lots balanceId={balance.id} /> : null}</td>
    <td><DmButton aria-expanded={reservationsOpen} onClick={() => setReservationsOpen(value => !value)}>{reservationsOpen ? "Скрыть резервы" : "Показать резервы"}</DmButton>{reservationsOpen ? <Reservations balanceId={balance.id} /> : null}</td>
  </tr>;
}
function Lots({ balanceId }: { balanceId: string }) {
  const { api } = useWorkspace(), navigation = usePageNavigation();
  const load = useCallback((signal: AbortSignal) => api.workspaceLots(balanceId, { cursor: navigation.cursor, limit: 25 }, { signal }), [api, balanceId, navigation.cursor]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем партии" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку партий</DmButton>} /> : null}
    {resource.data?.items.map(lot => <p key={lot.id}>{lot.lotNumber} · {formatStatus(lot.status)} · доступно {lot.quantityAvailable}<small>Годен до: {lot.expirationDate ? formatDate(lot.expirationDate) : "не указано"}</small></p>)}
    {resource.data && !resource.data.items.length ? <p>Партий нет.</p> : null}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
  </>;
}
function Reservations({ balanceId }: { balanceId: string }) {
  const { api } = useWorkspace(), navigation = usePageNavigation();
  const load = useCallback((signal: AbortSignal) => api.workspaceReservations(balanceId, { cursor: navigation.cursor, limit: 25 }, { signal }), [api, balanceId, navigation.cursor]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем резервы" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку резервов</DmButton>} /> : null}
    {resource.data?.items.map(reservation => <p key={reservation.id}>{reservation.quantity} · срок {formatDate(reservation.expiresAt, true)}</p>)}
    {resource.data && !resource.data.items.length ? <p>Активных резервов нет.</p> : null}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
  </>;
}
function Overrides() {
  const { api } = useWorkspace(), navigation = usePageNavigation();
  const load = useCallback((signal: AbortSignal) => api.workspaceOverrides({ cursor: navigation.cursor, limit: 25 }, { signal }), [api, navigation.cursor]);
  const resource = useResource(load);
  return <section><h2>Ручные корректировки</h2><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем корректировки" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку корректировок</DmButton>} /> : null}
    {resource.data?.items.length ? <ul>{resource.data.items.map(override => <li key={override.id}>{override.reason} · {formatStatus(override.status)} · {formatDate(override.createdAt, true)}{override.validUntil ? ` · действует до ${formatDate(override.validUntil, true)}` : ""}</li>)}</ul> : resource.data ? <p>Ручных корректировок нет.</p> : null}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
  </section>;
}
function RecomputeInventory({ onChanged }: { onChanged: () => Promise<void> }) {
  const { api, organizationId } = useWorkspace();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState("");
  const recompute = async () => {
    if (busy) return;
    setBusy(true); setError(null); setNotice("");
    try { await api.post(`/suppliers/${organizationId}/inventory/freshness/recompute`, { staleAfterMinutes: 1440 }); setNotice("Актуальность остатков пересчитана."); await onChanged(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <><DmButton disabled={busy} onClick={() => void recompute()}>Пересчитать актуальность</DmButton>{error ? <ErrorState description={error} /> : null}{notice ? <p role="status">{notice}</p> : null}</>;
}
