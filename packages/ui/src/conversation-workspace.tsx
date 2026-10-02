"use client";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import type { ConversationDetail, ConversationEscalation, ConversationMessageInput, ConversationPage, ConversationQuery, StartConversation } from "@marketplace/schemas";
import { DmButton, DmField, DmSelect, DmTextarea, EmptyState, LoadingState, errorMessage } from "./index";

export type ConversationApi = {
  conversations(query?: Partial<ConversationQuery>): Promise<ConversationPage>;
  conversation(id: string, beforeSequence?: number): Promise<ConversationDetail>;
  conversationContext(type: "OFFER" | "ORDER", id: string): Promise<{ conversationId: string | null }>;
  startConversation(input: StartConversation): Promise<{ conversationId: string }>;
  sendConversationMessage(id: string, input: ConversationMessageInput): Promise<{ conversationId: string }>;
  readConversation(id: string, sequence: number): Promise<{ throughSequence: number }>;
  resolveConversation(id: string, version: number): Promise<{ conversationId: string }>;
  escalateConversation(id: string, input: ConversationEscalation): Promise<{ ticketId: string }>;
};
type Context = { contextType: "OFFER" | "ORDER"; contextId: string };
const announce = () => window.dispatchEvent(new Event("marketplace:conversations"));
const time = (value: string) => new Intl.DateTimeFormat("ru-KZ", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function ConversationCounter({ api, href, icon }: { api: Pick<ConversationApi, "conversations">; href: string; icon?: ReactElement }) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try { const result = await api.conversations({ limit: 1 }); if (active) { setCount(result.unreadCount); setFailed(false); } }
      catch { if (active) setFailed(true); }
      finally { pending = false; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    window.addEventListener("marketplace:conversations", load);
    document.addEventListener("visibilitychange", load);
    return () => { active = false; clearInterval(interval); window.removeEventListener("marketplace:conversations", load); document.removeEventListener("visibilitychange", load); };
  }, [api]);
  return <DmButton as="a" href={href} icon={icon} appearance={icon ? "subtle" : undefined} style={icon ? { position: "relative" } : undefined} aria-label={failed ? "Сообщения, счётчик временно недоступен" : `Сообщения${count === null ? "" : `, непрочитанных диалогов: ${count}`}`}>
    {icon ? failed || count ? <span aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, minWidth: 16, borderRadius: 10, padding: "0 3px", fontSize: 11, lineHeight: "16px", background: "var(--dm-brand-primary)", color: "var(--dm-surface)" }}>{failed ? "!" : count! > 99 ? "99+" : count}</span> : null : <>Сообщения{failed ? " · !" : count ? ` · ${count}` : ""}</>}
  </DmButton>;
}

