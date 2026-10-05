"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkspaceOffer } from "@marketplace/schemas";
import { DmButton, DmDropdown, DmSearch, EmptyState, ErrorState, LoadingState, StatusTag, formatMoney, formatStatus } from "@marketplace/ui";
import { Tab, TabList } from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons/svg/chevron-right";
import { Filter20Regular } from "@fluentui/react-icons/svg/filter";
import { ProductActions } from "./product-actions";
import { OfferPanel } from "./offer-panel";
import { offerAttention, totalAvailable } from "./offer-summary";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PageNavigation } from "./page-navigation";
import { useProductListState } from "./product-list-state";
import styles from "./products.module.css";

export default function Products() {
  const { api, organizationId } = useWorkspace();
  const { navigation, query, appliedQuery, attentionOnly, status, change } = useProductListState(organizationId);
  const setQuery = (value: string) => change("query", value), setAppliedQuery = (value: string) => change("appliedQuery", value);
  const setAttentionOnly = (value: boolean) => change("attentionOnly", value), setStatus = (value: typeof status) => change("status", value);
  const [filterOpen, setFilterOpen] = useState(false);
  const [offer, setOffer] = useState<WorkspaceOffer | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const load = useCallback((signal: AbortSignal) => api.workspaceOffers({ q: appliedQuery, cursor: navigation.cursor, publication: status || undefined, attention: attentionOnly ? "required" : undefined }, { signal }), [api, organizationId, appliedQuery, navigation.cursor, status, attentionOnly]);
  const resource = useResource(load);
  const searchParams = useSearchParams(), selectedOfferId = searchParams.get("offer");
  const loadSelected = useCallback((signal: AbortSignal) => selectedOfferId ? api.workspaceOffer(selectedOfferId, { signal }) : Promise.resolve(null), [api, organizationId, selectedOfferId]);
  const selected = useResource(loadSelected, { automatic: false });
  const appliedSelection = useRef<string | null>(null);
  useEffect(() => {
    if (selectedOfferId && selected.data?.id === selectedOfferId && appliedSelection.current !== selectedOfferId) {
      appliedSelection.current = selectedOfferId; setOffer(selected.data);
    }
    if (!selectedOfferId) appliedSelection.current = null;
  }, [selectedOfferId, selected.data]);
  const items = resource.data?.items ?? [];
  const visible = items;
  const refresh = () => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); };
  const open = (item: WorkspaceOffer, target: HTMLElement) => { trigger.current = target; setOffer(item); };
  return <div className={styles.page}>
    <ProductActions />
    {selectedOfferId && selected.error ? <ErrorState description={selected.error} action={<DmButton onClick={() => void selected.refresh()}>Повторить загрузку предложения</DmButton>} /> : null}
    <section className={styles.listPanel} aria-label="Список товаров">
      <div className={styles.filters}>
        <DmSearch aria-label="Поиск по товарам" placeholder="Найти товар" value={query} onChange={setQuery} onSearch={value => { navigation.reset(); setAppliedQuery(value); }} />
        <div className={styles.statusFilter} data-open={filterOpen}><DmDropdown aria-label="Публикация" value={status} onChange={(_, data) => { navigation.reset(); setStatus(data.value as typeof status); }}><option value="">Все статусы</option><option value="published">В каталоге</option><option value="hidden">Не опубликованы</option></DmDropdown></div>
      </div>
      <div className={styles.listHeader}><TabList selectedValue={attentionOnly ? "attention" : "all"} onTabSelect={(_, data) => { navigation.reset(); setAttentionOnly(data.value === "attention"); }} aria-label="Актуальность товаров"><Tab value="all">Все товары</Tab><Tab value="attention">Требуют внимания</Tab></TabList><DmButton className={styles.statusToggle} icon={<Filter20Regular />} appearance={status ? "primary" : "secondary"} aria-label="Фильтр публикации" aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)} /><div className={styles.updateStatus}><ResourceStatus resource={resource} /></div></div>
      {resource.error && resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить обновление</DmButton>} /> : null}
      {resource.error && !resource.data ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : resource.initialLoading ? <LoadingState label="Загружаем товары" /> : !visible.length ? <EmptyState title={appliedQuery || navigation.cursor || attentionOnly || status ? "Товары не найдены" : "Добавьте первое предложение"} description={appliedQuery || attentionOnly || status ? "Измените поиск или фильтры." : "Создайте предложение вручную или загрузите товары из файла."} /> :
      <table className={styles.offerTable}>
        <thead><tr><th>Товар</th><th>Цена</th><th>Доступно</th><th>Публикация</th><th><span className={styles.srOnly}>Подробности</span></th></tr></thead>
        <tbody>{visible.map(item => {
          const price = item.prices.find(value => value.status === "ACTIVE");
          const warning = offerAttention(item);
          return <tr key={item.id}>
            <td className={styles.identity}><button className={styles.productName} onClick={event => open(item, event.currentTarget)}>{item.productVariant.product.canonicalName}</button><small>{item.supplierSku ?? "Без артикула"} · {item.packaging?.name ?? item.saleUnit?.nameRu ?? "Упаковка не указана"}</small></td>
            <td className={styles.price} data-label="Цена"><span>{price ? formatMoney(price.amountMinor, price.currency) : "Не задана"}{price ? ` / ${item.saleUnit?.symbol ?? "ед."}` : ""}</span>{warning.priceWarning ? <small className={styles.warning}>{warning.priceWarning}</small> : null}</td>
            <td className={styles.available} data-label="Доступно"><span>{item.inventoryBalances.length ? totalAvailable(item) : "—"} {item.saleUnit?.symbol ?? "ед."}</span>{warning.stockWarning ? <small className={styles.warning}>{warning.stockWarning}</small> : null}</td>
            <td className={styles.publication} data-label="Публикация"><StatusTag tone={item.publication?.marketplaceVisible ? "success" : "neutral"}>{item.publication?.marketplaceVisible ? "В каталоге" : formatStatus(item.publication?.status ?? item.status)}</StatusTag>{item.publication?.blockedReason ? <small className={styles.warning}>{item.publication.blockedReason}</small> : null}</td>
            <td className={styles.openCell}><DmButton appearance="subtle" aria-label={`Подробнее: ${item.productVariant.product.canonicalName}`} icon={<ChevronRight20Regular />} iconPosition="after" onClick={event => open(item, event.currentTarget)}><span className={styles.mobileDetailLabel}>Подробнее</span></DmButton></td>
          </tr>;
        })}</tbody>
      </table>}
      <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={refresh} />
    </section>
    <OfferPanel offer={offer} initiallyEditing={Boolean(selectedOfferId && offer?.id === selectedOfferId && searchParams.get("edit") === "1")} onClose={() => { setOffer(null); requestAnimationFrame(() => trigger.current?.focus()); }} onChanged={async () => { await resource.refreshAfterWrite(); if (offer) setOffer(await api.workspaceOffer(offer.id)); }} />
  </div>;
}
