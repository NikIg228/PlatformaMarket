"use client";
import { frontendFeatures } from "@marketplace/api-client";
import { Inventory } from "./supplier-inventory";
import { PageNavigation, usePageNavigation } from "./page-navigation";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DmButton, DmField, DmInput, EmptyState, ErrorState, LoadingState, formatStatus } from "@marketplace/ui";
import type { ProductCandidateHistoryResponse } from "@marketplace/schemas";
import { ProductProposals } from "../../../supplier-web/app/features/supplier-workspace/product-proposals";
import { ProductCorrectionsPanel } from "../../../supplier-web/app/product-corrections-panel";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";
import type { SupplierDataSource } from "../../../supplier-web/app/features/supplier-workspace/types";
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
export function SupplierProductLinks() { return <nav aria-label="Разделы товаров" className={styles.actions}>{supplierProductLinks.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}{frontendFeatures.promotions ? <Link href="/supplier/products/promotions">Акции</Link> : null}</nav>; }
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
  const navigation = usePageNavigation();
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const load = useCallback((signal: AbortSignal) => api.workspaceCorrectionOffers({ cursor: navigation.cursor, q, limit: 25 }, { signal }), [api, navigation.cursor, q]);
  const resource = useResource(load, { retainDataOnChange: true });
  if (resource.error && !resource.data) return <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} />;
  if (!resource.data) return <LoadingState label="Загружаем карточки" />;
  return <><form className={styles.actions} onSubmit={event => { event.preventDefault(); navigation.reset(); setQuery(draft.trim()); }}>
    <DmField label="Поиск карточки"><DmInput value={draft} onChange={(_, data) => setDraft(data.value)} /></DmField><DmButton type="submit">Найти</DmButton>
    <DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить карточки</DmButton>
  </form><ResourceStatus resource={resource} /><ProductCorrectionsPanel api={api} supplierId={organizationId} offers={resource.data.items} /><PageNavigation navigation={navigation} nextCursor={resource.data.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} /></>;
}
export function InventoryPage() {
  return <Frame title="Партии и резервы"><PermissionBoundary required={["inventory.view"]}><Inventory /></PermissionBoundary></Frame>;
}
export function SourcesPage() {
  return <div className={styles.stack}><Link href="/supplier/settings">← Настройки организации</Link><h1>Источники товаров</h1><PermissionBoundary required={["import.manage"]}><Sources /></PermissionBoundary></div>;
}
function Sources() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`, { signal }), [api, organizationId]);
  const resource = useResource(load);
  return <section className={styles.panel}><p>Доступные источники для загрузки прайса. Внешнее подключение оформляется отдельно через команду площадки.</p><Link href="/supplier/products?editor=import">Загрузить прайс</Link><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить источники</DmButton>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} /> : !resource.data ? <LoadingState label="Загружаем источники" /> : !resource.data.length ? <EmptyState title="Источников пока нет" description="Создайте источник в форме импорта товаров." /> : <ul>{resource.data.map(source => <li key={source.id}>{source.name} · {formatStatus(source.type)} · {formatStatus(source.status)}</li>)}</ul>}
  </section>;
}
