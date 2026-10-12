"use client";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Send24Regular } from "@fluentui/react-icons/svg/send";
import { uploadedConversationAttachmentSchema, type UploadConversationAttachmentInput, type UploadedConversationAttachment } from "@marketplace/schemas";
import { DmButton, DmTextarea, DmSurface, DmField } from "./controls";
import { SupportFilePicker } from "./support-files";
import type { ConversationDraft } from "./conversation-draft";

export type ConversationFilesApi = {
  uploadConversationAttachment(input: UploadConversationAttachmentInput): Promise<UploadedConversationAttachment>;
  downloadConversationAttachment(id: string, messageId: string, assetId: string): Promise<{ blob: Blob; fileName: string | null }>;
};
export function ConversationComposer({ api, context, draft, onChange, disabled, busy, onSubmit, label = "Сообщение", submitLabel = "Отправить", question = false }: {
  api: ConversationFilesApi; context: { contextType: "OFFER" | "ORDER"; contextId: string };
  draft: ConversationDraft; onChange: Dispatch<SetStateAction<ConversationDraft>>;
  disabled?: boolean; busy?: boolean; onSubmit: () => void; label?: string; submitLabel?: string; question?: boolean;
}) {
  const [uploading, setUploading] = useState(false), [invalid, setInvalid] = useState(false);
  const filesApi = useMemo(() => ({
    uploadSupportAttachment: (input: { fileName: string; contentBase64: string }) => api.uploadConversationAttachment({ ...context, ...input }),
    downloadSupportAttachment: api.downloadConversationAttachment.bind(api),
  }), [api, context.contextType, context.contextId]);
  const field = <DmTextarea variant={question ? "default" : "composer"} autoGrow={!question} rows={question ? 4 : undefined} className="dm-conversation-input" aria-label={label}
    placeholder={question ? "Уточните характеристики, комплектацию или поставку" : "Написать сообщение…"}
    value={draft.body} maxLength={10_000} disabled={disabled || busy} onChange={event => { const body = event.target.value; onChange(value => ({ ...value, body })); }} />;
  const picker = <SupportFilePicker api={filesApi} compact policy="conversation" disabled={disabled || busy}
        value={draft.files} onChange={files => onChange(value => ({ ...value, files: files.map(file => uploadedConversationAttachmentSchema.parse(file)) }))}
        queue={draft.queue} onQueueChange={update => onChange(value => ({ ...value, queue: typeof update === "function" ? update(value.queue) : update }))}
        onBusyChange={setUploading} onErrorChange={setInvalid}
        inlineContent={<>{question ? <span className="dm-conversation-input" /> : field}
          <DmButton type="submit" appearance="primary" icon={<Send24Regular />} aria-label={busy ? "Отправляем…" : submitLabel}
            disabled={disabled || busy || uploading || invalid || Boolean(draft.queue.length) || (!draft.body.trim() && !draft.files.length)}>{question ? busy ? "Отправляем…" : submitLabel : null}</DmButton></>} />;
  return <form className="dm-conversation-compose" onSubmit={event => { event.preventDefault(); if (!disabled && !busy && !uploading && !invalid && !draft.queue.length) onSubmit(); }}>
    {question ? <><DmField label={label}>{field}</DmField>{picker}</> : <DmSurface variant="composer"><div className="dm-conversation-compose-inner">{picker}</div></DmSurface>}
  </form>;
}
