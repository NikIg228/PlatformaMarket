"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { frontendFeatures } from "@marketplace/api-client";
import type { PromotionListQuery, PublicPromotion } from "@marketplace/schemas";
import { DmButton, DmSearch, DmSelect, EmptyState } from "@marketplace/ui";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { fetchLiveCatalog } from "../../catalog/live-search";
import type { SearchResult } from "../../catalog-search-types";
import { usePromotionPage } from "./use-promotion-page";
import { PromotionBanner } from "./promotion-banner";
import { activePromotions } from "./promotion-display";
import { localPromotionPreviews, previewPromotionCategories, previewPromotionSuppliers, type PromotionPreview } from "./local-promotion-previews";
import { PromotionPreviewBanner } from "./promotion-preview-banner";
import styles from "./promotions-page.module.css";

type Filters = Pick<PromotionListQuery, "q" | "categoryId" | "supplierOrganizationId" | "kind" | "sort">;
const initial: Filters = { sort: "NEWEST" };
export default function PromotionsPage() {
  const [filters, setFilters] = useState<Filters>(initial);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [offset, setOffset] = useState(0);
  const [facets, setFacets] = useState<SearchResult["filterOptions"]>();
  const [facetsFailed, setFacetsFailed] = useState(false);
  const [facetAttempt, setFacetAttempt] = useState(0);
  const [collection, setCollection] = useState<{ key: string; items: PublicPromotion[] }>({ key: "", items: [] });
  const key = JSON.stringify(filters);
  const data = usePromotionPage({ ...filters, offset, limit: 12 }, ready && frontendFeatures.promotions);
  // A filtered empty response must never replace real campaigns with examples.
  const previewProbe = usePromotionPage({ offset: 0, limit: 1 }, ready && frontendFeatures.promotions && process.env.NODE_ENV === "development");
  const previewMode = previewProbe.page?.total === 0 && data.page?.total === 0;
  useEffect(() => {
    const restore = () => {
      const p = new URLSearchParams(window.location.search), kind = p.get("kind");
      const uuid = (name: string) => /^[0-9a-f-]{36}$/i.test(p.get(name) ?? "") ? p.get(name)! : undefined;
      setFilters({ q: p.get("q")?.slice(0, 160) || undefined, categoryId: uuid("categoryId"), supplierOrganizationId: uuid("supplierOrganizationId"),
        kind: kind === "PERCENTAGE" || kind === "FIXED_AMOUNT" || kind === "BUY_X_GET_Y" ? kind : undefined,
        sort: p.get("sort") === "ENDING" ? "ENDING" : "NEWEST" });
      setDraft(p.get("q")?.slice(0, 160) ?? ""); setOffset(0); setCollection({ key: "", items: [] }); setReady(true);
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!frontendFeatures.promotions) return;
    const controller = new AbortController(); setFacetsFailed(false);
    fetchLiveCatalog<SearchResult>(new URLSearchParams({ limit: "1", offset: "0", includeFilterOptions: "true" }), controller.signal)
      .then(result => { if (!controller.signal.aborted) setFacets(result.filterOptions); })
      .catch(() => { if (!controller.signal.aborted) setFacetsFailed(true); });
    return () => controller.abort();
  }, [facetAttempt]);
  useEffect(() => {
    if (!data.page) return;
    setCollection(previous => ({ key, items: [...new Map([
      ...(offset && previous.key === key ? previous.items : []), ...data.page!.items,
    ].map(item => [item.id, item])).values()] }));
  }, [data.page, key, offset]);
  const change = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch }; setFilters(next); setOffset(0); setCollection({ key: "", items: [] });
    const params = new URLSearchParams(Object.entries(next).filter(([, value]) => Boolean(value)).map(([k, value]) => [k, String(value)]));
    window.history.pushState(window.history.state, "", `/promotions${params.size ? `?${params}` : ""}`);
  };
  // usePromotionPage's expiry tick also updates this collection, including older pages.
  const items = activePromotions(collection.key === key ? collection.items : []);
  const displayed: (PublicPromotion | PromotionPreview)[] = previewMode ? localPromotionPreviews(filters) : items;
  const categories = previewMode ? previewPromotionCategories : facets?.categories;
  const suppliers = previewMode ? previewPromotionSuppliers : facets?.suppliers;
  const render = (item: PublicPromotion | PromotionPreview, index: number) => {
    const size = index === 0 ? "hero" : index % 5 === 0 ? "wide" : "regular";
    return "terms" in item ? <PromotionBanner key={item.id} item={item} size={size} /> : <PromotionPreviewBanner key={item.id} item={item} size={size} />;
  };
  return <><MarketplaceHeader showCity={false} /><main className={styles.page} aria-label="Акции">
    <Link href="/catalog">← В каталог</Link>
    <div className={styles.heading}><h1>Акции</h1><p>Предложения поставщиков для вашей клиники</p></div>
    {!frontendFeatures.promotions ? <EmptyState title="Акции пока недоступны" description="Товары можно посмотреть в каталоге." /> : <>
      <div className={styles.filters} aria-label="Поиск и фильтрация акций">
        <DmSearch aria-label="Поиск акций" placeholder="Найти акцию" value={draft} onChange={setDraft} onSearch={q => change({ q: q.trim().slice(0, 160) || undefined })} />
        <DmSelect aria-label="Категория акций" value={filters.categoryId ?? ""} onChange={(_, d) => change({ categoryId: d.value || undefined })}><option value="">Все категории</option>{categories?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</DmSelect>
        <DmSelect aria-label="Поставщик акций" value={filters.supplierOrganizationId ?? ""} onChange={(_, d) => change({ supplierOrganizationId: d.value || undefined })}><option value="">Все поставщики</option>{suppliers?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</DmSelect>
        <DmSelect aria-label="Сортировка акций" value={filters.sort} onChange={(_, d) => change({ sort: d.value as Filters["sort"] })}><option value="NEWEST">Сначала новые</option><option value="ENDING">Скоро заканчиваются</option></DmSelect>
      </div>
      {facetsFailed ? <DmButton onClick={() => setFacetAttempt(n => n + 1)}>Повторить загрузку категорий и поставщиков</DmButton> : null}
      <div className={styles.kinds} aria-label="Вид акции">
        {([[undefined, "Все акции"], ["PERCENTAGE", "Скидки в процентах"], ["FIXED_AMOUNT", "Скидки в сумме"], ["BUY_X_GET_Y", "Подарки за покупку"]] as const).map(([kind, label]) => <DmButton key={label} appearance="subtle" aria-pressed={filters.kind === kind} onClick={() => change({ kind })}>{label}</DmButton>)}
      </div>
      {data.error ? <div className={styles.error} role="alert"><p>Не удалось загрузить акции. {items.length ? "Уже загруженные предложения сохранены." : "Попробуйте ещё раз."}</p><DmButton onClick={data.retry}>Повторить загрузку акций</DmButton></div> : null}
      {!ready || (data.loading && !items.length) || (data.page?.total === 0 && previewProbe.loading) ? <p role="status">Загружаем акции…</p> : displayed.length ? <>
        <div className={styles.hero}>{displayed.slice(0, 3).map(render)}</div>
        {displayed.length > 3 ? <><h2 className={styles.sectionTitle}>Все действующие акции</h2><div className={styles.feed}>{displayed.slice(3).map((item, i) => <div key={item.id} className={i % 5 === 2 ? styles.wide : undefined}>{render(item, i + 3)}</div>)}</div></> : null}
      </> : !data.error ? <EmptyState title="Действующих акций нет" description="Измените фильтры или вернитесь позже." /> : null}
      {data.page && offset + data.page.items.length < data.page.total ? <div className={styles.more}><DmButton disabled={data.loading || offset >= 9996} onClick={() => setOffset(n => n + 12)}>Показать ещё акции</DmButton></div> : null}
      {data.loading && items.length ? <p role="status">Загружаем ещё акции…</p> : null}
    </>}
  </main></>;
}
