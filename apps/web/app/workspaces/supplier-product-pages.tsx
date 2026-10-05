"use client";
import Link from "next/link";
import { useCallback } from "react";
import { DmButton, EmptyState, ErrorState, LoadingState, formatStatus } from "@marketplace/ui";
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

export function AddProductPage() {
  return <PermissionBoundary required={["catalog.offer.edit", "catalog.product.view"]}>{null}</PermissionBoundary>;
}
export function ImportProductsPage() {
  return <PermissionBoundary required={["import.manage"]}>{null}</PermissionBoundary>;
}
export function ProposalsPage() {
  return <PermissionBoundary required={["catalog.offer.edit"]}>{null}</PermissionBoundary>;
}
export function CorrectionsPage() {
  return <PermissionBoundary required={["catalog.product.view", "catalog.offer.edit"]}>{null}</PermissionBoundary>;
}
export function InventoryPage() {
  return <PermissionBoundary required={["inventory.view"]}>{null}</PermissionBoundary>;
}
export function SourcesPage() {
  return <div className={styles.stack}><Link href="/supplier/settings">← Настройки организации</Link><PermissionBoundary required={["import.manage"]}><Sources /></PermissionBoundary></div>;
}
function Sources() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`, { signal }), [api, organizationId]);
  const resource = useResource(load);
  return <section className={styles.panel}><p>Доступные источники для загрузки прайса. Внешнее подключение оформляется отдельно через команду площадки.</p><Link href="/supplier/products/import">Загрузить прайс</Link><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить источники</DmButton>
    <ResourceStatus resource={resource} />
    {resource.error && !resource.data ? <ErrorState description={resource.error} /> : !resource.data ? <LoadingState label="Загружаем источники" /> : !resource.data.length ? <EmptyState title="Источников пока нет" description="Создайте источник в форме импорта товаров." /> : <ul>{resource.data.map(source => <li key={source.id}>{source.name} · {formatStatus(source.type)} · {formatStatus(source.status)}</li>)}</ul>}
  </section>;
}
