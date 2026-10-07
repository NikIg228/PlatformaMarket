"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePersonalProfileSchema, requestProfileEmailSchema, AVATAR_MAX_BYTES } from "@marketplace/schemas";
import { DmButton, DmEditableAvatar, DmFeedback, DmInlineEdit, DmSurface, ErrorState, LoadingState, errorMessage, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ProfileSessions } from "./profile-sessions";
import styles from "./account-settings.module.css";

export default function Profile() {
  const { api, logout } = useWorkspace();
  const load = useCallback((signal: AbortSignal) => api.personalProfile(signal), [api]);
  const resource = useResource(load, { automatic: false });
  const [editing, setEditing] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | undefined>(), [avatarBusy, setAvatarBusy] = useState(false), [avatarError, setAvatarError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false), [avatarRevision, setAvatarRevision] = useState(0);
  const avatarLock = useRef(false);
  useUnsavedChanges(editing !== null || avatarBusy);
  useEffect(() => {
    const controller = new AbortController(); setAvatar(undefined);
    if (resource.data?.avatarAssetId) void api.profileAvatar(controller.signal).then(value => { if (!controller.signal.aborted) setAvatar(`data:${value.contentType};base64,${value.contentBase64}`); }).catch(cause => { if (!controller.signal.aborted) setAvatarError(errorMessage(cause)); });
    return () => controller.abort();
  }, [api, resource.data?.avatarAssetId, avatarRevision]);
  async function save(key: "displayName" | "email" | "phone", value: string) {
    if (!resource.data) return;
    setNotice(null); setSaveError(false);
    const expectedVersion = resource.data.version;
    try {
    if (key === "email") {
      const parsed = requestProfileEmailSchema.safeParse({ expectedVersion, email: value });
      if (!parsed.success) throw new Error("Укажите корректную электронную почту");
      try {
        const result = await api.requestProfileEmail(parsed.data);
        setNotice(result.delivery === "LOCAL_FILE" ? "Подтверждение новой почты подготовлено в локальной среде. Внешняя отправка не выполнялась; до подтверждения действует прежний адрес." : "Письмо отправлено на новый адрес. Подтвердите его по ссылке; до этого действует прежняя почта. После подтверждения потребуется войти заново.");
      } finally { await resource.refreshAfterWrite(); }
    } else {
      const parsed = updatePersonalProfileSchema.safeParse({ expectedVersion, [key]: value });
      if (!parsed.success) throw new Error(key === "phone" ? "Укажите полный номер телефона с кодом" : "Введите имя: от 2 до 160 символов");
      resource.setData(await api.savePersonalProfile(parsed.data)); setNotice("Изменения сохранены");
    }
    } catch (cause) { setSaveError(true); throw cause; }
  }
  async function upload(file: File) {
    if (!resource.data || avatarLock.current) return;
    setAvatarError(null); setNotice(null);
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > AVATAR_MAX_BYTES || file.size === 0) { setAvatarError("Выберите JPG или PNG размером до 2 МБ"); return; }
    avatarLock.current = true; setAvatarBusy(true);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(new Error("Не удалось прочитать фото. Выберите файл повторно.")); reader.readAsDataURL(file); });
      resource.setData(await api.uploadProfileAvatar({ expectedVersion: resource.data.version, fileName: file.name, contentBase64 }));
      setNotice("Фото профиля сохранено");
    } catch (cause) { setAvatarError(errorMessage(cause)); }
    finally { avatarLock.current = false; setAvatarBusy(false); }
  }
  return <div className={styles.page}>
    <DmSurface className={styles.card} role="region" aria-label="Данные профиля"><h2>Данные профиля</h2>
      {resource.error ? <ErrorState description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
      {!resource.data && resource.loading ? <LoadingState label="Загружаем данные профиля" /> : null}
      {resource.data ? <div className={styles.identity}>
        <DmEditableAvatar name={resource.data.displayName} src={avatar} pending={avatarBusy} disabled={editing !== null} onFile={file => void upload(file)} />
        <div className={styles.identityFields}>{([['displayName', 'Имя', 'text'], ['email', 'Электронная почта', 'email'], ['phone', 'Телефон', 'tel']] as const).map(([key, label, type]) =>
          <DmInlineEdit key={key} label={label} value={resource.data![key] ?? ""} type={type} required maxLength={key === "phone" ? 30 : key === "email" ? 254 : 160}
            disabled={avatarBusy || (editing !== null && editing !== key)} onEditingChange={active => setEditing(active ? key : null)} onSave={value => save(key, value)} />)}
        </div>
      </div> : null}
      {resource.data && !resource.data.phone ? <p className={styles.note}>Добавьте обязательный номер телефона в свой профиль.</p> : null}
      {notice ? <p className={styles.note} role="status">{notice}</p> : null}
      {avatarError ? <DmFeedback tone="danger" title="Фото не обновлено" description={avatarError} alert /> : null}
      {resource.data && (saveError || avatarError) ? <div className={styles.refresh}><DmButton appearance="subtle" density="compact" disabled={avatarBusy || resource.loading} onClick={() => { setAvatarError(null); setAvatarRevision(value => value + 1); void resource.refresh(); }}>Обновить данные</DmButton></div> : null}
    </DmSurface>
    <ProfileSessions />
    <DmButton appearance="outline" intent="brand" className={styles.logout} disabled={logout.logoutPending} onClick={logout.onLogout}>{logout.logoutPending ? "Выходим…" : "Выйти из профиля"}</DmButton>
  </div>;
}
