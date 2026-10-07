"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Add20Regular } from "@fluentui/react-icons/svg/add";
import { organizationContactSchema, organizationProfileFieldsSchema, type OrganizationProfileFields, type OrganizationProfileResponse } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmInlineEdit, DmInput, DmSurface, ErrorState, LoadingState, errorMessage, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ContactInputs, NewContact, contactFields } from "./settings-contact-editor";
import { SettingsAddresses } from "./settings-addresses";
import styles from "./account-settings.module.css";
export type SettingsCity = { id: string; nameRu: string; region?: { nameRu: string } };
const blank = (): OrganizationProfileFields => ({ contactName: "", phone: "", email: "", additionalContacts: [], legalAddress: { cityId: "", line1: "", postalCode: null }, deliveryAddress: { cityId: "", line1: "", postalCode: null } });

export function OrganizationSettings({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const [profile, cities] = await Promise.all([api.getOrganizationProfile(), api.get<SettingsCity[]>("/catalog/cities")]);
    if (profile.organizationId !== organizationId) throw new Error("Организация недоступна");
    return { profile, cities };
  }, [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем настройки организации" />;
  return <OrganizationEditor key={organizationId} initial={resource.data.profile} cities={resource.data.cities} onDirtyChange={onDirtyChange} />;
}
function OrganizationEditor({ initial, cities, onDirtyChange }: { initial: OrganizationProfileResponse; cities: SettingsCity[]; onDirtyChange: (dirty: boolean) => void }) {
  const { api } = useWorkspace(), has = usePermissions();
  const [saved, setSaved] = useState(initial), [fields, setFields] = useState(initial.profile ?? blank());
  const [editing, setEditing] = useState<string | null>(null), [adding, setAdding] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useRef(false), retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const editable = saved.canEdit && has("organization.members.manage");
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved.profile ?? blank());
  useUnsavedChanges(dirty || editing !== null || adding || busy);
  useEffect(() => { onDirtyChange(dirty || editing !== null || adding || busy); return () => onDirtyChange(false); }, [dirty, editing, adding, busy, onDirtyChange]);
  async function persist(next: OrganizationProfileFields) {
    if (lock.current || !editable) throw new Error("Сохранение недоступно");
    const parsed = organizationProfileFieldsSchema.safeParse(next);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), "Проверьте значение поля"])));
      throw new Error("Заполните контакты и оба адреса организации");
    }
    lock.current = true; setBusy(true); setError(null); setNotice(null); setErrors({});
    const payload = { ...parsed.data, expectedVersion: saved.version }, fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api.saveOrganizationProfile({ ...payload, idempotencyKey: retry.current.key });
      setSaved(result); setFields(result.profile ?? blank()); retry.current = null; setNotice("Изменения сохранены");
    } catch (cause) { setError(errorMessage(cause)); throw cause; }
    finally { lock.current = false; setBusy(false); }
  }
  async function reload() {
    if (lock.current) return;
    // Refresh the version/base for retry, preserving every open draft.
    setBusy(true); lock.current = true;
    try {
      const result = await api.getOrganizationProfile(), base = saved.profile ?? blank(), fresh = result.profile ?? blank();
      if (dirty) {
        // Rebase only locally edited values; never overwrite a concurrent contact
        // update merely because an address draft was open during refresh.
        const next = { ...fresh };
        for (const key of ["contactName", "phone", "email"] as const) if (fields[key] !== base[key]) next[key] = fields[key];
        for (const kind of ["legalAddress", "deliveryAddress"] as const) {
          next[kind] = { ...fresh[kind] };
          for (const key of ["cityId", "line1", "postalCode"] as const) if (fields[kind][key] !== base[kind][key]) {
            if (key === "postalCode") next[kind].postalCode = fields[kind].postalCode;
            else next[kind][key] = fields[kind][key];
          }
        }
        setFields(next);
      } else setFields(fresh);
      setSaved(result); retry.current = null; setError(null); setNotice("Сохранённые данные обновлены. Проверьте свой ввод перед повторным сохранением.");
    }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); lock.current = false; }
  }
  const contacts = saved.profile ? [saved.profile, ...(saved.profile.additionalContacts ?? [])] : [];
  return <div className={styles.page}>
    <DmSurface className={styles.card}><h2>Данные организации</h2><div className={styles.two}>
      <DmField label="Юридическое название"><DmInput appearance="filled-darker" readOnly value={saved.legalName} /></DmField>
      <DmField label="БИН"><DmInput appearance="filled-darker" readOnly value={saved.bin} /></DmField>
    </div></DmSurface>
    <DmSurface className={styles.card} role="region" aria-label="Рабочие контакты"><div className={styles.toolbar}><h2>Рабочие контакты</h2>
      {editable && saved.profile ? <DmButton appearance="subtle" density="compact" icon={<Add20Regular />} disabled={busy || adding || dirty || editing !== null || contacts.length >= 10} onClick={() => { setAdding(true); setNotice(null); }}>Добавить ещё</DmButton> : null}
    </div>
      {!saved.profile ? <ContactInputs value={fields} disabled={!editable || busy} onChange={value => setFields(current => ({ ...current, ...value }))} /> : contacts.map((contact, index) => <div key={index} className={styles.contact} role="group" aria-label={index === 0 ? "Основной контакт" : `Контакт ${index + 1}`}>
        <div className={styles.three}>{contactFields.map(([key, label, type]) => <DmInlineEdit key={key} label={label} value={contact[key]} required type={type} maxLength={key === "phone" ? 30 : key === "email" ? 254 : 160}
          disabled={!editable || busy || dirty || adding || (editing !== null && editing !== `${index}:${key}`)} onEditingChange={active => setEditing(active ? `${index}:${key}` : null)} onSave={async value => {
            const parsed = organizationContactSchema.shape[key].safeParse(value);
            if (!parsed.success) throw new Error(key === "phone" ? "Укажите полный номер телефона с кодом" : key === "email" ? "Укажите корректную электронную почту" : "Введите имя: не менее 2 символов");
            const next = { ...saved.profile! };
            if (index === 0) next[key] = parsed.data;
            else next.additionalContacts = (next.additionalContacts ?? []).map((item, position) => position === index - 1 ? { ...item, [key]: parsed.data } : item);
            await persist(next);
          }} />)}</div>
      </div>)}
      {adding ? <NewContact onCancel={() => setAdding(false)} onSave={async value => { await persist({ ...saved.profile!, additionalContacts: [...(saved.profile?.additionalContacts ?? []), value] }); setAdding(false); }} /> : null}
    </DmSurface>
    <DmSurface className={styles.card}><h2>Адреса организации</h2>
      <SettingsAddresses fields={fields} cities={cities} disabled={!editable || busy || editing !== null || adding} errors={errors} onChange={(kind, key, value) => { setFields(current => ({ ...current, [kind]: { ...current[kind], [key]: key === "postalCode" ? value || null : value } })); setNotice(null); }} />
      {dirty || !saved.profile ? <div className={styles.refresh}><div className={styles.actions}>
        <DmButton appearance="subtle" disabled={busy} onClick={() => { setFields(saved.profile ?? blank()); setError(null); setErrors({}); }}>Отмена</DmButton>
        <DmButton appearance="primary" disabled={!editable || busy || !cities.length} onClick={() => void persist(fields).catch(cause => setError(errorMessage(cause)))}>{busy ? "Сохраняем…" : saved.profile ? "Сохранить адреса" : "Сохранить настройки"}</DmButton>
      </div></div> : null}
    </DmSurface>
    {!editable ? <DmFeedback tone="warning" title="Настройки доступны только для просмотра" description="Изменить их может сотрудник с правом управления организацией." /> : null}
    {!cities.length ? <DmFeedback tone="warning" title="Справочник городов пока пуст" description="Обратитесь в поддержку, чтобы заполнить адрес организации." /> : null}
    {error ? <DmFeedback tone="danger" title="Изменения не сохранены" description={error} alert action={<DmButton disabled={busy} onClick={() => void reload()}>Обновить сохранённые данные</DmButton>} /> : null}
    {notice ? <p className={styles.note} role="status">{notice}</p> : null}
  </div>;
}
