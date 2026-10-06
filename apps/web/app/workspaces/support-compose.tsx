"use client";
import { useState, type FormEvent } from "react";
import { DmButton, DmDropdown, DmField, DmInput, DmTextarea, SupportFilePicker } from "@marketplace/ui";
import type { UploadedSupportAttachment } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { supportCategories, type SupportDraft } from "./support-presentation";
import styles from "./support.module.css";

export function SupportCompose({ draft, onChange, onSubmit, busy, onCancel, files, onFiles, uploading, onUploading }: {
  draft: SupportDraft; onChange: (draft: SupportDraft) => void; onSubmit: () => Promise<boolean>; busy: boolean; onCancel?: () => void;
  files: UploadedSupportAttachment[]; onFiles: (files: UploadedSupportAttachment[]) => void; uploading: boolean; onUploading: (busy: boolean) => void;
}) {
  const { api } = useWorkspace();
  const [fileError, setFileError] = useState(false);
  const [validated, setValidated] = useState(false);
  const subjectError = draft.subject.trim().length < 4 ? "Укажите тему: не менее 4 символов." : "";
  const descriptionError = draft.description.trim().length < 10 ? "Опишите вопрос подробнее: не менее 10 символов." : "";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy || uploading || fileError) return; setValidated(true);
    if (subjectError || descriptionError) { (event.currentTarget.elements.namedItem(subjectError ? "subject" : "description") as HTMLElement | null)?.focus(); return; }
    void onSubmit().then(saved => { if (saved) setValidated(false); });
  };
  return <section className={styles.compose} aria-labelledby="support-compose-title">
    <div className={styles.panelHeader}><h2 id="support-compose-title">Новое обращение</h2>{onCancel ? <DmButton appearance="subtle" disabled={busy || uploading} onClick={onCancel}>К обращениям</DmButton> : null}</div>
    <form className={styles.form} onSubmit={submit} noValidate>
      <DmField label="Категория"><DmDropdown value={draft.category} disabled={busy} onChange={(_, data) => onChange({ ...draft, category: data.value })}>{Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmDropdown></DmField>
      <DmField label="Тема" required hint="От 4 до 200 символов" validationState={validated && subjectError ? "error" : "none"} validationMessage={validated ? subjectError : undefined}>
        <DmInput name="subject" value={draft.subject} disabled={busy} maxLength={200} placeholder="Например, не получается загрузить остатки" onChange={event => onChange({ ...draft, subject: event.target.value })} />
      </DmField>
      <DmField label="Описание" required hint="Что произошло и какой результат вы ожидали? Если вопрос о заказе, укажите его номер. От 10 символов." validationState={validated && descriptionError ? "error" : "none"} validationMessage={validated ? descriptionError : undefined}>
        <DmTextarea className={styles.descriptionInput} name="description" rows={5} resize="none" value={draft.description} disabled={busy} maxLength={10_000} onChange={event => onChange({ ...draft, description: event.target.value })} />
      </DmField>
      <SupportFilePicker api={api} value={files} onChange={onFiles} disabled={busy} onBusyChange={onUploading} onErrorChange={setFileError} />
      <div className={styles.formActions}><DmButton type="submit" appearance="primary" disabled={busy || uploading || fileError}>{busy ? "Отправляем…" : "Отправить обращение"}</DmButton><span className={styles.muted}>Ответ появится здесь, в поддержке.</span></div>
    </form>
  </section>;
}
