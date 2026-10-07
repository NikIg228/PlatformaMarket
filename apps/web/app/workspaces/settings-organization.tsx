"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Option } from "@fluentui/react-components";
import { organizationProfileFieldsSchema, type OrganizationProfileFields, type OrganizationProfileResponse } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmFluentDropdown, DmInput, ErrorState, LoadingState, errorMessage, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import styles from "./account-settings.module.css";

export type SettingsCity = { id: string; nameRu: string; region?: { nameRu: string } };
const emptyFields = (): OrganizationProfileFields => ({ contactName: "", phone: "", email: "", legalAddress: { cityId: "", line1: "", postalCode: null }, deliveryAddress: { cityId: "", line1: "", postalCode: null } });

export function OrganizationSettings({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const [profile, cities] = await Promise.all([api.getOrganizationProfile(), api.get<SettingsCity[]>("/catalog/cities")]);
    if (profile.organizationId !== organizationId) throw new Error("Организация недоступна");
    return { profile, cities };
  }, [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем настройки организации" />;
  return <OrganizationForm key={organizationId} initial={resource.data.profile} cities={resource.data.cities} onDirtyChange={onDirtyChange} />;
}

function OrganizationForm({ initial, cities, onDirtyChange }: { initial: OrganizationProfileResponse; cities: SettingsCity[]; onDirtyChange: (dirty: boolean) => void }) {
  const { api, role } = useWorkspace();
  const has = usePermissions();
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState(initial.profile ?? emptyFields());
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useRef(false), retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const editable = saved.canEdit && has("organization.members.manage");
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved.profile ?? emptyFields());
  useUnsavedChanges(dirty || busy);
  useEffect(() => { onDirtyChange(dirty || busy); return () => onDirtyChange(false); }, [dirty, busy, onDirtyChange]);
  const update = (key: "contactName" | "phone" | "email", value: string) => { setFields(current => ({ ...current, [key]: value })); setNotice(false); };
  const addressUpdate = (kind: "legalAddress" | "deliveryAddress", key: "cityId" | "line1" | "postalCode", value: string) => {
    setFields(current => ({ ...current, [kind]: { ...current[kind], [key]: key === "postalCode" ? value || null : value } })); setNotice(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || !editable || !dirty) return;
    const parsed = organizationProfileFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.path.at(-1) === "cityId" ? "Выберите город" : issue.path.at(-1) === "line1" ? "Укажите адрес: не менее 5 символов" : issue.path[0] === "email" ? "Укажите корректную электронную почту" : issue.path[0] === "phone" ? "Укажите полный номер телефона с кодом" : "Введите контактное лицо: не менее 2 символов"])));
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    setErrors({}); setError(null); setNotice(false); lock.current = true; setBusy(true);
    const data = { ...parsed.data, expectedVersion: saved.version }, fingerprint = JSON.stringify(data);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api.saveOrganizationProfile({ ...data, idempotencyKey: retry.current.key });
      setSaved(result); setFields(result.profile ?? emptyFields()); retry.current = null; setNotice(true);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function reload() {
    if (lock.current || !window.confirm("Загрузить сохранённые настройки? Несохранённые изменения будут потеряны.")) return;
    lock.current = true; setBusy(true);
    try { const result = await api.getOrganizationProfile(); setSaved(result); setFields(result.profile ?? emptyFields()); setError(null); setErrors({}); retry.current = null; }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const address = (kind: "legalAddress" | "deliveryAddress", title: string) => <div role="group" aria-labelledby={`settings-${kind}`} className={`${styles.address} ${role === "clinic" ? styles.clinicAddress : ""}`}>
    <h3 id={`settings-${kind}`}>{title}</h3><div className={role === "supplier" ? styles.addressRow : styles.page}>
      <DmField size="large" label="Город" validationMessage={errors[`${kind}.cityId`]} validationState={errors[`${kind}.cityId`] ? "error" : "none"}>
        <DmFluentDropdown size="large" disabled={busy || !editable} aria-label={`${title}: город`} aria-invalid={Boolean(errors[`${kind}.cityId`])} placeholder="Выберите город" value={cities.find(city => city.id === fields[kind].cityId)?.nameRu ?? ""} selectedOptions={fields[kind].cityId ? [fields[kind].cityId] : []} onOptionSelect={(_, data) => addressUpdate(kind, "cityId", data.optionValue ?? "")}>
          {cities.map(city => <Option key={city.id} value={city.id} text={city.nameRu}>{city.nameRu}{city.region ? ` · ${city.region.nameRu}` : ""}</Option>)}
        </DmFluentDropdown>
      </DmField>
      <DmField size="large" label="Адрес" validationMessage={errors[`${kind}.line1`]} validationState={errors[`${kind}.line1`] ? "error" : "none"}>
        <DmInput size="large" disabled={busy || !editable} aria-label={`${title}: адрес`} value={fields[kind].line1} maxLength={500} placeholder="Укажите адрес" autoComplete={kind === "legalAddress" ? "billing street-address" : "shipping street-address"} onChange={(_, data) => addressUpdate(kind, "line1", data.value)} />
      </DmField>
      <DmField size="large" label="Почтовый индекс"><DmInput size="large" disabled={busy || !editable} aria-label={`${title}: почтовый индекс`} maxLength={20} value={fields[kind].postalCode ?? ""} autoComplete={kind === "legalAddress" ? "billing postal-code" : "shipping postal-code"} onChange={(_, data) => addressUpdate(kind, "postalCode", data.value)} /></DmField>
    </div></div>;
  return <form ref={form} noValidate onSubmit={event => void submit(event)} className={styles.page} aria-label="Настройки организации">
    <section className={styles.card}><h2>Данные организации</h2><div className={styles.two}>
      <DmField size="large" label="Юридическое название"><DmInput size="large" appearance="filled-darker" readOnly value={saved.legalName} /></DmField>
      <DmField size="large" label="БИН"><DmInput size="large" appearance="filled-darker" readOnly value={saved.bin} /></DmField>
    </div></section>
    <section className={styles.card}><h2>Рабочие контакты</h2><div className={styles.three}>
      {([['contactName', 'Контактное лицо', 'text', 'name'], ['phone', 'Телефон организации', 'tel', 'tel'], ['email', 'Электронная почта организации', 'email', 'email']] as const).map(([key, label, type, autocomplete]) => <DmField size="large" key={key} label={label} validationMessage={errors[key]} validationState={errors[key] ? "error" : "none"}>
        <DmInput size="large" value={fields[key]} type={type} autoComplete={autocomplete} maxLength={key === "phone" ? 30 : key === "email" ? 254 : 160} disabled={busy || !editable} onChange={(_, data) => update(key, data.value)} />
      </DmField>)}
    </div></section>
    <section className={styles.card}>{role === "clinic" ? <h2>Адреса организации</h2> : null}<div className={role === "clinic" ? styles.addresses : styles.supplierAddresses}>
      {address("legalAddress", "Юридический адрес")}{address("deliveryAddress", "Адрес получения")}
    </div></section>
    {!editable ? <DmFeedback tone="warning" title="Настройки доступны только для просмотра" description="Изменить их может сотрудник с правом управления организацией." /> : null}
    {!cities.length ? <DmFeedback tone="warning" title="Справочник городов пока пуст" description="Обратитесь в поддержку, чтобы заполнить адрес организации." /> : null}
    {error ? <DmFeedback tone="danger" title="Изменения не сохранены" description={error} alert action={<DmButton disabled={busy} onClick={() => void reload()}>Загрузить сохранённые настройки</DmButton>} /> : null}
    {notice ? <DmFeedback tone="success" title="Изменения сохранены" description="Контакты и адреса организации обновлены." /> : null}
    <div className={styles.actions}><DmButton appearance="outline" intent="brand" disabled={busy || !dirty} onClick={() => { setFields(saved.profile ?? emptyFields()); setError(null); setErrors({}); setNotice(false); }}>Отмена</DmButton><DmButton type="submit" appearance="primary" disabled={busy || !dirty || !editable || !cities.length}>{busy ? "Сохраняем…" : "Сохранить изменения"}</DmButton></div>
  </form>;
}
