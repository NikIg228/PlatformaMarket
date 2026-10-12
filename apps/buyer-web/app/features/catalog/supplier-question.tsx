"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { ConversationLookup } from "@marketplace/schemas";
import { ActionFeedback, DmButton, DmDialog, ConversationComposer, ConversationContext, emptyConversationDraft, conversationPayload, actionFailure, errorMessage, type ConversationDraft } from "@marketplace/ui";
import { sessionApiContext } from "../../workspace-session";
import type { SupplierOffer } from "./supplier-offers";

/** Drafts live only in this mounted product flow, scoped to the exact supplier offer. */
export function SupplierQuestion({ offer, onClose, onClosed, productName, imageUrl }: {
  offer: SupplierOffer | null; onClose: () => void; onClosed: () => void; productName?: string; imageUrl?: string;
}) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", sessionApiContext), []);
  const [drafts, setDrafts] = useState<Record<string, ConversationDraft>>({});
  const [lookup, setLookup] = useState<ConversationLookup | null>(null), [allowed, setAllowed] = useState(false);
  const [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; description: string; tone: "error" | "warning" } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lock = useRef(false), keys = useRef(new Map<string, { payload: string; key: string }>());
  const id = offer?.id;
  useEffect(() => {
    if (!id) return;
    let active = true; setLookup(null); setAllowed(false); setError(null); setSuccess(null);
    void Promise.all([api.conversationContext("OFFER", id), api.getAccessPolicy()]).then(([result, policy]) => {
      if (!active) return;
      setLookup(result); setAllowed(policy.permissions.includes("support.ticket.create"));
    }, cause => { if (active) setError({ tone: "error", title: "Не удалось открыть вопрос", description: errorMessage(cause) }); });
    return () => { active = false; };
  }, [api, id, attempt]);
  const draft = id ? drafts[id] ?? emptyConversationDraft() : emptyConversationDraft();
  const send = async () => {
    if (!id || !lookup || !allowed || lock.current) return;
    const input = conversationPayload(draft), payload = JSON.stringify(input);
    if (!input.body && !input.attachments.length) return;
    let command = keys.current.get(id);
    if (!command || command.payload !== payload) { command = { payload, key: crypto.randomUUID() }; keys.current.set(id, command); }
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await api.startConversation({ contextType: "OFFER", contextId: id, ...input, idempotencyKey: command.key });
      setDrafts(value => ({ ...value, [id]: emptyConversationDraft() })); keys.current.delete(id);
      setSuccess(result.conversationId); window.dispatchEvent(new Event("marketplace:conversations")); onClose();
    } catch (cause) { setError(actionFailure(cause, { write: true, title: "Не удалось отправить вопрос" })); }
    finally { lock.current = false; setBusy(false); }
  };
  const identity = lookup?.context ?? (offer ? { counterpartyName: offer.supplier.name, title: productName ?? "Предложение поставщика", productName: productName ?? null, productId: null, variantLabel: null, packagingLabel: offer.packaging?.name ?? null, imageUrl: imageUrl ?? null } : null);
  return <>
    {success ? <ActionFeedback tone="success" description="Вопрос отправлен поставщику" action={<a href={`/clinic/messages?conversationId=${success}`}>Открыть переписку</a>} /> : null}
    <DmDialog open={Boolean(offer)} title="Задать вопрос поставщику" mobileFullscreen onOpenChange={open => { if (!open && !busy) onClose(); }} onClosed={onClosed}
      actions={<DmButton disabled={busy} onClick={onClose}>Отмена</DmButton>}>
      {identity ? <ConversationContext key={id} context={{ ...identity, imageUrl: identity.imageUrl ?? imageUrl ?? null }} /> : null}
      {lookup?.conversationId ? <a href={`/clinic/messages?conversationId=${lookup.conversationId}`}>Открыть предыдущую переписку</a> : null}
      {error ? <ActionFeedback {...error} description={`${error.description} Текст и файлы сохранены. Повторная отправка защищена от дублей.`} action={!lookup ? <DmButton onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</DmButton> : undefined} /> : null}
      {lookup && !allowed ? <p role="status">У вашей роли нет права отправлять сообщения. Обратитесь к администратору организации.</p> : null}
      {id ? <ConversationComposer key={id} api={api} context={{ contextType: "OFFER", contextId: id }} draft={draft} busy={busy} disabled={!lookup || !allowed}
        label="Ваш вопрос" submitLabel="Отправить вопрос" question onSubmit={() => void send()}
        onChange={update => setDrafts(value => ({ ...value, [id]: typeof update === "function" ? update(value[id] ?? emptyConversationDraft()) : update }))} /> : null}
      <small>PNG, JPG, PDF · до 10 МБ · до 10 файлов. Переписка не изменяет условия заказа.</small>
    </DmDialog>
  </>;
}
