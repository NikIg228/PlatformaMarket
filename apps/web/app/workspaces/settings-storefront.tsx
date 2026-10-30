"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@fluentui/react-components";
import { AVATAR_MAX_BYTES, saveSupplierStorefrontSchema, type SupplierStorefrontSettings } from "@marketplace/schemas";
import { DmButton, DmFeedback, DmField, DmFileInput, DmHeading, DmSurface, DmTextarea, ErrorState, LoadingState, errorMessage, useSaveToast, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import styles from "./account-settings.module.css";

export function SettingsStorefront({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(() => api.supplierStorefrontSettings(organizationId), [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (!resource.data) return resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Загружаем сведения витрины" />;
  return <StorefrontEditor key={organizationId} initial={resource.data} onDirtyChange={onDirtyChange} />;
}
const fields = [
  { key: "description", label: "Краткое описание", max: 1000, rows: 4 },
  { key: "location", label: "Расположение", max: 300, rows: 2 },
  { key: "hours", label: "График работы", max: 300, rows: 2 },
  { key: "delivery", label: "Условия доставки", max: 600, rows: 3 },
] as const;
function StorefrontEditor({ initial, onDirtyChange }: { initial: SupplierStorefrontSettings; onDirtyChange: (dirty: boolean) => void }) {
  const { api, organizationId } = useWorkspace(), notify = useSaveToast();
  const [saved, setSaved] = useState(initial), [content, setContent] = useState(initial.content);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>();
  const lock = useRef(false), alive = useRef(true), form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(content) !== JSON.stringify(saved.content);
  useUnsavedChanges(dirty || busy);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty || busy); return () => onDirtyChange(false); }, [dirty, busy, onDirtyChange]);
  useEffect(() => {
    let active = true;
    if (saved.logoUrl) void api.get<{ contentType: string; contentBase64: string }>(`/suppliers/${organizationId}/storefront/logo`).then(value => { if (active) setLogo(`data:${value.contentType};base64,${value.contentBase64}`); }).catch(() => { if (active) setLogo(undefined); });
    return () => { active = false; };
  }, [api, organizationId, saved.logoUrl, saved.version]);
  async function run(action: () => Promise<SupplierStorefrontSettings>, replaceDraft: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { const result = await action(); if (!alive.current) return; setSaved(result); if (replaceDraft) setContent(result.content); notify("Сведения витрины сохранены"); }
    catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function reload() {
    if (lock.current || (dirty && !window.confirm("Заменить несохранённый текст сведениями с сервера?"))) return;
    lock.current = true; setBusy(true);
    try { const result = await api.supplierStorefrontSettings(organizationId); if (alive.current) { setSaved(result); setContent(result.content); setError(null); setErrors({}); } }
    catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || lock.current || !saved.canEdit || dirty) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > AVATAR_MAX_BYTES) { setError("Выберите PNG или JPEG не больше 2 МБ."); return; }
    await run(async () => {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Не удалось прочитать логотип. Выберите файл повторно.")); reader.readAsDataURL(file);
      });
      return api.uploadSupplierLogo(organizationId, { expectedVersion: saved.version, fileName: file.name, contentBase64 });
    }, false);
  }
  return <DmSurface className={styles.card}>
    <div className={styles.toolbar}><DmHeading title="Публичная витрина" />{saved.published ? <DmButton as="a" href={`/catalog/suppliers/${organizationId}`} target="_blank" rel="noopener noreferrer">Открыть витрину</DmButton> : null}</div>
    <p className={styles.intro}>Эти сведения видны посетителям каталога. Название и официальный контакт берутся из настроек организации.</p>
    {!saved.published ? <DmFeedback presentation="note" tone="warning" title="Витрина пока недоступна посетителям" description="Публичная страница появится после допуска поставщика к работе на площадке." /> : null}
    <div className={styles.identity}><Avatar name={saved.name} image={{ src: logo }} size={64} /><DmField label="Логотип · PNG или JPEG, до 2 МБ"><DmFileInput aria-label="Логотип поставщика" accept="image/png,image/jpeg" disabled={busy || dirty || !saved.canEdit} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} /></DmField></div>
    {dirty ? <p className={styles.note}>Сохраните текст перед загрузкой логотипа.</p> : null}
    <form ref={form} onSubmit={event => {
      event.preventDefault(); if (busy || !saved.canEdit) return;
      const parsed = saveSupplierStorefrontSchema.safeParse({ expectedVersion: saved.version, content });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.slice(1).join("."), "Проверьте длину текста"]))); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
      setErrors({}); void run(() => api.saveSupplierStorefront(organizationId, parsed.data), true);
    }}>
      <div className={styles.two}>{(["ru", "kk"] as const).map(locale => <div className={styles.address} key={locale}>
        <h3>{locale === "ru" ? "Русский" : "Қазақша"}</h3>
        {fields.map(field => <DmField key={field.key} label={`${field.label} · ${locale.toUpperCase()}`} validationMessage={errors[`${locale}.${field.key}`]} validationState={errors[`${locale}.${field.key}`] ? "error" : "none"}>
          <DmTextarea rows={field.rows} maxLength={field.max} disabled={busy || !saved.canEdit} value={content[locale][field.key]} onChange={(_, data) => setContent(value => ({ ...value, [locale]: { ...value[locale], [field.key]: data.value } }))} />
        </DmField>)}
      </div>)}</div>
      {error ? <><DmFeedback presentation="note" tone="danger" title="Не удалось сохранить сведения" description={`${error} Введённый текст сохранён в форме.`} alert /><div className={styles.actions}><DmButton disabled={busy} onClick={() => void reload()}>Загрузить сохранённую версию</DmButton></div></> : null}
      <div className={styles.actions}><DmButton type="submit" appearance="primary" disabled={busy || !dirty || !saved.canEdit}>{busy ? "Сохраняем…" : "Сохранить сведения витрины"}</DmButton></div>
    </form>
  </DmSurface>;
}
