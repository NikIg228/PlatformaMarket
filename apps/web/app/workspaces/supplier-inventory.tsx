"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { DmButton, DmDropdown, DmField, DmInput, EmptyState, ErrorState, LoadingState, StatusTag, productWorkflowStyles as styles, errorMessage, formatDate, formatStatus, usePermissions } from "@marketplace/ui";
import { Tab, TabList } from "@fluentui/react-components";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";
import { PageNavigation, usePageNavigation } from "./page-navigation";

export function Inventory() {
  const { api, organizationId } = useWorkspace(), query = useSearchParams();
  const navigation = usePageNavigation();
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const [tab, setTab] = useState(query.get("tab") === "lots" ? "lots" : query.get("tab") === "reservations" ? "reservations" : "balances");
  const [warehouseId, setWarehouseId] = useState(query.get("warehouse") ?? ""), [attention, setAttention] = useState(false);
  const [offerId, setOfferId] = useState(query.get("offer") ?? ""), [balanceId, setBalanceId] = useState(query.get("balance") ?? "");
  const [selectedBalance, setSelectedBalance] = useState(query.get("balance") ?? ""), [historyOpen, setHistoryOpen] = useState(false);
  const loadWarehouses = useCallback(() => api.listSupplierWarehouses(organizationId), [api, organizationId]);
  const warehouses = useResource(loadWarehouses);
  const load = useCallback((signal: AbortSignal) => api.workspaceInventory({ cursor: navigation.cursor, q, limit: 25, warehouseId: warehouseId || undefined, offerId: offerId || undefined, balanceId: balanceId || undefined, attention: attention ? "required" : undefined }, { signal }), [api, navigation.cursor, q, warehouseId, offerId, balanceId, attention]);
  const resource = useResource(load);
  const selected = resource.data?.items.find(balance => balance.id === selectedBalance);
  const detail = (id: string, next: string) => { setSelectedBalance(id); setTab(next); };
  return <div className={styles.form}>
    <TabList aria-label="Учёт запасов" selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}><Tab value="balances">Остатки</Tab><Tab value="lots">Партии</Tab><Tab value="reservations">Резервы</Tab></TabList>
    <form className={styles.inventoryToolbar} onSubmit={event => { event.preventDefault(); navigation.reset(); setSelectedBalance(""); setQuery(draft.trim()); }}>
      <DmInput aria-label="Поиск товара" placeholder="Поиск по названию товара" value={draft} onChange={(_, data) => setDraft(data.value)} />
      <DmDropdown aria-label="Склад" value={warehouseId} disabled={warehouses.initialLoading} onChange={(_, data) => { navigation.reset(); setSelectedBalance(""); setWarehouseId(data.value); }}><option value="">Все склады</option>{warehouses.data?.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</DmDropdown>
      <DmDropdown aria-label="Актуальность остатка" value={attention ? "attention" : "all"} onChange={(_, data) => { navigation.reset(); setSelectedBalance(""); setAttention(data.value === "attention"); }}><option value="all">Все остатки</option><option value="attention">Требуют внимания</option></DmDropdown><DmButton type="submit">Найти</DmButton>
    </form>
    {offerId || balanceId ? <div className={styles.toolbar}><p className={styles.hint}>Показаны остатки выбранного предложения.</p><DmButton onClick={() => { setOfferId(""); setBalanceId(""); setSelectedBalance(""); navigation.reset(); }}>Показать все товары</DmButton></div> : null}
    {warehouses.error ? <ErrorState description={warehouses.error} action={<DmButton onClick={() => void warehouses.refresh()}>Повторить загрузку складов</DmButton>} /> : null}
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : !resource.data ? <LoadingState label="Загружаем остатки" /> : !resource.data.items.length ? <div className={styles.panel}><EmptyState title="Остатки не найдены" description="Измените поиск или добавьте остаток по складу в предложении." /></div> : <>
      {tab !== "balances" ? <section className={`${styles.panel} ${styles.form}`}>
        <h2>{tab === "lots" ? "Партии товара" : "Активные резервы"}</h2>
        <DmField label="Товар и склад"><DmDropdown value={selected?.id ?? ""} onChange={(_, data) => setSelectedBalance(data.value)}><option value="">Выберите товар и склад</option>{resource.data.items.map(balance => <option value={balance.id} key={balance.id}>{balance.productVariant.product.canonicalName} · {balance.warehouse.name}</option>)}</DmDropdown></DmField>
        {selected ? tab === "lots" ? <Lots key={selected.id} balanceId={selected.id} /> : <Reservations key={selected.id} balanceId={selected.id} /> : <p className={styles.hint}>Выберите остаток, чтобы посмотреть {tab === "lots" ? "партии и сроки годности" : "резервы и связанные заказы"}.</p>}
      </section> : <section className={styles.panel}>
        <table className={`${styles.table} ${styles.inventoryTable}`}><caption className="dm-sr-only">Остатки по складам</caption><thead><tr><th>Товар</th><th>Склад</th><th className={styles.number}>На складе</th><th className={styles.number}>В резерве</th><th className={styles.number}>Доступно</th><th>Актуальность</th></tr></thead><tbody>{resource.data.items.map(balance => {
          const unit = balance.offer?.saleUnit?.symbol ?? "";
          const expired = balance.freshnessExpiresAt && new Date(balance.freshnessExpiresAt) <= new Date();
          return <tr key={balance.id}><td data-label="Товар"><div>{balance.offerId ? <Link href={`/supplier/products?offer=${balance.offerId}`}><strong>{balance.productVariant.product.canonicalName}</strong></Link> : <strong>{balance.productVariant.product.canonicalName}</strong>}<small>{balance.offer?.packaging?.name ?? unit}</small><div style={{ display: "flex", gap: 16, marginTop: 8 }}><button className={styles.textButton} onClick={() => detail(balance.id, "lots")}>Партии</button><button className={styles.textButton} onClick={() => detail(balance.id, "reservations")}>Резервы</button></div></div></td><td data-label="Склад"><div>{balance.warehouse.name}</div></td><td data-label="На складе" className={styles.number}><div>{balance.quantityOnHand} {unit}</div></td><td data-label="В резерве" className={styles.number}><div>{balance.quantityReserved} {unit}</div></td><td data-label="Доступно" className={styles.number}><div><strong>{balance.quantityAvailable} {unit}</strong><small>Страховой запас: {balance.safetyStock}</small></div></td><td data-label="Актуальность"><div><StatusTag tone={balance.freshnessStatus === "FRESH" && !expired ? "success" : "warning"}>{expired ? "Нужно подтвердить" : formatStatus(balance.freshnessStatus)}</StatusTag><small>{formatDate(balance.updatedAt, true)}</small></div></td></tr>;
        })}</tbody></table>
      </section>}
    </>}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
    {tab === "balances" ? <details className={styles.disclosure} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>Актуальность и история корректировок</summary>{historyOpen ? <><PermissionBoundary required={["inventory.freshness.manage"]}><RecomputeInventory onChanged={resource.refreshAfterWrite} /></PermissionBoundary><Overrides /></> : null}</details> : null}
  </div>;
}
function Lots({ balanceId }: { balanceId: string }) {
  const { api } = useWorkspace(), navigation = usePageNavigation();
  const load = useCallback((signal: AbortSignal) => api.workspaceLots(balanceId, { cursor: navigation.cursor, limit: 25 }, { signal }), [api, balanceId, navigation.cursor]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем партии" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку партий</DmButton>} /> : null}
    {resource.data?.items.length ? <table className={styles.table}><caption className="dm-sr-only">Партии выбранного товара</caption><thead><tr><th>Партия</th><th>Годен до</th><th>Доступно</th><th>Статус</th></tr></thead><tbody>{resource.data.items.map(lot => <tr key={lot.id}><td data-label="Партия"><div><strong>{lot.lotNumber}</strong></div></td><td data-label="Годен до"><div>{lot.expirationDate ? formatDate(lot.expirationDate) : "Не указан"}</div></td><td data-label="Доступно"><div>{lot.quantityAvailable}</div></td><td data-label="Статус"><div><StatusTag>{formatStatus(lot.status)}</StatusTag></div></td></tr>)}</tbody></table> : resource.data ? <p>Партий нет.</p> : null}
    <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} />
  </>;
}
function Reservations({ balanceId }: { balanceId: string }) {
  const { api } = useWorkspace(), navigation = usePageNavigation(), has = usePermissions();
  const load = useCallback((signal: AbortSignal) => api.workspaceReservations(balanceId, { cursor: navigation.cursor, limit: 25 }, { signal }), [api, balanceId, navigation.cursor]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />
    {!resource.data && !resource.error ? <LoadingState label="Загружаем резервы" /> : null}
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку резервов</DmButton>} /> : null}
    {resource.data?.items.length ? <table className={styles.table}><caption className="dm-sr-only">Активные резервы выбранного товара</caption><thead><tr><th>Заказ</th><th>Количество</th><th>Срок резерва</th></tr></thead><tbody>{resource.data.items.map(reservation => <tr key={reservation.id}><td data-label="Заказ"><div>{reservation.order ? has("order.confirm") ? <Link href={`/supplier/orders/${reservation.order.id}`}>Заказ {reservation.order.orderNumber}</Link> : reservation.order.orderNumber : "Без связанного заказа"}</div></td><td data-label="Количество"><div>{reservation.quantity}</div></td><td data-label="Срок резерва"><div>{formatDate(reservation.expiresAt, true)}</div></td></tr>)}</tbody></table> : resource.data ? <p>Активных резервов нет.</p> : null}
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
