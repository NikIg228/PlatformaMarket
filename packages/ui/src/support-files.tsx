"use client";
import { DmFileInput } from "./controls";
import { useEffect, useId, useRef, useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { Attach20Regular } from "@fluentui/react-icons/svg/attach";
import { Document20Regular } from "@fluentui/react-icons/svg/document";
import { Dismiss16Regular } from "@fluentui/react-icons/svg/dismiss";
import { ArrowDownload20Regular } from "@fluentui/react-icons/svg/arrow-download";
import { Image20Regular } from "@fluentui/react-icons/svg/image";
import { SUPPORT_FILE_ACCEPT, SUPPORT_FILE_MAX_BYTES, SUPPORT_FILE_MAX_COUNT, type SupportAttachment, type UploadedSupportAttachment, type UploadSupportAttachmentInput } from "@marketplace/schemas";
import { DmButton, DmDialog, errorMessage } from "./index";

type FilesApi = {
  uploadSupportAttachment: (input: UploadSupportAttachmentInput) => Promise<UploadedSupportAttachment>;
  downloadSupportAttachment: (ticketId: string, messageId: string, assetId: string) => Promise<{ blob: Blob; fileName: string | null }>;
};
const useStyles = makeStyles({
  root: { display: "grid", gap: "var(--dm-space-2)", minWidth: 0 },
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--dm-space-2)" },
  hint: { color: tokens.colorNeutralForeground3, fontSize: "var(--dm-font-size-caption)", lineHeight: "var(--dm-line-body)" },
  list: { display: "flex", flexWrap: "wrap", gap: "var(--dm-space-2)", padding: 0, margin: 0, listStyleType: "none", minWidth: 0 },
  compact: { flex: 1 },
  hiddenHint: { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" },
  queue: { maxHeight: "160px", overflowY: "auto" },
  card: { display: "flex", alignItems: "center", gap: "var(--dm-space-2)", minWidth: 0, maxWidth: "100%", padding: "var(--dm-space-2) var(--dm-space-3)", border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: "var(--dm-radius-card)", backgroundColor: tokens.colorNeutralBackground1 },
  identity: { display: "grid", gap: "var(--dm-space-micro)", minWidth: 0 },
  name: { fontSize: "var(--dm-font-size-body)", lineHeight: "var(--dm-line-compact)", overflowWrap: "anywhere" },
  problem: { color: tokens.colorPaletteRedForeground1, fontSize: "var(--dm-font-size-caption)", margin: 0, overflowWrap: "anywhere" },
  preview: { display: "block", maxWidth: "100%", maxHeight: "65dvh", objectFit: "contain", margin: "0 auto" },
});
const size = (bytes: number) => bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} КБ` : `${new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 1 }).format(bytes / 1_000_000)} МБ`;
const base64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(new Error("Не удалось прочитать файл. Выберите его повторно."));
  reader.readAsDataURL(file);
});
type Queued = { id: string; file: File; error?: string };

/** Uploads are private until an authorized message claims them. */
export function SupportFilePicker({ api, value, onChange, disabled, onBusyChange, onErrorChange, compact = false }: {
  api: FilesApi; value: UploadedSupportAttachment[]; onChange: (value: UploadedSupportAttachment[]) => void;
  compact?: boolean; disabled?: boolean; onBusyChange: (busy: boolean) => void; onErrorChange?: (invalid: boolean) => void;
}) {
  const styles = useStyles(), hintId = useId();
  const input = useRef<HTMLInputElement>(null), active = useRef(false), mounted = useRef(true);
  const current = useRef(value); current.current = value;
  const [queue, setQueue] = useState<Queued[]>([]), [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const invalid = queue.some(entry => Boolean(entry.error));
  useEffect(() => { onErrorChange?.(invalid); }, [invalid, onErrorChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onBusyChange(false); }; }, [onBusyChange]);
  const upload = async (entries: Queued[]) => {
    if (active.current) return;
    active.current = true; setUploading(true); onBusyChange(true);
    for (const entry of entries) {
      setQueue(items => items.map(item => item.id === entry.id ? { ...item, error: undefined } : item));
      try {
        const uploaded = await api.uploadSupportAttachment({ fileName: entry.file.name, contentBase64: await base64(entry.file) });
        if (!mounted.current) break;
        current.current = [...current.current, uploaded]; onChange(current.current);
        setQueue(items => items.filter(item => item.id !== entry.id));
      } catch (cause) {
        if (!mounted.current) break;
        setQueue(items => items.map(item => item.id === entry.id ? { ...item, error: errorMessage(cause) } : item));
      }
    }
    active.current = false;
    if (mounted.current) { setUploading(false); onBusyChange(false); }
  };
  const select = (files: File[]) => {
    if (disabled || active.current) return;
    setError("");
    if (files.length + value.length + queue.length > SUPPORT_FILE_MAX_COUNT) { setError(`Можно прикрепить не более ${SUPPORT_FILE_MAX_COUNT} файлов.`); return; }
    const invalid = files.find(file => !/\.(png|jpe?g|pdf|docx|xlsx)$/i.test(file.name) || !file.size || file.size > SUPPORT_FILE_MAX_BYTES);
    if (invalid) { setError(`«${invalid.name}»: выберите PNG, JPG, PDF, DOCX или XLSX размером до 10 МБ. Пустые файлы не принимаются.`); return; }
    const entries = files.map(file => ({ id: crypto.randomUUID(), file }));
    setQueue(items => [...items, ...entries]); void upload(entries);
  };
  return <div className={`${styles.root} ${compact ? styles.compact : ""}`}>
    <DmFileInput ref={input}  multiple accept={SUPPORT_FILE_ACCEPT} hidden aria-label="Файлы обращения" disabled={disabled || uploading}
      onChange={event => { select(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ""; }} />
    <div className={styles.toolbar}><DmButton type="button" appearance="subtle" icon={<Attach20Regular />} aria-label="Прикрепить файл" title="Прикрепить файл · PNG, JPG, PDF, DOCX, XLSX · до 10 МБ · до 10 файлов" aria-describedby={hintId} disabled={disabled || uploading || value.length + queue.length >= SUPPORT_FILE_MAX_COUNT} onClick={() => input.current?.click()}>{compact ? null : "Прикрепить файл"}</DmButton>
      <span id={hintId} className={compact ? styles.hiddenHint : styles.hint}>PNG, JPG, PDF, DOCX, XLSX · до 10 МБ · до 10 файлов</span></div>
    {value.length || queue.length ? <ul className={`${styles.list} ${styles.queue}`} aria-label="Прикреплённые файлы">
      {value.map(file => <li className={styles.card} key={file.assetId}><Document20Regular aria-hidden="true" /><div className={styles.identity}><span className={styles.name}>{file.name}</span><span className={styles.hint}>{size(file.sizeBytes)}</span></div><DmButton type="button" appearance="subtle" size="small" icon={<Dismiss16Regular />} aria-label={`Убрать ${file.name}`} disabled={disabled || uploading} onClick={() => onChange(value.filter(item => item.assetId !== file.assetId))} /></li>)}
      {queue.map(entry => <li className={styles.card} key={entry.id}><Document20Regular aria-hidden="true" /><div className={styles.identity}><span className={styles.name}>{entry.file.name}</span>{entry.error ? <span className={styles.problem} role="alert">{entry.error}</span> : <span className={styles.hint} role="status">Загружаем и проверяем…</span>}</div>
        {entry.error ? <><DmButton type="button" size="small" appearance="subtle" disabled={disabled || uploading} onClick={() => void upload([entry])}>Повторить</DmButton><DmButton type="button" size="small" appearance="subtle" icon={<Dismiss16Regular />} aria-label={`Убрать ${entry.file.name}`} disabled={disabled || uploading} onClick={() => setQueue(items => items.filter(item => item.id !== entry.id))} /></> : null}</li>)}
    </ul> : null}
    {error ? <p role="alert" className={styles.problem}>{error}</p> : null}
    {invalid ? <p className={styles.hint}>Повторите загрузку или уберите файлы с ошибкой перед отправкой.</p> : null}
  </div>;
}

export function SupportAttachmentList({ api, ticketId, messageId, files }: { api: FilesApi; ticketId: string; messageId: string; files: SupportAttachment[] | null }) {
  const styles = useStyles();
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const mounted = useRef(true), lock = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const open = async (file: SupportAttachment, image: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(file.assetId); setError("");
    try {
      const result = await api.downloadSupportAttachment(ticketId, messageId, file.assetId);
      if (!mounted.current) return;
      const url = URL.createObjectURL(result.blob);
      if (image) { setPreviewFailed(false); setPreview({ url, name: file.name }); }
      else { const link = document.createElement("a"); link.href = url; link.download = result.fileName ?? file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (cause) { if (mounted.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (mounted.current) setBusy(null); }
  };
  if (!files?.length) return null;
  return <div className={styles.root}><ul className={styles.list} aria-label="Вложения сообщения">{files.map(file => <li className={styles.card} key={file.assetId}>
    {file.contentType.startsWith("image/") ? <Image20Regular aria-hidden="true" /> : <Document20Regular aria-hidden="true" />}
    <div className={styles.identity}><span className={styles.name}>{file.name}</span><span className={styles.hint}>{busy === file.assetId ? "Загружаем…" : size(file.sizeBytes)}</span></div>
    {file.contentType.startsWith("image/") ? <DmButton type="button" appearance="subtle" size="small" disabled={Boolean(busy)} aria-label={`Посмотреть ${file.name}`} onClick={event => { opener.current = event.currentTarget; void open(file, true); }}>Посмотреть</DmButton> : null}
    <DmButton type="button" appearance="subtle" size="small" icon={<ArrowDownload20Regular />} disabled={Boolean(busy)} aria-label={`Скачать ${file.name}`} onClick={() => void open(file, false)} />
  </li>)}</ul>{error ? <p role="alert" className={styles.problem}>{error} Попробуйте открыть файл ещё раз.</p> : null}
    <DmDialog open={Boolean(preview)} title={preview?.name ?? "Изображение"} onOpenChange={open => { if (!open) setPreview(null); }} onClosed={() => opener.current?.focus()} actions={<DmButton onClick={() => setPreview(null)}>Закрыть</DmButton>}>
      {previewFailed ? <p role="alert">Не удалось показать изображение. Закройте окно и скачайте файл, чтобы открыть его на устройстве.</p> : preview ? <img className={styles.preview} src={preview.url} alt={preview.name} onError={() => setPreviewFailed(true)} /> : null}
    </DmDialog>
  </div>;
}