export function ConversationWorkspace({ api, organizationId, initialId, context, canWrite = true, operator = false, contextHref }: { api: ConversationApi; organizationId: string; initialId?: string; context?: Context; canWrite?: boolean; operator?: boolean; contextHref?: (type: "OFFER" | "ORDER", id: string) => string | undefined }) {
  const [selected, setSelected] = useState(initialId);
  const [filter, setFilter] = useState<ConversationQuery["filter"]>("ALL");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<ConversationPage | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupReady, setLookupReady] = useState(!context);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [escalating, setEscalating] = useState(false);
  const request = useRef(0);
  const lock = useRef(false);
  const messageKeys = useRef(new Map<string, { body: string; key: string }>());
  const escalationKey = useRef<{ reason: string; key: string } | null>(null);
  const draftId = selected ?? `${context?.contextType}:${context?.contextId}`;
  const draft = drafts[draftId] ?? "";

  useEffect(() => {
    if (!context) return;
    let active = true;
    setLookupReady(false);
    void api.conversationContext(context.contextType, context.contextId).then(result => { if (active) { setSelected(result.conversationId ?? undefined); setLookupReady(true); } }, cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [api, context?.contextId, context?.contextType, lookupAttempt]);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    try {
      const [nextPage, nextDetail] = await Promise.all([api.conversations({ filter, offset }), selected ? api.conversation(selected) : Promise.resolve(null)]);
      if (current !== request.current) return;
      setPage(nextPage); setDetail(previous => {
        if (!previous || !nextDetail || previous.conversation.id !== nextDetail.conversation.id) return nextDetail;
        const first = nextDetail.messages[0]?.sequence;
        const older = first === undefined ? [] : previous.messages.filter(message => message.sequence < first);
        return older.length ? { ...nextDetail, messages: [...older, ...nextDetail.messages], hasOlder: previous.hasOlder } : nextDetail;
      }); if (lookupReady) setError("");
      if (nextDetail && document.visibilityState === "visible") {
        await api.readConversation(nextDetail.conversation.id, nextDetail.conversation.latestSequence);
        if (current === request.current) announce();
      }
    } catch (cause) { if (current === request.current) setError(errorMessage(cause)); }
    finally { if (current === request.current) setLoading(false); }
  }, [api, selected, filter, offset, lookupReady]);
  useEffect(() => { setDetail(null); void refresh(); return () => { request.current++; }; }, [refresh]);
  useEffect(() => {
    const reload = () => { if (!lock.current && document.visibilityState === "visible") void refresh(); };
    const interval = window.setInterval(reload, 30_000);
    document.addEventListener("visibilitychange", reload);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", reload); };
  }, [refresh]);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setFeedback("");
    try { await action(); announce(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const send = () => run(async () => {
    const body = draft.trim();
    if (!body) return;
    let pending = messageKeys.current.get(draftId);
    if (!pending || pending.body !== body) { pending = { body, key: crypto.randomUUID() }; messageKeys.current.set(draftId, pending); }
    const input = { body, idempotencyKey: pending.key };
    const result = selected ? await api.sendConversationMessage(selected, input) : context ? await api.startConversation({ ...context, ...input }) : null;
    if (!result) return;
    setDrafts(value => ({ ...value, [draftId]: "" })); messageKeys.current.delete(draftId);
    setFeedback("Сообщение сохранено и отправлено.");
    if (selected === result.conversationId) await refresh(); else setSelected(result.conversationId);
  });
  const choose = (id?: string) => { setSelected(id); setDetail(null); setReason(""); setEscalating(false); setFeedback(""); };
  const current = detail?.conversation;
  const href = current?.productId ? `/products/${current.productId}` : current ? contextHref?.(current.contextType, current.contextId) : undefined;
  return <section className="dm-conversations" aria-label="Сообщения">
    <div className="dm-conversations-toolbar"><h1>Сообщения</h1><DmButton disabled={loading || busy} onClick={() => void refresh()}>Обновить</DmButton></div>
    {error ? <div role="alert"><p>{error} Введённый текст сохранён. Повторите действие после проверки соединения.</p><DmButton disabled={busy} onClick={() => { if (!lookupReady && context) setLookupAttempt(value => value + 1); else void refresh(); }}>Повторить загрузку</DmButton></div> : null}
    {feedback ? <p role="status">{feedback}</p> : null}
    <div className="dm-conversations-layout" data-selected={Boolean(selected || context)}>
      <aside className="dm-conversations-list" aria-label="Список диалогов">
        <DmField label="Показать"><DmSelect value={filter} disabled={busy} onChange={event => { setFilter(event.target.value as ConversationQuery["filter"]); setOffset(0); }}><option value="ALL">Все</option><option value="UNREAD">Непрочитанные</option><option value="ORDERS">По заказам</option></DmSelect></DmField>
        {loading && !page ? <LoadingState label="Загружаем диалоги" /> : page?.items.length === 0 ? <EmptyState title="Диалогов пока нет" description="Начните переписку из предложения поставщика или заказа." /> : null}
        {page?.items.map(item => <DmButton className="dm-conversations-item" key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => choose(item.id)}><span><strong>{item.counterpartyName}{item.unread ? " · Новое" : ""}</strong><span>{item.title}{item.resolved ? " · Решён" : ""}</span><span className="dm-conversations-preview">{item.lastMessage}</span><small>{time(item.updatedAt)}</small></span></DmButton>)}
        <div className="dm-conversations-toolbar"><DmButton disabled={!offset || busy} onClick={() => setOffset(value => Math.max(0, value - 30))}>Назад</DmButton><DmButton disabled={!page?.hasMore || busy} onClick={() => setOffset(value => value + 30)}>Далее</DmButton></div>
      </aside>
      <div className="dm-conversations-detail">
        {selected || context ? <>
          <DmButton className="dm-conversations-back" disabled={busy} as={context ? "a" : undefined} href={context ? "?" : undefined} onClick={context ? undefined : () => choose(undefined)}>← К списку</DmButton>
          {current ? <header><h2>{current.title}</h2><p>{current.counterpartyName}</p>{href ? <a href={href}>Открыть {current.contextType === "ORDER" ? "заказ" : "предложение"}</a> : null}<p>{current.resolved ? "Вопрос решён. Новое сообщение откроет его снова." : "Открытый вопрос"}</p>{current.supportTicketId ? <p role="status">К диалогу подключён оператор площадки.</p> : null}</header> : <h2>{context?.contextType === "OFFER" ? "Вопрос по предложению" : "Переписка по заказу"}</h2>}
          <p>Сообщение не подтверждает заказ и не изменяет цену, оплату или условия доставки.</p>
          {loading && selected && !detail ? <LoadingState label="Загружаем переписку" /> : null}
          {detail?.hasOlder ? <DmButton disabled={busy} onClick={() => void run(async () => { const older = await api.conversation(selected!, detail.messages[0].sequence); setDetail(value => value ? { ...value, hasOlder: older.hasOlder, messages: [...older.messages, ...value.messages] } : value); })}>Ранние сообщения</DmButton> : null}
          <ol className="dm-conversations-history" aria-label="История сообщений">{detail?.messages.map(message => <li key={message.id} data-own={message.authorOrganizationId === organizationId}><strong>{message.authorName} · {message.authorRole === "OPERATOR" ? "Оператор площадки" : message.authorRole === "BUYER" ? "Клиника" : "Поставщик"}</strong><p>{message.body}</p><small>{time(message.createdAt)} · {message.readByCounterparty ? "Прочитано представителем компании" : "Отправлено"}</small></li>)}</ol>
          {canWrite ? <form onSubmit={event => { event.preventDefault(); void send(); }}><DmField label="Сообщение"><DmTextarea value={draft} maxLength={10_000} disabled={busy || !lookupReady} onChange={event => setDrafts(value => ({ ...value, [draftId]: event.target.value }))} /></DmField><DmButton appearance="primary" type="submit" disabled={busy || !lookupReady || !draft.trim() || Boolean(selected && !detail)}>{busy ? "Сохраняем…" : "Отправить"}</DmButton></form> : <p>У вашей роли нет права отправлять сообщения.</p>}
          {current && canWrite ? <div className="dm-conversations-toolbar"><DmButton disabled={busy || current.resolved} onClick={() => void run(async () => { await api.resolveConversation(current.id, current.version); setFeedback("Вопрос отмечен решённым."); await refresh(); })}>Вопрос решён</DmButton>{!operator && !current.supportTicketId ? <DmButton disabled={busy} onClick={() => setEscalating(value => !value)}>Обратиться к оператору</DmButton> : null}</div> : null}
          {escalating && current ? <form onSubmit={event => { event.preventDefault(); void run(async () => { if (!escalationKey.current || escalationKey.current.reason !== reason.trim()) escalationKey.current = { reason: reason.trim(), key: crypto.randomUUID() }; await api.escalateConversation(current.id, { reason: reason.trim(), idempotencyKey: escalationKey.current.key }); setEscalating(false); setReason(""); setFeedback("Обращение создано. Оператор получил доступ к этому диалогу."); await refresh(); }); }}><DmField label="Причина обращения (не менее 10 символов)"><DmTextarea value={reason} disabled={busy} maxLength={2_000} onChange={event => setReason(event.target.value)} /></DmField><DmButton type="submit" disabled={busy || reason.trim().length < 10}>Создать обращение</DmButton></form> : null}
        </> : <EmptyState title="Выберите диалог" description="Здесь появится история переписки по предложению или заказу." />}
      </div>
    </div>
  </section>;
}
