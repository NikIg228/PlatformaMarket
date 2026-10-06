"use client";
import { useEffect, useRef, useState } from "react";
import { emptySupportDraft, type SupportDraft } from "./support-presentation";
import { uploadedSupportAttachmentSchema, SUPPORT_FILE_MAX_COUNT, type UploadedSupportAttachment } from "@marketplace/schemas";

type Pending = { json: string; key: string };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
/** Tab-local drafts are scoped to both organization and authenticated session. */
export function useSupportDrafts(storageKey: string) {
  const [draft, setDraft] = useState<SupportDraft>(emptySupportDraft);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, UploadedSupportAttachment[]>>({});
  const pending = useRef(new Map<string, Pending>());
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const cached: unknown = raw && raw.length <= 1_000_000 ? JSON.parse(raw) : null;
      if (object(cached) && typeof cached.savedAt === "number" && Date.now() - cached.savedAt < 8 * 3_600_000) {
        if (object(cached.draft) && typeof cached.draft.category === "string" && typeof cached.draft.subject === "string" && typeof cached.draft.description === "string") {
          setDraft({ category: cached.draft.category.slice(0, 80), subject: cached.draft.subject.slice(0, 200), description: cached.draft.description.slice(0, 10_000) });
        }
        if (object(cached.replies)) setReplies(Object.fromEntries(Object.entries(cached.replies).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length <= 20_000)));
        if (object(cached.files)) setFiles(Object.fromEntries(Object.entries(cached.files).flatMap(([scope, value]) => {
          const parsed = uploadedSupportAttachmentSchema.array().max(SUPPORT_FILE_MAX_COUNT).safeParse(value);
          return parsed.success ? [[scope, parsed.data]] : [];
        })));
        if (object(cached.pending)) for (const [scope, entry] of Object.entries(cached.pending)) {
          if (object(entry) && typeof entry.json === "string" && typeof entry.key === "string" && /^[0-9a-f-]{36}$/i.test(entry.key)) {
            try { if (object(JSON.parse(entry.json))) pending.current.set(scope, { json: entry.json, key: entry.key }); } catch { /* Invalid cached command is not replayed. */ }
          }
        }
      }
    } catch { /* Storage can be unavailable; in-memory drafts and the leave guard still work. */ }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (!draft.subject && !draft.description && !Object.values(replies).some(Boolean) && !Object.values(files).some(items => items.length) && !pending.current.size) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), draft, replies, files, pending: Object.fromEntries(pending.current) }));
    } catch { /* Do not discard entered text if the tab's storage quota is exhausted. */ }
  }, [draft, replies, files, revision, ready, storageKey]);
  const key = (scope: string, input: unknown) => {
    const json = JSON.stringify(input); let entry = pending.current.get(scope);
    if (!entry || entry.json !== json) { entry = { json, key: crypto.randomUUID() }; pending.current.set(scope, entry); setRevision(value => value + 1); }
    return entry.key;
  };
  const forget = (scope: string) => { pending.current.delete(scope); setRevision(value => value + 1); };
  return { draft, setDraft, replies, setReplies, files, setFiles, pending, key, forget, ready };
}
