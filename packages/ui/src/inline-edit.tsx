"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar, Spinner, Tooltip } from "@fluentui/react-components";
import { Edit20Regular } from "@fluentui/react-icons/svg/edit";
import { Checkmark20Regular } from "@fluentui/react-icons/svg/checkmark";
import { DmAction, DmButton, DmFileInput, DmInput } from "./controls";

/** Short independent values: explicit save, preserved draft on failure, no blur save. */
export function DmInlineEdit({ label, value, onSave, disabled = false, required = false, type = "text", maxLength = 160, onEditingChange }: {
  label: string; value: string; onSave: (value: string) => Promise<void>; disabled?: boolean;
  required?: boolean; type?: "text" | "email" | "tel"; maxLength?: number; onEditingChange?: (editing: boolean) => void;
}) {
  const id = useId(), errorId = `${id}-error`;
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value), [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
  const lock = useRef(false), trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const close = () => { setEditing(false); setError(null); onEditingChange?.(false); requestAnimationFrame(() => trigger.current?.focus()); };
  async function save() {
    if (lock.current || disabled) return;
    if (required && !draft.trim()) { setError("Заполните это поле"); input.current?.focus(); return; }
    if (type === "email" && !input.current?.validity.valid) { setError("Укажите корректную электронную почту"); input.current?.focus(); return; }
    lock.current = true; setPending(true); setError(null);
    try { await onSave(draft.trim()); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить. Повторите попытку."); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className="dm-inline-edit" data-editing={editing || undefined}>
    <label id={`${id}-label`} htmlFor={editing ? id : undefined}>{label}{required ? " *" : ""}</label>
    <div className="dm-inline-edit-row">
      {editing ? <DmInput id={id} ref={input} density="compact" type={type} required={required} maxLength={maxLength} value={draft} disabled={pending || disabled}
        aria-labelledby={`${id}-label`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(_, data) => { setDraft(data.value); setError(null); }}
        onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape" && !lock.current) { event.preventDefault(); close(); } }} />
        : <span className="dm-inline-edit-value">{value || "Не указано"}</span>}
      <Tooltip relationship="label" content={editing ? `Сохранить: ${label}` : `Изменить: ${label}`}>
        <DmButton ref={trigger} appearance="subtle" density="compact" aria-label={editing ? `Сохранить: ${label}` : `Изменить: ${label}`} disabled={disabled || pending}
          icon={pending ? <Spinner size="tiny" /> : editing ? <Checkmark20Regular /> : <Edit20Regular />} onClick={() => {
            if (editing) void save(); else { setDraft(value); setEditing(true); setError(null); onEditingChange?.(true); }
          }} />
      </Tooltip>
    </div>
    {error ? <span id={errorId} role="alert" className="dm-inline-edit-error">{error}</span> : null}
    {editing ? <div className="dm-inline-edit-hint"><span>Enter — сохранить</span><DmAction variant="text" density="compact" disabled={pending} onClick={close}>Отмена</DmAction></div> : null}
  </div>;
}

export function DmEditableAvatar({ name, src, disabled, pending, onFile }: { name: string; src?: string; disabled?: boolean; pending?: boolean; onFile: (file: File) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  return <div className="dm-editable-avatar">
    <DmAction variant="avatar" aria-label="Изменить фото профиля" title="Изменить фото профиля" disabled={disabled || pending} onClick={() => picker.current?.click()}>
      <Avatar name={name} size={48} color="brand" image={src ? { src } : undefined} aria-hidden="true" />
      <span className="dm-avatar-edit-overlay" data-pending={pending || undefined}>{pending ? <Spinner size="tiny" /> : <Edit20Regular />}</span>
    </DmAction>
    <DmFileInput ref={picker} hidden aria-label="Фото профиля" accept="image/png,image/jpeg" disabled={disabled || pending} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (file) onFile(file);
    }} />
  </div>;
}
