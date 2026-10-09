"use client";
import { useState } from "react";
import { Option } from "@fluentui/react-components";
import { DmCombobox as Combobox, DmFluentDropdown as Dropdown } from "@marketplace/ui/controls";
import { DmField, DmInput, dmDropdownPositioning } from "@marketplace/ui";
import { attributePatch, readAttributes, type CatalogFilters, type FilterOptions, type FilterPatch } from "./catalog-filter-model";
import styles from "./catalog-filters.module.css";

type Choice = { id: string; name: string };
export function FilterChoice({ label, value, items, onChange, disabled = false, hideLabel = false, allLabel = "Все", searchable = true, includeAll = true }: {
  label: string; value: string; items: Choice[]; onChange: (value: string) => void; disabled?: boolean; hideLabel?: boolean; allLabel?: string; searchable?: boolean; includeAll?: boolean;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const selected = items.find(item => item.id === value);
  const visible = items.filter(item => !query || item.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  if (!searchable) return <DmField label={hideLabel ? undefined : label} className={styles.field}>
    <Dropdown className={styles.choice} aria-label={label} disabled={disabled} inlinePopup
      positioning={dmDropdownPositioning}
      listbox={{ className: styles.choiceList }}
      value={selected?.name ?? (value ? "Выбрано" : allLabel)} selectedOptions={[value]}
      onOptionSelect={(_, data) => { if (data.optionValue !== undefined) onChange(data.optionValue); }}>
      {includeAll ? <Option value="">{allLabel}</Option> : null}
      {value && !selected ? <Option value={value}>Выбрано</Option> : null}
      {items.map(item => <Option key={item.id} value={item.id} text={item.name}>{item.name}</Option>)}
    </Dropdown>
  </DmField>;
  return <DmField label={hideLabel ? undefined : label} className={styles.field}>
    <Combobox className={styles.choice} aria-label={label} disabled={disabled} inlinePopup
      positioning={dmDropdownPositioning}
      listbox={{ className: styles.choiceList }}
      value={query ?? selected?.name ?? (value ? "Выбрано" : allLabel)}
      selectedOptions={[value]} placeholder="Поиск по списку"
      onChange={event => setQuery(event.target.value)}
      onOpenChange={(_, data) => setQuery(data.open ? "" : null)}
      onOptionSelect={(_, data) => { if (data.optionValue !== undefined) onChange(data.optionValue); setQuery(null); }}>
      {includeAll ? <Option value="">{allLabel}</Option> : null}
      {value && !selected ? <Option value={value}>Выбрано</Option> : null}
      {visible.map(item => <Option key={item.id} value={item.id} text={item.name}>{item.name}</Option>)}
      {!visible.length ? <Option disabled>Ничего не найдено</Option> : null}
    </Combobox>
  </DmField>;
}

export function PriceFields({ filters, onChange, error }: {
  filters: Pick<CatalogFilters, "minPrice" | "maxPrice">; onChange: (patch: FilterPatch) => void; error?: string;
}) {
  return <fieldset className={styles.priceFields}>
    <legend>Цена за единицу продажи, ₸</legend>
    <DmField label="От" validationState={error ? "error" : "none"}>
      <DmInput inputMode="decimal" value={filters.minPrice} placeholder="0" onChange={(_, data) => onChange({ minPrice: data.value })} />
    </DmField>
    <DmField label="До" validationState={error ? "error" : "none"}>
      <DmInput inputMode="decimal" value={filters.maxPrice} placeholder="Любая" onChange={(_, data) => onChange({ maxPrice: data.value })} />
    </DmField>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </fieldset>;
}

export function AttributeFields({ filters, attributes, onChange }: {
  filters: CatalogFilters; attributes: FilterOptions["attributes"]; onChange: (patch: FilterPatch) => void;
}) {
  const selected = readAttributes(filters.attributeFilters);
  return <>{attributes.map(attribute => <FilterChoice key={attribute.code} label={attribute.name}
    value={selected[attribute.code] === undefined ? "" : JSON.stringify(selected[attribute.code])}
    items={attribute.values.map(value => ({ id: JSON.stringify(value), name: typeof value === "boolean" ? value ? "Да" : "Нет" : String(value) }))}
    onChange={value => onChange(attributePatch(filters, attribute.code, value))} />)}</>;
}
