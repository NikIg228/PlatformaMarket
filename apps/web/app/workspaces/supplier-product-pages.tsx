"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { DmButton, EmptyState, ErrorState, LoadingState, errorMessage, formatDate, formatStatus } from "@marketplace/ui";
import type { ProductCandidateHistoryResponse } from "@marketplace/schemas";
import { ProductProposals } from "../../../supplier-web/app/features/supplier-workspace/product-proposals";
import { ProductCorrectionsPanel } from "../../../supplier-web/app/product-corrections-panel";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";
import type { Offer, Balance, DataOverride, SupplierDataSource } from "../../../supplier-web/app/features/supplier-workspace/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";
import styles from "./workspace.module.css";

export const supplierProductLinks = [
  ["/supplier/products/proposals", "Заявки на новые товары"],
  ["/supplier/products/corrections", "Исправления карточек"],
  ["/supplier/products/inventory", "Партии и резервы"],
] as const;
export function SupplierProductLinks() { return <nav aria-label="Разделы товаров" className={styles.actions}>{supplierProductLinks.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>; }
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={styles.stack}><Link href="/supplier/products">← Все товары</Link><h1>{title}</h1><SupplierProductLinks />{children}</div>;
}
export function ProposalsPage() {
  return <Frame title="Заявки на новые товары"><PermissionBoundary required={["catalog.offer.edit"]}><Proposals /></PermissionBoundary></Frame>;
}
function Proposals() {
  const { api, organizationId } = useWorkspace();
  const [retry, setRetry] = useState<ProductCandidateHistoryResponse["items"][number] | null>(null);
  const [generation, setGeneration] = useState(0);
  const changed = useCallback(async () => { setGeneration(value => value + 1); }, []);
  const noop = useCallback(async () => {}, []);
  return <>
    <ProductProposals key={generation} api={api} onChanged={noop} onRetry={setRetry} />
    {retry ? <section className={styles.panel}><h2>Новая заявка после отказа</h2><p>Проверьте сведения и исправьте причину отказа: {retry.rejectionReason}. Прежнее решение сохранится в истории.</p><DmButton onClick={() => setRetry(null)}>Закрыть форму</DmButton><ManualOffer key={retry.id} api={api} supplierId={organizationId} initiallyOpen initialProposal={retry} onChanged={changed} /></section> : <Link href="/supplier/products">Добавить товар или отправить новую заявку</Link>}
  </>;
}
export function CorrectionsPage() {
  return <Frame title="Исправления карточек"><PermissionBoundary required={["catalog.product.view", "catalog.offer.edit"]}><Corrections /></PermissionBoundary></Frame>;
}
function Corrections() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(() => api.get<Offer[]>(`/suppliers/${organizationId}/offers`), [api, organizationId]);
  const resource = useResource(load);
  if (resource.error && !resource.data) return <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} />;
  if (!resource.data) return <LoadingState label="Загружаем карточки" />;
  return <><ResourceStatus resource={resource} /><ProductCorrectionsPanel api={api} supplierId={organizationId} offers={resource.data} /></>;
}
type InventoryRow = Balance & { reservations: Array<{ id: string; quantity: string; expiresAt: string }> };
export function InventoryPage() {
  return <Frame title="Партии и резервы"><PermissionBoundary required={["inventory.view"]}><Inventory /></PermissionBoundary></Frame>;
}
function Inventory() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const [balances, overrides] = await Promise.all([api.get<InventoryRow[]>(`/suppliers/${organizationId}/inventory/balances`), api.get<DataOverride[]>(`/suppliers/${organizationId}/inventory/overrides`)]);
    return { balances, overrides };
  }, [api, organizationId]);
  const resource = useResource(load);
  return <section className={styles.panel}>
    <p>Остатки меняются в редакторе предложения с проверкой версии. Активные резервы учитываются автоматически.</p>
    <DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить остатки</DmButton>
    <PermissionBoundary required={["inventory.freshness.manage"]}><RecomputeInventory onChanged={resource.refresh} /></PermissionBoundary>
    <p>Срок первичного резерва может быть продлён заявленной оплатой. Статус оплаты показан в заказе.</p>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} /> : !resource.data ? <LoadingState label="Загружаем остатки" /> : !resource.data.balances.length ? <EmptyState title="Остатков пока нет" description="Добавьте предложение и укажите остаток по складу." /> :
      <div className={styles.scroll}><table className={styles.table}><caption>Остатки, партии и активные резервы</caption><thead><tr><th>Товар и склад</th><th>На складе / доступно / резерв</th><th>Партии</th><th>Резервы</th></tr></thead><tbody>{resource.data.balances.map(balance => <tr key={balance.id}>
        <td>{balance.productVariant.product.canonicalName}<small>{balance.warehouse.name}</small><Link href={`/supplier/products?offer=${balance.offerId ?? ""}`}>Редактировать предложение</Link></td>
        <td>{balance.quantityOnHand} / {balance.quantityAvailable} / {balance.quantityReserved}<small>Страховой запас: {balance.safetyStock}</small><small>{formatStatus(balance.freshnessStatus)} · обновлено {formatDate(balance.updatedAt, true)}</small></td>
        <td>{balance.lots.length ? balance.lots.map(lot => <p key={lot.id}>{lot.lotNumber} · {formatStatus(lot.status)} · доступно {lot.quantityAvailable}<small>Годен до: {lot.expirationDate ? formatDate(lot.expirationDate) : "не указано"}</small></p>) : "Партий нет"}</td>
        <td>{balance.reservations.length ? balance.reservations.map(reservation => <p key={reservation.id}>{reservation.quantity} · срок {formatDate(reservation.expiresAt, true)}</p>) : "Активных резервов нет"}</td>
      </tr>)}</tbody></table></div>}
    {resource.data ? <section><h2>Ручные корректировки</h2>{resource.data.overrides.length ? <ul>{resource.data.overrides.map(override => <li key={override.id}>{override.reason} · {formatStatus(override.status)} · {formatDate(override.createdAt, true)}{override.validUntil ? ` · действует до ${formatDate(override.validUntil, true)}` : ""}</li>)}</ul> : <p>Ручных корректировок нет.</p>}</section> : null}
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
export function SourcesPage() {
  return <div className={styles.stack}><Link href="/supplier/settings">← Настройки организации</Link><h1>Источники товаров</h1><PermissionBoundary required={["import.manage"]}><Sources /></PermissionBoundary></div>;
}
function Sources() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(() => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`), [api, organizationId]);
  const resource = useResource(load);
  return <section className={styles.panel}><p>Доступные источники для загрузки прайса. Внешнее подключение оформляется отдельно через команду площадки.</p><Link href="/supplier/products?editor=import">Загрузить прайс</Link><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить источники</DmButton>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} /> : !resource.data ? <LoadingState label="Загружаем источники" /> : !resource.data.length ? <EmptyState title="Источников пока нет" description="Создайте источник в форме импорта товаров." /> : <ul>{resource.data.map(source => <li key={source.id}>{source.name} · {formatStatus(source.type)} · {formatStatus(source.status)}</li>)}</ul>}
  </section>;
}
