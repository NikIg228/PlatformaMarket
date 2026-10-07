"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useRef, useState } from "react";
import { organizationContactSchema } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, errorMessage } from "@marketplace/ui";
import type { z } from "zod";
import styles from "./account-settings.module.css";
export type OrganizationContact = z.infer<typeof organizationContactSchema>;
export const contactFields = [["contactName", "Контактное лицо", "text"], ["phone", "Телефон организации", "tel"], ["email", "Электронная почта организации", "email"]] as const;
export const supplierContactFields = (official: boolean) => official
  ? [["contactName", "Официальный представитель", "text"], ["phone", "Публичный телефон организации", "tel"], ["email", "Электронная почта организации", "email"]] as const
  : [["contactName", "Контактное лицо", "text"], ["phone", "Телефон", "tel"], ["email", "Электронная почта", "email"]] as const;
export function ContactInputs({ value, onChange, disabled, kind, errors }: { value: OrganizationContact; onChange: (value: OrganizationContact) => void; disabled: boolean; kind?: "official" | "reserve"; errors?: Record<string, string> }) {
  return <div className={styles.three}>{(kind ? supplierContactFields(kind === "official") : contactFields).map(([key, label, type]) => <DmField key={key} label={label} required validationState={errors?.[key] ? "error" : "none"} validationMessage={errors?.[key]}>
    <DmInput value={value[key]} type={type} placeholder={key === "contactName" && kind === "official" ? "Имя официального представителя" : undefined} maxLength={key === "phone" ? 30 : key === "email" ? 254 : 160} required disabled={disabled} onChange={(_, data) => onChange({ ...value, [key]: data.value })} />
  </DmField>)}</div>;
}
export function NewContact({ onSave, onCancel }: { onSave: (value: OrganizationContact) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState({ contactName: "", phone: "", email: "" }), [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    const parsed = organizationContactSchema.safeParse(value);
    if (!parsed.success) { setError("Укажите имя, полный номер телефона и корректную электронную почту"); return; }
    lock.current = true; setPending(true); setError(null);
    try { await onSave(parsed.data); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setPending(false); }
  }
  return <form className={styles.contact} aria-label="Новый рабочий контакт" onSubmit={event => { event.preventDefault(); void save(); }}>
    <ContactInputs value={value} onChange={setValue} disabled={pending} />
    {error ? <ActionFeedback tone="error" description={error} /> : null}
    <div className={styles.actions}><DmButton appearance="subtle" density="compact" disabled={pending} onClick={onCancel}>Отмена</DmButton><DmButton type="submit" appearance="primary" density="compact" disabled={pending}>{pending ? "Сохраняем…" : "Добавить контакт"}</DmButton></div>
  </form>;
}
