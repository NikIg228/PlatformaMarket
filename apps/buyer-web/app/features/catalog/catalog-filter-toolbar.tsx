"use client";
import { DmButton } from "@marketplace/ui";
import Link from "next/link";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import { HeaderCity } from "../marketplace-header/header-city";
import { HeaderSearch } from "../marketplace-header/header-search";
import { FilterChoice } from "./catalog-filter-controls";
import { categoryChoices, categoryPatch, type CatalogFilters, type FilterOptions, type FilterPatch } from "./catalog-filter-model";
import styles from "./catalog-filters.module.css";
export function CatalogFilterToolbar({ filters, options, count, showPromotions, onChange, onOpenAll }: {
  showPromotions?: boolean;
  filters: CatalogFilters; options?: FilterOptions; count: number;
  onChange: (patch: FilterPatch) => void; onOpenAll: () => void;
}) {
  return <>
    <div className={styles.searchSlot}><HeaderSearch /></div>
    <div className={styles.citySlot}><HeaderCity toolbar /></div>
    <div className={styles.categorySlot}>
      <FilterChoice label="Категория и подкатегория" hideLabel allLabel="Все категории" searchable={false}
        value={filters.categoryId} items={categoryChoices(options?.categories)} disabled={!options}
        onChange={categoryId => onChange(categoryPatch(categoryId))} />
    </div>
    <DmButton className={styles.allFilters} onClick={onOpenAll}>
      Все фильтры{count ? " · " + count : ""}
    </DmButton>
    {showPromotions ? <Link href="/promotions" {...dmLinkButtonProps({ appearance: "primary", className: styles.promotionsLink })}>Все акции <span aria-hidden="true">→</span></Link> : null}
  </>;
}
