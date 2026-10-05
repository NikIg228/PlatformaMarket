"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DmButton, DmDropdown, DmSearch, EmptyState, ErrorState, LoadingState, StatusTag, productWorkflowStyles as styles, formatDate, formatStatus, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { useInventoryList } from "./use-inventory-list";
import { InventoryEditor, type InventorySelection } from "./inventory-editor";

export function Inventory() {
  const { api, organizationId } = useWorkspace(), query = useSearchParams();
  const has = usePermissions();
  const [selection, setSelection] = useState<InventorySelection | null>(() => query.get("edit") === "1" && query.get("offer") && query.get("warehouse")
    ? { offerId: query.get("offer")!, warehouseId: query.get("warehouse")!, balanceId: query.get("balance") ?? undefined } : null);
  const [dirty, setDirty] = useState(false);
  const select = (next: InventorySelection | null) => { if (!dirty || window.confirm("Есть несохранённый остаток. Закрыть редактирование?")) { setDirty(false); setSelection(next); } };
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState(query.get("warehouse") ?? ""), [attention, setAttention] = useState(false);
  const [offerId, setOfferId] = useState(query.get("offer") ?? ""), [balanceId, setBalanceId] = useState(query.get("balance") ?? "");
  const loadWarehouses = useCallback(() => api.listSupplierWarehouses(organizationId), [api, organizationId]);
  const warehouses = useResource(loadWarehouses);
  const initialSelection = useRef(false);
  useEffect(() => {
    if (initialSelection.current || query.get("edit") !== "1" || !query.get("offer")) return;
    const targetWarehouse = query.get("warehouse") || warehouses.data?.find(item => item.status === "ACTIVE")?.id;
    if (!targetWarehouse) return;
    initialSelection.current = true;
    setSelection({ offerId: query.get("offer")!, warehouseId: targetWarehouse, balanceId: query.get("balance") ?? undefined });
  }, [query, warehouses.data]);
  const load = useCallback((cursor: string | undefined, signal: AbortSignal) => api.workspaceInventory({ cursor, q, limit: 25, warehouseId: warehouseId || undefined, offerId: offerId || undefined, balanceId: balanceId || undefined, attention: attention ? "required" : undefined }, { signal }), [api, organizationId, q, warehouseId, offerId, balanceId, attention]);
  const { page, loading, error, sentinel, retry, refresh } = useInventoryList(load);
  return <div className={styles.form}>
    <div className={styles.filterToolbar}>
      <DmSearch aria-label="Поиск товара" placeholder="Найти товар" value={draft} onChange={setDraft} onSearch={setQuery} />
      <DmDropdown aria-label="Склад" value={warehouseId} disabled={warehouses.initialLoading} onChange={(_, data) => setWarehouseId(data.value)}><option value="">Все склады</option>{warehouses.data?.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</DmDropdown>
      <DmDropdown aria-label="Актуальность остатка" value={attention ? "attention" : "all"} onChange={(_, data) => setAttention(data.value === "attention")}><option value="all">Все остатки</option><option value="attention">Требуют внимания</option></DmDropdown>
    </div>
    {offerId || balanceId ? <div className={styles.toolbar}><p className={styles.hint}>Показаны остатки выбранного предложения.</p><DmButton onClick={() => { setOfferId(""); setBalanceId(""); }}>Показать все товары</DmButton></div> : null}
    {selection ? <InventoryEditor key={`${organizationId}:${selection.offerId}:${selection.warehouseId}`} selection={selection} warehouseName={warehouses.data?.find(item => item.id === selection.warehouseId)?.name} onClose={() => select(null)} onSaved={refresh} onDirtyChange={setDirty} /> : null}
    {warehouses.error ? <ErrorState description={warehouses.error} action={<DmButton onClick={() => void warehouses.refresh()}>Повторить загрузку складов</DmButton>} /> : null}
    {page?.items.length ? <section className={styles.panel}>
        <table className={`${styles.table} ${styles.inventoryTable}`}><caption className="dm-sr-only">Остатки по складам</caption><thead><tr><th>Товар</th><th>Склад</th><th className={styles.number}>На складе</th><th className={styles.number}>В резерве</th><th className={styles.number}>Доступно</th><th>Актуальность</th></tr></thead><tbody>{page.items.map(balance => {
          const unit = balance.offer?.saleUnit?.symbol ?? "";
          const expired = balance.freshnessExpiresAt && new Date(balance.freshnessExpiresAt) <= new Date();
          return <tr key={balance.id} data-selected={selection?.balanceId === balance.id}><td data-label="Товар"><div><strong>{balance.productVariant.product.canonicalName}</strong><small>{balance.offer?.packaging?.name ?? unit}</small>{balance.offerId && has("inventory.adjust") ? <DmButton appearance="subtle" onClick={() => select({ offerId: balance.offerId!, warehouseId: balance.warehouse.id, balanceId: balance.id })}>Изменить остаток</DmButton> : null}</div></td><td data-label="Склад"><div>{balance.warehouse.name}</div></td><td data-label="На складе" className={styles.number}><div>{balance.quantityOnHand} {unit}</div></td><td data-label="В резерве" className={styles.number}><div>{balance.quantityReserved} {unit}</div></td><td data-label="Доступно" className={styles.number}><div><strong>{balance.quantityAvailable} {unit}</strong><small>Страховой запас: {balance.safetyStock}</small></div></td><td data-label="Актуальность"><div><StatusTag tone={balance.freshnessStatus === "FRESH" && !expired ? "success" : "warning"}>{expired ? "Нужно подтвердить" : formatStatus(balance.freshnessStatus)}</StatusTag><small>{formatDate(balance.updatedAt, true)}</small></div></td></tr>;
        })}</tbody></table>
    </section> : page ? <div className={styles.panel}><EmptyState title="Остатки не найдены" description="Измените поиск или откройте обновление остатков из карточки товара." /></div> : null}
    {error ? <ErrorState description={error} action={<DmButton onClick={() => void retry()}>Повторить загрузку остатков</DmButton>} /> : null}
    {loading ? <LoadingState label="Загружаем остатки" /> : null}
    <div ref={sentinel} aria-hidden="true" />
  </div>;
}
