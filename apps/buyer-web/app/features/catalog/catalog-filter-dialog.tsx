"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from "@fluentui/react-components";
import { ActionFeedback, ToastScope, DmButton, DmCheckbox, DmField, DmSelect } from "@marketplace/ui";
import { AttributeFields, FilterChoice, PriceFields } from "./catalog-filter-controls";
import { activeFilters, emptyFilters, priceError, type CatalogFilters, type FilterOptions, type FilterPatch } from "./catalog-filter-model";
import styles from "./catalog-filters.module.css";

export type LoadFilterOptions = (categoryId: string, signal: AbortSignal) => Promise<FilterOptions | undefined>;

export function CatalogFilterDialog({ initial, initialOptions, onLoadOptions, onClose, onApply }: {
  initial: CatalogFilters & { sort: string }; initialOptions?: FilterOptions; onLoadOptions: LoadFilterOptions;
  onClose: () => void; onApply: (filters: CatalogFilters & { sort: string }) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [resolved, setResolved] = useState({ categoryId: initial.categoryId, options: initialOptions });
  const [loading, setLoading] = useState(!initialOptions);
  const [error, setError] = useState<string>();
  const [priceValidation, setPriceValidation] = useState<string>();
  const [retry, setRetry] = useState(0);
  const original = useRef({ categoryId: initial.categoryId, options: initialOptions });
  const loader = useRef(onLoadOptions);
  loader.current = onLoadOptions;
  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    if (draft.categoryId === original.current.categoryId && original.current.options) {
      setResolved(original.current); setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void loader.current(draft.categoryId, controller.signal).then(options => {
      if (!options) throw new Error();
      if (!controller.signal.aborted) setResolved({ categoryId: draft.categoryId, options });
    }).catch(() => {
      if (!controller.signal.aborted) setError("Не удалось загрузить параметры категории. Повторите попытку.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [draft.categoryId, retry]);

  const options = resolved.options;
  const attributes = resolved.categoryId === draft.categoryId ? options?.attributes ?? [] : [];
  const selected = activeFilters(draft, options);
  const change = (patch: FilterPatch & { sort?: string }) => { setDraft(current => ({ ...current, ...patch })); setPriceValidation(undefined); };
  return <Dialog open onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
    <DialogSurface className={styles.drawer}>
      <DialogBody className={styles.drawerBody}>
        <DialogTitle action={<DmButton appearance="subtle" onClick={onClose}>Закрыть</DmButton>}>Все фильтры{selected.length ? ` · ${selected.length}` : ""}</DialogTitle>
        <DialogContent className={styles.drawerContent}>
          <p className={styles.hint}>Изменения применятся после нажатия «Показать товары».</p>
          {selected.length ? <details className={styles.group}>
            <summary>Выбрано: {selected.length}</summary>
            <div className={styles.selectedList}>{selected.map(filter => <DmButton key={filter.key} appearance="subtle"
              aria-label={`Убрать ${filter.label}`} onClick={() => change(filter.patch)}>{filter.label} <span aria-hidden="true">×</span></DmButton>)}</div>
          </details> : null}
          <div className={styles.fields}>
            <DmField label="Сортировка">
              <DmSelect value={draft.sort} onChange={(_, data) => change({ sort: data.value })}>
                <option value="RELEVANCE">По релевантности</option>
                <option value="PRICE_ASC">Сначала дешевле</option>
                <option value="PRICE_DESC">Сначала дороже</option>
                <option value="NAME_ASC">По названию</option>
                <option value="UPDATED_DESC">По обновлению</option>
              </DmSelect>
            </DmField>
            <DmCheckbox label="Только в наличии" checked={draft.stock === "true"}
              onChange={(_, data) => change({ stock: data.checked ? "true" : "all" })} />
            <PriceFields filters={draft} onChange={change} error={priceValidation} />
            <FilterChoice label="Бренд" value={draft.brandId} items={options?.brands ?? []}
              onChange={brandId => change({ brandId, brand: "" })} disabled={!options} />
            {loading ? <p role="status">Загружаем параметры категории…</p> : null}
            <ToastScope />
            {error ? <><ActionFeedback tone="error" title="Не удалось загрузить фильтры" description="Повторите попытку." /><div><p>{error}</p><DmButton onClick={() => setRetry(value => value + 1)}>Повторить</DmButton></div></> : null}
            {attributes.length ? <fieldset className={styles.attributeGroup}><legend>Характеристики</legend>
              <AttributeFields filters={draft} attributes={attributes} onChange={change} />
            </fieldset> : !loading && !error ? <p className={styles.hint}>{draft.categoryId ? "Для этой категории дополнительных характеристик нет." : "Выберите категорию в шапке каталога, чтобы уточнить характеристики."}</p> : null}
          </div>
          <details className={styles.group} open={Boolean(draft.supplierOrganizationId || draft.manufacturerId || draft.packaging)}>
            <summary>Поставщик, производитель и фасовка</summary>
            <div className={styles.fields}>
              <FilterChoice label="Поставщик" value={draft.supplierOrganizationId} items={options?.suppliers ?? []}
                onChange={supplierOrganizationId => change({ supplierOrganizationId })} disabled={!options} />
              <FilterChoice label="Производитель" value={draft.manufacturerId} items={options?.manufacturers ?? []}
                onChange={manufacturerId => change({ manufacturerId })} disabled={!options} />
              <FilterChoice label="Фасовка / единица продажи" value={draft.packaging}
                items={(options?.packaging ?? []).map(name => ({ id: name, name }))}
                onChange={packaging => change({ packaging })} disabled={!options} />
            </div>
          </details>
        </DialogContent>
        <DialogActions className={styles.drawerActions}>
          <DmButton onClick={() => change({ ...emptyFilters, sort: "RELEVANCE" })}>Сбросить</DmButton>
          <DmButton appearance="primary" disabled={loading || Boolean(error) || resolved.categoryId !== draft.categoryId} onClick={() => {
            const message = priceError(draft.minPrice, draft.maxPrice);
            setPriceValidation(message);
            if (!message) onApply(draft);
          }}>Показать товары</DmButton>
        </DialogActions>
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
