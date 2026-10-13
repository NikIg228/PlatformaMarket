"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
import { MoreHorizontal24Regular } from "@fluentui/react-icons/svg/more-horizontal";
import type { ConversationSummary } from "@marketplace/schemas";
import { DmButton, DmDialog, DmField, DmTextarea, StatusTag } from "./index";
import type { ConversationApi } from "./conversation-workspace";

export function ConversationActions({ api, conversation, operator, canWrite, busy, run, refresh, feedback }: {
  api: ConversationApi; conversation?: ConversationSummary; operator: boolean; canWrite: boolean; busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; feedback: (value: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [restoreFocus, setRestoreFocus] = useState(false);
  useEffect(() => { if (restoreFocus && !busy) { trigger.current?.focus(); setRestoreFocus(false); } }, [restoreFocus, busy]);
  const [modal, setModal] = useState<{ id: string; kind: "escalate" | "resolve" } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, { reason: string; key: string }>());
  const ticketStatus = conversation?.supportStatus;
  const finished = ticketStatus ? ticketStatus === "RESOLVED" || ticketStatus === "CLOSED" : Boolean(conversation?.resolved);
  const reviewing = Boolean(conversation?.supportTicketId && !finished);
  const status = finished ? "Вопрос решён" : reviewing ? ticketStatus === "IN_PROGRESS" || ticketStatus === "WAITING_CUSTOMER" ? "На рассмотрении" : "Передано в поддержку" : "Активен";
  const open = Boolean(modal && modal.id === conversation?.id);
  const resolving = modal?.kind === "resolve";
  const key = modal ? `${modal.kind}:${modal.id}` : "";
  const reason = drafts[key] ?? "";
  const submit = () => {
    if (!conversation || !open || reason.trim().length < 10 || busy) return;
    void run(async () => {
      if (resolving) {
        await api.resolveConversation(conversation.id, conversation.version, reason.trim());
        feedback("Решение опубликовано в диалоге. Рассмотрение завершено.");
      } else {
        let command = pending.current.get(conversation.id);
        if (!command || command.reason !== reason.trim()) { command = { reason: reason.trim(), key: crypto.randomUUID() }; pending.current.set(conversation.id, command); }
        await api.escalateConversation(conversation.id, { reason: reason.trim(), idempotencyKey: command.key });
        pending.current.delete(conversation.id);
        feedback("Обращение передано в поддержку. Оператор получил доступ к диалогу и вложениям.");
      }
      setDrafts(value => ({ ...value, [key]: "" })); setModal(null);
      await refresh();
    });
  };
  return <div className="dm-conversation-actions">
    <div className="dm-conversation-status" role="status"><StatusTag tone={finished ? "success" : reviewing ? "warning" : "neutral"}>{status}</StatusTag></div>
    {conversation && canWrite ? <Menu><MenuTrigger disableButtonEnhancement><DmButton ref={trigger} appearance="subtle" icon={<MoreHorizontal24Regular />} aria-label="Действия с диалогом" disabled={busy} /></MenuTrigger><MenuPopover><MenuList>
      {(!conversation.supportTicketId || operator) ? <MenuItem disabled={finished} onClick={() => {
        if (conversation.supportTicketId) setModal({ id: conversation.id, kind: "resolve" });
        else void run(async () => { await api.resolveConversation(conversation.id, conversation.version); feedback("Вопрос отмечен решённым."); await refresh(); });
      }}>{conversation.supportTicketId ? "Завершить рассмотрение" : "Вопрос решён"}</MenuItem> : <MenuItem disabled>Рассмотрение завершает оператор</MenuItem>}
      {!operator && !reviewing ? <MenuItem onClick={() => setModal({ id: conversation.id, kind: "escalate" })}>{conversation.supportTicketId ? "Повторно обратиться к оператору" : "Обратиться к оператору"}</MenuItem> : null}
    </MenuList></MenuPopover></Menu> : null}
    <DmDialog open={open} title={resolving ? "Решение оператора" : "Обратиться к оператору"}
      description={resolving ? "Решение появится в общем диалоге и будет видно клинике и поставщику." : "Оператор получит доступ ко всей переписке и вложениям. Причина обращения будет видна обеим сторонам. Во время рассмотрения можно добавлять сообщения; завершает его оператор."}
      onOpenChange={value => { if (!value && !busy) setModal(null); }} onClosed={() => setRestoreFocus(true)}
      actions={<><DmButton disabled={busy} onClick={() => setModal(null)}>Отмена</DmButton><DmButton appearance="primary" disabled={busy || reason.trim().length < 10} onClick={submit}>{busy ? "Сохраняем…" : resolving ? "Опубликовать решение" : "Создать обращение"}</DmButton></>}>
      <DmField label={resolving ? "Решение для участников" : "Причина обращения"} hint="Не менее 10 символов" required>
        <DmTextarea value={reason} disabled={busy} maxLength={2_000} rows={5} onChange={event => setDrafts(value => ({ ...value, [key]: event.target.value }))} />
      </DmField>
    </DmDialog>
  </div>;
}
