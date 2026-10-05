"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { DmButton, DmDropdown, DmField, DmInput, DmTable, EmptyState, ErrorState, LoadingState, errorMessage, formatDate, formatStatus, usePermissions } from "@marketplace/ui";
import { Tab, TabList } from "@fluentui/react-components";
import type { WorkspaceInventoryPage } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";
import { PageNavigation, usePageNavigation } from "./page-navigation";
import styles from "./workspace.module.css";

export function Inventory() {
  const { api, organizationId } = useWorkspace();
  const navigation = usePageNavigation();
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const [tab, setTab] = useState("balances"), [warehouseId, setWarehouseId] = useState("");
  const loadWarehouses = useCallback(() => api.listSupplierWarehouses(organizationId), [api, organizationId]);
  const warehouses = useResource(loadWarehouses);
  const load = useCallback((signal: AbortSignal) => api.workspaceInventory({ cursor: navigation.cursor, q, limit: 25, warehouseId: warehouseId || undefined }, { signal }), [api, navigation.cursor, q, warehouseId]);
  const resource = useResource(load);
  return <section className={styles.panel}>
    <TabList aria-label="Учёт запасов" selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}><Tab value="balances">Остатки</Tab><Tab value="lots">Партии</Tab><Tab value="reservations">Резервы</Tab></TabList>
    <form className={styles.toolbar} onSubmit={event => { event.preventDefault(); navigation.reset(); setQuery(draft.trim()); }}>
      <DmField label="Поиск товара"><DmInput value={draft} onChange={(_, data) => setDraft(data.value)} /></DmField>
      <DmField label="Склад"><DmDropdown value={warehouseId} disabled={warehouses.initialLoading} onChange={(_, data) => { navigation.reset(); setWarehouseId(data.value); }}><option value="">Все склады</option>{warehouses.data?.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</DmDropdown></DmField><DmButton type="submit">Найти</DmButton>
    </form>
    {warehouses.error ? <ErrorState description={warehouses.error} action={<DmButton onClick={() => void warehouses.refresh()}>Повторить загрузку складов</DmButton>} /> : null}
    {tab === "reservations" ? <p>Показаны активные резервы. Подробности оплаты — в связанном заказе.</p> : null}
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : !resource.data ? <LoadingState label="Загружаем остатки" /> : !resource.data.items.length ? <EmptyState title="Остатки не найдены" description="Измените поиск или добавьте остаток по складу в предложении." /> :
      <DmTable caption={tab === "balances" ? "Остатки по складам" : tab === "lots" ? "Партии по складам" : "Активные резервы"} columns={[{ key: "product", label: "Товар и склад" }, { key: "data", label: tab === "balances" ? "Остаток" : tab === "lots" ? "Партии" : "Резервы" }]}>{resource.data.items.map(balance => <InventoryRow key={`${tab}:${balance.id}`} balance={balance} tab={tab} />)}</DmTable>}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
    {tab === "balances" ? <details><summary>Актуальность и история корректировок</summary><PermissionBoundary required={["inventory.freshness.manage"]}><RecomputeInventory onChanged={resource.refreshAfterWrite} /></PermissionBoundary><Overrides /></details> : null}
  </section>;
}
function InventoryRow({ balance, tab }: { balance: WorkspaceInventoryPage["items"][number]; tab: string }) {
  const [lotsOpen, setLotsOpen] = useState(false), [reservationsOpen, setReservationsOpen] = useState(false);
  return <tr>
    <td data-label="Товар и склад"><div><strong>{balance.productVariant.product.canonicalName}</strong><p>{balance.warehouse.name}</p>{balance.offerId ? <Link href={`/supplier/products?offer=${balance.offerId}`}>Открыть предложение</Link> : null}</div></td>
    {tab === "balances" ? <td data-label="Остаток"><div><strong>Доступно: {balance.quantityAvailable}</strong><p>На складе: {balance.quantityOnHand} · в резерве: {balance.quantityReserved}</p><small>Страховой запас: {balance.safetyStock}<br />{formatStatus(balance.freshnessStatus)} · {formatDate(balance.updatedAt, true)}</small></div></td> : tab === "lots" ?
    <td data-label="Партии"><div><DmButton aria-expanded={lotsOpen} onClick={() => setLotsOpen(value => !value)}>{lotsOpen ? "Скрыть партии" : "Показать партии"}</DmButton>{lotsOpen ? <Lots balanceId={balance.id} /> : null}</div></td> :
    <td data-label="Резервы"><div><DmButton aria-expanded={reservationsOpen} onClick={() => setReservationsOpen(value => !value)}>{reservationsOpen ? "Скрыть резервы" : "Показать резервы"}</DmButton>{reservationsOpen ? <Reservations balanceId={balance.id} /> : null}</div></td>}
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
  const has = usePermissions();
  const load = useCallback((signal: AbortSignal) => api.workspaceReservations(balanceId, { cursor: navigation.cursor, limit: 25 }, { signal }), [api, balanceId, navigation.cursor]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем резервы" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку резервов</DmButton>} /> : null}
    {resource.data?.items.map(reservation => <div key={reservation.id}><p>Количество: {reservation.quantity} · срок {formatDate(reservation.expiresAt, true)}</p>{reservation.order ? has("order.confirm") ? <Link href={`/supplier/orders/${reservation.order.id}`}>Заказ {reservation.order.orderNumber}</Link> : <p>Заказ {reservation.order.orderNumber}</p> : <p>Без связанного заказа</p>}</div>)}
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
