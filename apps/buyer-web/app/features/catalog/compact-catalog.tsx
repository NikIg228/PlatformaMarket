"use client";
import { useRef, useState, type ReactNode } from "react";
import { ActionFeedback, DmButton } from "@marketplace/ui";
import type { SearchResult, SearchMedia } from "../../catalog-search-types";
import { marketplaceCatalogUrl, type MarketplaceCatalogState } from "../../catalog/marketplace-url";
import { CompactProductCard } from "./compact-product-card";
import { activeFilters, catalogFilters, emptyFilters, type FilterOptions, type FilterPatch } from "./catalog-filter-model";
import { CatalogFilterToolbar } from "./catalog-filter-toolbar";
import { CatalogFilterDialog, type LoadFilterOptions } from "./catalog-filter-dialog";
import { FilterChoice } from "./catalog-filter-controls";
import styles from "./compact-catalog.module.css";
import filtersStyles from "./catalog-filters.module.css";

const sortChoices = [
  { id: "RELEVANCE", name: "По умолчанию" }, { id: "PRICE_ASC", name: "Сначала дешевле" },
  { id: "PRICE_DESC", name: "Сначала дороже" }, { id: "NAME_ASC", name: "По названию" },
  { id: "UPDATED_DESC", name: "По обновлению" },
];

type Props = {
  promotions?: ReactNode;
  result: SearchResult | null; state: MarketplaceCatalogState; returnUrl: string;
  loading: boolean; error: string | null; loadingMore: boolean;
  onMore: () => void; onRetry: () => void; onLoadFilterOptions: LoadFilterOptions;
  imageSource: (media?: SearchMedia) => string | null;
};

export function CompactCatalog({ result, state, returnUrl, loading, error, loadingMore, onMore, onRetry, onLoadFilterOptions, imageSource, promotions }: Props) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const cachedOptions = useRef<{ categoryId: string; options: FilterOptions } | null>(null);
  if (result?.filterOptions && !loading) cachedOptions.current = { categoryId: state.categoryId ?? "", options: result.filterOptions };
  const options = cachedOptions.current?.options;
  const filters = catalogFilters(state);
  const active = activeFilters(filters, options);
  const productPlural = new Intl.PluralRules("ru-RU").select(result?.total ?? 0);
  const catalogRef = useRef<HTMLElement>(null);

  const change = (patch: FilterPatch & { sort?: string }) => {
    const catalog = catalogRef.current;
    const padding = catalog ? parseFloat(getComputedStyle(catalog).paddingTop) || 0 : 0;
    const scrollTop = catalog ? catalog.getBoundingClientRect().top + window.scrollY + padding : window.scrollY;
    const returnToStart = window.scrollY > scrollTop;
    const url = marketplaceCatalogUrl({ ...state, ...patch, count: 24 }, window.location.pathname);
    window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
    if (returnToStart) requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" }));
  };
  const openAll = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };
  const closeAll = () => {
    setOpen(false);
    requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); });
  };
  const reset = () => change({ ...emptyFilters });

  return <section ref={catalogRef} className={styles.catalog} aria-label="Каталог товаров">
    <div className={filtersStyles.toolbar} aria-label="Поиск и фильтрация">
      <CatalogFilterToolbar filters={filters} options={options} count={active.length}
        showPromotions={Boolean(promotions)}
        onChange={change} onOpenAll={openAll} />
    </div>
    {promotions}
    <div className={styles.results}>
      <div className={styles.resultsHeading}>
        <div className={styles.resultsTitle}><h1>Каталог товаров</h1>{result && !loading ? <span>{new Intl.NumberFormat("ru-RU").format(result.total)} {productPlural === "one" ? "товар" : productPlural === "few" ? "товара" : "товаров"}</span> : null}</div>
        <div className={styles.resultsSort}><FilterChoice label="Сортировка товаров" hideLabel searchable={false} includeAll={false}
          value={state.sort} items={sortChoices} allLabel="По умолчанию" onChange={sort => change({ sort: sort || "RELEVANCE" })} /></div>
      </div>
      {error ? <ActionFeedback tone="error" title={result?.items.length ? "Не удалось загрузить ещё товары" : "Не удалось загрузить каталог"} description={result?.items.length ? "Уже загруженные товары остаются доступны." : "Повторите загрузку."} /> : null}
      {active.length ? <div className={filtersStyles.active} aria-label="Выбранные фильтры">
        {active.slice(0, 3).map(filter => <DmButton key={filter.key} appearance="subtle" title={filter.label}
          aria-label={`Убрать ${filter.label}`} onClick={() => change(filter.patch)}><span className={filtersStyles.buttonText}>{filter.label}</span><span aria-hidden="true">×</span></DmButton>)}
        {active.length > 3 ? <DmButton appearance="subtle" onClick={openAll}>Ещё {active.length - 3}</DmButton> : null}
        <DmButton appearance="subtle" onClick={reset}>Сбросить фильтры</DmButton>
      </div> : null}
      {error && !result?.items.length ? <div className={styles.message}><h2>Не удалось загрузить каталог</h2><p>{error}</p><DmButton onClick={onRetry}>Повторить загрузку</DmButton></div>
        : loading ? <div role="status" className={styles.message}>Загружаем актуальные предложения…</div>
        : result?.items.length ? <div className={styles.grid}>{result.items.map(product => <CompactProductCard key={product.id} product={product} returnUrl={returnUrl} imageSource={imageSource} />)}</div>
        : <div className={styles.message}><h2>Ничего не найдено</h2><p>Измените запрос или условия поиска. Город доставки меняется в шапке.</p><DmButton onClick={reset}>Сбросить фильтры</DmButton><DmButton onClick={openAll}>Все фильтры</DmButton></div>}
      {!loading && result && (result.nextOffset ?? result.items.length) < result.total ? <div className={styles.more}>
        {error ? <p>Не удалось загрузить следующую страницу. Уже загруженные товары сохранены.</p> : null}
        <DmButton onClick={onMore} disabled={loadingMore}>{loadingMore ? "Загружаем…" : error ? "Повторить загрузку товаров" : "Показать ещё"}</DmButton>
      </div> : null}
    </div>
    {open ? <CatalogFilterDialog initial={{ ...filters, sort: state.sort }} initialOptions={cachedOptions.current?.categoryId === filters.categoryId ? options : undefined}
      onLoadOptions={onLoadFilterOptions} onClose={closeAll} onApply={draft => { closeAll(); change(draft); }} /> : null}
  </section>;
}
