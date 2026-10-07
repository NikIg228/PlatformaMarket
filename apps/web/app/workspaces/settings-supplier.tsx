"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Option } from "@fluentui/react-components";
import { createWarehouseSchema } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmFluentDropdown, DmInput, ErrorState, LoadingState, errorMessage, formatStatus, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";
import type { SupplierDataSource } from "../../../supplier-web/app/features/supplier-workspace/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import type { SettingsCity } from "./settings-organization";
import styles from "./account-settings.module.css";

export function SettingsSources() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.get<SupplierDataSource[]>(`/suppliers/${organizationId}/data-sources`, { signal }), [api, organizationId]);
  const resource = useResource(load);
  return <section className={`${styles.card} ${styles.page}`} aria-label="Источники товаров"><div className={styles.toolbar}><h2>Источники товаров</h2>
    <div className={styles.actions}><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить список</DmButton><Link {...dmLinkButtonProps({ appearance: "primary" })} href="/supplier/products/import">Загрузить прайс</Link></div></div>
    <p className={styles.intro}>Здесь отображаются источники, из которых загружены товары. Новый прайс загружается в разделе «Товары».</p>
    {resource.error ? <ErrorState description={resource.error} action={<DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
    {!resource.data && resource.loading ? <LoadingState label="Загружаем источники" /> : null}
    {resource.data?.length === 0 ? <div className={styles.empty} role="status"><strong>Источников пока нет</strong><p>Загрузите прайс, чтобы добавить товары.</p></div> : <ul className={styles.list}>{resource.data?.map(source => <li key={source.id}><strong>{source.name}</strong><p className={styles.muted}>{formatStatus(source.type)} · {formatStatus(source.status)}</p></li>)}</ul>}
  </section>;
}

const blankWarehouse = { code: "", name: "", cityId: "", addressLine: "" };
export function SettingsWarehouses({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const has = usePermissions();
  const load = useCallback(async () => {
    const [warehouses, cities] = await Promise.all([api.listSupplierWarehouses(organizationId), api.get<SettingsCity[]>("/catalog/cities")]);
    return { warehouses, cities };
  }, [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  const [creating, setCreating] = useState(false), [draft, setDraft] = useState(blankWarehouse), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(false), [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useRef(false), form = useRef<HTMLFormElement>(null);
  const dirty = creating && Object.values(draft).some(Boolean);
  useUnsavedChanges(dirty || busy);
  useEffect(() => { onDirtyChange(dirty || busy); return () => onDirtyChange(false); }, [dirty, busy, onDirtyChange]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || !has("supplier.warehouse.manage")) return;
    const parsed = createWarehouseSchema.safeParse({ ...draft, cityId: draft.cityId || null, addressLine: draft.addressLine || null });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.path[0] === "code" ? "От 2 до 32 символов: A–Z, 0–9, дефис или подчёркивание" : "Проверьте значение поля"])));
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    lock.current = true; setBusy(true); setError(null); setErrors({});
    try {
      await api.post(`/suppliers/${organizationId}/warehouses`, parsed.data);
      setCreating(false); setDraft(blankWarehouse); setNotice(true); await resource.refreshAfterWrite();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.card} aria-label="Склады"><h2>Склады</h2>
    <p className={styles.intro}>Места хранения товаров поставщика. Остатки учитываются отдельно по каждому складу.</p>
    {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
    {!resource.data && resource.loading ? <LoadingState label="Загружаем склады" /> : null}
    {resource.data?.warehouses.length === 0 ? <div className={styles.empty} role="status"><strong>Складов пока нет</strong><p>Добавьте место хранения, чтобы учитывать его остатки.</p></div> : <ul className={styles.list}>{resource.data?.warehouses.map(warehouse => <li key={warehouse.id}><strong>{warehouse.name}</strong><p className={styles.muted}>{formatStatus(warehouse.status)}</p></li>)}</ul>}
    {notice ? <DmFeedback tone="success" title="Склад добавлен" description="Склад доступен для работы с остатками." /> : null}
    {!creating ? <div className={styles.actions}><DmButton disabled={!has("supplier.warehouse.manage") || !resource.data} onClick={() => { setCreating(true); setNotice(false); }}>Добавить склад</DmButton></div> : <form ref={form} noValidate onSubmit={event => void submit(event)} className={styles.page} aria-label="Новый склад">
      <h3>Новый склад</h3><div className={styles.two}>
        <DmField size="large" label="Название склада" validationMessage={errors.name} validationState={errors.name ? "error" : "none"}><DmInput size="large" disabled={busy || !has("supplier.warehouse.manage")} value={draft.name} maxLength={160} onChange={(_, data) => setDraft(value => ({ ...value, name: data.value }))} /></DmField>
        <DmField size="large" label="Код склада" validationMessage={errors.code} validationState={errors.code ? "error" : "none"}><DmInput size="large" disabled={busy || !has("supplier.warehouse.manage")} value={draft.code} maxLength={32} onChange={(_, data) => setDraft(value => ({ ...value, code: data.value }))} /></DmField>
        <DmField size="large" label="Город"><DmFluentDropdown size="large" disabled={busy || !has("supplier.warehouse.manage")} placeholder="Выберите город" selectedOptions={draft.cityId ? [draft.cityId] : []} value={resource.data?.cities.find(city => city.id === draft.cityId)?.nameRu ?? ""} onOptionSelect={(_, data) => setDraft(value => ({ ...value, cityId: data.optionValue ?? "" }))}>{resource.data?.cities.map(city => <Option key={city.id} value={city.id}>{city.nameRu}</Option>)}</DmFluentDropdown></DmField>
        <DmField size="large" label="Адрес склада"><DmInput size="large" disabled={busy || !has("supplier.warehouse.manage")} value={draft.addressLine} maxLength={240} onChange={(_, data) => setDraft(value => ({ ...value, addressLine: data.value }))} /></DmField>
      </div>
      {error ? <DmFeedback tone="danger" title="Не удалось добавить склад" description={error} alert /> : null}
      <div className={styles.actions}><DmButton disabled={busy} onClick={() => { setCreating(false); setError(null); setErrors({}); setDraft(blankWarehouse); }}>Отмена</DmButton><DmButton type="submit" appearance="primary" disabled={busy || !has("supplier.warehouse.manage")}>{busy ? "Добавляем…" : "Добавить склад"}</DmButton></div>
    </form>}
  </section>;
}
