"use client";
import { useEffect, useId, useRef, useState } from "react";
import { DmButton, DmTextarea, DmSurface, SupportFilePicker } from "@marketplace/ui";
import type { UploadedSupportAttachment } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import styles from "./support.module.css";

export function SupportReplyComposer({ value, onChange, files, onFiles, busy, uploading, onUploading, reopening, onCancel, onSubmit }: {
  value: string; onChange: (value: string) => void; files: UploadedSupportAttachment[]; onFiles: (files: UploadedSupportAttachment[]) => void;
  busy: boolean; uploading: boolean; onUploading: (busy: boolean) => void; reopening: boolean; onCancel: () => void; onSubmit: () => Promise<boolean>;
}) {
  const { api } = useWorkspace();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [invalid, setInvalid] = useState(false), [fileError, setFileError] = useState(false);
  const errorId = useId();
  useEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(Math.max(field.scrollHeight, 24), 160)}px`;
  }, [value]);
  return <form className={styles.reply} noValidate onSubmit={event => {
    event.preventDefault();
    if (busy || uploading || fileError) return;
    if (!value.trim() && !files.length) { setInvalid(true); textarea.current?.focus(); return; }
    void onSubmit().then(saved => { if (saved) setInvalid(false); });
  }}>
    {reopening ? <p className={styles.reopenHint}>Опишите, что осталось нерешённым.</p> : null}
    <DmSurface variant="composer" data-invalid={invalid && !value.trim() && !files.length}>
      <DmTextarea variant="composer" name="reply" aria-label={reopening ? "Что осталось нерешённым?" : "Сообщение поддержке"}
        aria-describedby={invalid ? errorId : undefined} aria-invalid={invalid && !value.trim() && !files.length}
        textarea={{ ref: textarea }} rows={1} resize="none" disabled={busy} value={value} maxLength={20_000}
        placeholder="Напишите сообщение…" onChange={event => onChange(event.target.value)} />
      <div className={styles.composerActions}><SupportFilePicker compact api={api} value={files} onChange={onFiles} disabled={busy} onBusyChange={onUploading} onErrorChange={setFileError} /><div className={styles.sendActions}>
        {reopening ? <DmButton type="button" appearance="subtle" disabled={busy || uploading} onClick={onCancel}>Отмена</DmButton> : null}
        <DmButton className={styles.sendButton} type="submit" appearance="subtle" aria-label={reopening ? "Отправить и открыть повторно" : "Отправить"} title={reopening ? "Отправить и открыть повторно" : undefined} aria-busy={busy} disabled={busy || uploading || fileError}>{busy ? "Отправляем…" : "Отправить"}</DmButton>
      </div></div>
    </DmSurface>
    {invalid && !value.trim() && !files.length ? <p id={errorId} className={styles.validation} role="alert">Введите сообщение или прикрепите файл.</p> : null}
  </form>;
}
