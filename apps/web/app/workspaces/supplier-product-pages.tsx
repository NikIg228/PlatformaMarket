"use client";
import { SpreadsheetImport } from "../../../supplier-web/app/features/supplier-workspace/spreadsheet-import";
import { SettingsSources } from "./settings-sources";
import { Inventory } from "./supplier-inventory";
import { PageNavigation, usePageNavigation } from "./page-navigation";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { DmSearch, DmButton, DmField, DmInput, ErrorState, LoadingState } from "@marketplace/ui";
import type { ProductCandidateHistoryResponse } from "@marketplace/schemas";
import { ProductProposals } from "../../../supplier-web/app/features/supplier-workspace/product-proposals";
import { ProductCorrectionsPanel } from "../../../supplier-web/app/product-corrections-panel";
import { AddOfferWizard } from "../../../supplier-web/app/features/supplier-workspace/add-offer-wizard";
import { ProductProposalForm } from "../../../supplier-web/app/features/supplier-workspace/product-proposal-form";
import type { SupplierDataSource } from "../../../supplier-web/app/features/supplier-workspace/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";
import styles from "./workspace.module.css";

export const supplierProductLinks = [
  ["/supplier/products/proposals", "Заявки на новые товары"],
  ["/supplier/products/corrections", "Исправления карточек"],
  ["/supplier/products/inventory", "Остатки"],
] as const;

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={styles.stack} aria-label={title}>{children}</div>;
}
export function ProposalsPage() {
  return <Frame title="Заявки на новые товары"><PermissionBoundary required={["catalog.offer.edit"]}><Proposals /></PermissionBoundary></Frame>;
}
function Proposals() {
  const { api } = useWorkspace();
  const selectedId = useSearchParams().get("request") ?? undefined;
  const [retry, setRetry] = useState<ProductCandidateHistoryResponse["items"][number] | null>(null);
  const [generation, setGeneration] = useState(0);
  const noop = useCallback(async () => {}, []);
  return retry ? <ProductProposalForm key={retry.id} api={api} initial={retry} onCancel={() => { if (window.confirm("Закрыть форму без отправки?")) setRetry(null); }} onDone={() => setGeneration(value => value + 1)} /> : <ProductProposals hideHeading key={generation} api={api} initialSelected={selectedId} onChanged={noop} onRetry={setRetry} />;
}
export function CorrectionsPage() {
  return <Frame title="Исправления карточек"><PermissionBoundary required={["catalog.product.view", "catalog.offer.edit"]}><Corrections /></PermissionBoundary></Frame>;
}
function Corrections() {
  const { api, organizationId } = useWorkspace();
  const query = useSearchParams(), router = useRouter();
  const offerId = query.get("offer"), createMode = query.get("mode") === "new";
  const navigation = usePageNavigation();
  const [draft, setDraft] = useState(""), [q, setQuery] = useState("");
  const load = useCallback(async (signal: AbortSignal) => {
    const [page, selected] = await Promise.all([
      api.workspaceCorrectionOffers({ cursor: navigation.cursor, q, limit: 25 }, { signal }),
      offerId ? api.workspaceOffer(offerId, { signal }) : Promise.resolve(null),
    ]);
    return { ...page, selected };
  }, [api, navigation.cursor, q, offerId]);
  const resource = useResource(load, { retainDataOnChange: true });
  if (resource.error && !resource.data) return <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} />;
  if (!resource.data) return <LoadingState label="Загружаем карточки" />;
  return <>{resource.error || resource.loading || resource.offline ? <ResourceStatus resource={resource} /> : null}<ProductCorrectionsPanel hideHeading api={api} supplierId={organizationId} offers={resource.data.items} initialOffer={resource.data.selected ?? undefined} createMode={createMode}
    onModeChange={create => router.replace(`/supplier/products/corrections${create ? "?mode=new" : ""}`)}
    selectionControls={<><DmSearch aria-label="Поиск карточки" placeholder="Найти товар" value={draft} onChange={setDraft} onSearch={value => { navigation.reset(); setQuery(value); }} /><PageNavigation navigation={navigation} nextCursor={resource.data.nextCursor} loading={resource.loading} onRefresh={() => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); }} /></>}
  /></>;
}
export function InventoryPage() {
  return <Frame title="Остатки"><PermissionBoundary required={["inventory.view"]}><Inventory /></PermissionBoundary></Frame>;
}
export function SourcesPage() {
  return <div className={styles.stack}><Link href="/supplier/settings">← Настройки организации</Link><PermissionBoundary required={["import.manage"]}><SettingsSources /></PermissionBoundary></div>;
}
export function AddProductPage() {
  return <Frame title="Добавить товар"><PermissionBoundary required={["catalog.offer.edit", "catalog.product.view"]}><AddProduct /></PermissionBoundary></Frame>;
}
function AddProduct() {
  const { api, organizationId } = useWorkspace();
  const request = useSearchParams().get("request") === "1";
  return request ? <ProductProposalForm api={api} /> : <AddOfferWizard api={api} supplierId={organizationId} />;
}
export function ImportProductsPage() {
  return <Frame title="Загрузить из файла"><PermissionBoundary required={["import.manage"]}><ImportProducts /></PermissionBoundary></Frame>;
}
function ImportProducts() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`, { signal }), [api, organizationId]);
  const sources = useResource(load);
  return <>{sources.error && !sources.data ? <ErrorState description={sources.error} action={<DmButton onClick={() => void sources.refresh()}>Повторить</DmButton>} /> : !sources.data ? <LoadingState label="Загружаем настройки импорта" /> : <SpreadsheetImport hideHeading api={api} supplierId={organizationId} sources={sources.data} onChanged={sources.refreshAfterWrite} />}</>;
}
