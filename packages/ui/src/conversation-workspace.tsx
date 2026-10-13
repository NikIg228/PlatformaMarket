"use client";
import { ActionFeedback } from "./action-feedback";
import { DmAction } from "./controls";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Option } from "@fluentui/react-components";
import { DmFluentDropdown as Dropdown } from "./controls";
import { conversationPages, conversationPageSize } from "./conversation-pages";
import type { ConversationDetail, ConversationEscalation, ConversationMessageInput, ConversationPage, ConversationQuery, StartConversation, ConversationLookup, ConversationContextInfo } from "@marketplace/schemas";
import { DmButton, DmField, DmSelect, EmptyState, errorMessage, actionFailure, dmDropdownPositioning } from "./index";

export type ConversationApi = ConversationFilesApi & {
  conversations(query?: Partial<ConversationQuery>): Promise<ConversationPage>;
  conversation(id: string, beforeSequence?: number): Promise<ConversationDetail>;
  conversationContext(type: "OFFER" | "ORDER", id: string): Promise<ConversationLookup>;
  startConversation(input: StartConversation): Promise<{ conversationId: string }>;
  sendConversationMessage(id: string, input: ConversationMessageInput): Promise<{ conversationId: string }>;
  readConversation(id: string, sequence: number): Promise<{ throughSequence: number }>;
  resolveConversation(id: string, version: number, decision?: string): Promise<{ conversationId: string }>;
  escalateConversation(id: string, input: ConversationEscalation): Promise<{ ticketId: string }>;
};
import { ConversationActions } from "./conversation-actions";
import { ConversationComposer, type ConversationFilesApi } from "./conversation-composer";
import { ConversationHistory } from "./conversation-history";
import { ConversationContext } from "./conversation-context";
import { emptyConversationDraft, conversationPayload, completeConversationUpdate, type ConversationDraft } from "./conversation-draft";
type Context = { contextType: "OFFER" | "ORDER"; contextId: string };
const announce = () => window.dispatchEvent(new Event("marketplace:conversations"));
const time = (value: string) => new Intl.DateTimeFormat("ru-KZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function ConversationCounter({ api, href, icon, showLabel = false, onClick, current }: { api: Pick<ConversationApi, "conversations">; href: string; icon?: ReactElement; showLabel?: boolean; onClick?: () => void; current?: boolean }) {
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
  const label = failed ? "Сообщения, счётчик временно недоступен" : `Сообщения${count === null ? "" : `, непрочитанных диалогов: ${count}`}`;
  if (showLabel) return <a href={href} onClick={onClick} aria-current={current ? "page" : undefined} aria-label={label}>
    {icon ? <span aria-hidden="true">{icon}</span> : null}Сообщения{failed ? " · !" : count ? ` · ${count}` : ""}
  </a>;
  return <DmButton as="a" href={href} icon={icon} onClick={onClick} aria-current={current ? "page" : undefined} appearance={icon ? "subtle" : undefined} style={icon ? { position: "relative" } : undefined} aria-label={label}>
    {icon && !showLabel ? failed || count ? <span aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, minWidth: 16, borderRadius: "var(--dm-radius-pill)", padding: "0 var(--dm-space-micro)", fontSize: "var(--dm-font-size-caption)", lineHeight: "var(--dm-line-compact)", background: "var(--dm-brand-primary)", color: "var(--dm-surface)" }}>{failed ? "!" : count! > 99 ? "99+" : count}</span> : null : <>Сообщения{failed ? " · !" : count ? ` · ${count}` : ""}</>}
  </DmButton>;
}

export function ConversationWorkspace({ api, organizationId, initialId, context, canWrite = true, operator = false, contextHref, hideHeading = false, hideRefresh = false, compactList = false, onSelect }: { api: ConversationApi; organizationId: string; initialId?: string; context?: Context; canWrite?: boolean; operator?: boolean; contextHref?: (type: "OFFER" | "ORDER", id: string) => string | undefined; hideHeading?: boolean; hideRefresh?: boolean; compactList?: boolean; onSelect?: (id?: string) => void }) {
  const [selected, setSelected] = useState(initialId);
  useEffect(() => { setSelected(initialId); }, [initialId]);
  const [filter, setFilter] = useState<ConversationQuery["filter"]>("ALL");
  const [offset, setOffset] = useState(0);
  const listEnd = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<ConversationPage | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const detailRef = useRef(detail); detailRef.current = detail;
  const [loading, setLoading] = useState(true);
  const [lookupReady, setLookupReady] = useState(!context);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<ReturnType<typeof actionFailure> | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ConversationDraft>>({});
  const request = useRef(0);
  const lock = useRef(false);
  const messageKeys = useRef(new Map<string, { body: string; key: string }>());
  const draftId = selected ?? `${context?.contextType}:${context?.contextId}`;
  const draft = drafts[draftId] ?? emptyConversationDraft();
  const [lookupContext, setLookupContext] = useState<ConversationContextInfo>();
  const [sent, setSent] = useState(0);
  const readThrough = useRef(new Map<string, number>());
  const polling = useRef(false);
  const updateDraft = (update: React.SetStateAction<ConversationDraft>) => setDrafts(value => ({ ...value, [draftId]: typeof update === "function" ? update(value[draftId] ?? emptyConversationDraft()) : update }));

  useEffect(() => {
    if (!context) return;
    let active = true;
    setLookupReady(false);
    void api.conversationContext(context.contextType, context.contextId).then(result => { if (active) { setSelected(result.conversationId ?? undefined); setLookupContext(result.context); setLookupReady(true); setError(""); } }, cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [api, context?.contextId, context?.contextType, lookupAttempt]);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    try {
      const [nextPage, nextDetail] = await Promise.all([compactList ? conversationPages(query => api.conversations(query), filter, offset) : api.conversations({ filter, offset }), selected ? api.conversation(selected) : Promise.resolve(null)]);
      if (current !== request.current) return;
      const complete = nextDetail ? await completeConversationUpdate(detailRef.current, nextDetail,
        before => api.conversation(nextDetail.conversation.id, before), () => current === request.current) : null;
      if (current !== request.current) return;
      setPage(nextPage); setDetail(complete);
      if (lookupReady) setError("");
    } catch (cause) { if (current === request.current) setError(errorMessage(cause)); }
    finally { if (current === request.current) setLoading(false); }
  }, [api, selected, filter, offset, lookupReady, compactList]);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
  useEffect(() => {
    const reload = () => { if (!lock.current && !polling.current && document.visibilityState === "visible") { polling.current = true; void refresh().finally(() => { polling.current = false; }); } };
    const interval = window.setInterval(reload, 30_000);
    document.addEventListener("visibilitychange", reload);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", reload); };
  }, [refresh]);

  useEffect(() => {
    const sentinel = listEnd.current;
    if (!compactList || !sentinel || !page?.hasMore || loading || busy || error || offset >= 99_990) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        setOffset(value => value + conversationPageSize);
      }
    }, { root: sentinel.parentElement, rootMargin: "80px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [compactList, page?.hasMore, loading, busy, error, offset]);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError(null); setFeedback("");
    try { await action(); announce(); }
    catch (cause) { setActionError(actionFailure(cause, { write: true })); }
    finally { lock.current = false; setBusy(false); }
  };
  const send = () => run(async () => {
    const payload = conversationPayload(draft);
    if (!payload.body && !payload.attachments.length) return;
    const body = JSON.stringify(payload);
    let pending = messageKeys.current.get(draftId);
    if (!pending || pending.body !== body) { pending = { body, key: crypto.randomUUID() }; messageKeys.current.set(draftId, pending); }
    const input = { ...payload, idempotencyKey: pending.key };
    const result = selected ? await api.sendConversationMessage(selected, input) : context ? await api.startConversation({ ...context, ...input }) : null;
    if (!result) return;
    setDrafts(value => ({ ...value, [draftId]: emptyConversationDraft() })); messageKeys.current.delete(draftId);
    setSent(value => value + 1);
    if (selected === result.conversationId) await refresh(); else { setSelected(result.conversationId); onSelect?.(result.conversationId); }
  });
  const choose = (id?: string) => { setSelected(id); onSelect?.(id); setDetail(null); setFeedback(""); setActionError(null); };
  const markRead = useCallback((sequence: number) => {
    if (!selected || document.visibilityState !== "visible" || sequence <= (readThrough.current.get(selected) ?? 0)) return;
    const id = selected; readThrough.current.set(id, sequence);
    void api.readConversation(id, sequence).then(() => {
      setPage(value => value ? { ...value, items: value.items.map(item => item.id === id && item.latestSequence <= sequence ? { ...item, unread: false } : item) } : value);
      announce();
    }, () => { readThrough.current.delete(id); });
  }, [api, selected]);
  const current = detail?.conversation;
  const href = current?.productId ? `/products/${current.productId}` : current ? contextHref?.(current.contextType, current.contextId) : undefined;
  const identity = current?.context ?? (!selected ? lookupContext : undefined) ?? (current ? { title: current.title, counterpartyName: current.counterpartyName, productId: current.productId, productName: null, variantLabel: null, packagingLabel: null, imageUrl: null } : undefined);
  const messageContext = current ? { contextType: current.contextType, contextId: current.contextId } : context;
  return <section className="dm-conversations" aria-label="Сообщения">
    {!hideHeading || !hideRefresh ? <div className="dm-conversations-toolbar">{!hideHeading ? <h1>Сообщения</h1> : null}{!hideRefresh ? <DmButton disabled={loading || busy} onClick={() => void refresh()}>Обновить</DmButton> : null}</div> : null}
    {error ? <ActionFeedback tone="error" description={`${error} Введённый текст сохранён. Повторите действие после проверки соединения.`} action={<DmButton disabled={busy} onClick={() => { if (!lookupReady && context) setLookupAttempt(value => value + 1); else void refresh(); }}>Повторить загрузку</DmButton>} /> : null}
    {feedback ? <ActionFeedback tone="success" description={feedback} /> : null}
    {actionError ? <ActionFeedback {...actionError} description={`${actionError.description} Текст и файлы сохранены. Повторная отправка защищена от дублей.`} /> : null}
    <div className="dm-conversations-layout" data-selected={Boolean(selected || context)}>
      <aside className="dm-conversations-list" aria-label="Список диалогов" aria-busy={!page && loading}>
        {compactList ? <Dropdown className="dm-conversations-filter" aria-label="Фильтр диалогов" disabled={busy}
          positioning={dmDropdownPositioning} selectedOptions={[filter]} value={{ ALL: "Все", UNREAD: "Непрочитанные", ORDERS: "По заказам" }[filter]}
          onOptionSelect={(_, data) => { if (data.optionValue && data.optionValue !== filter) { setPage(null); setFilter(data.optionValue as ConversationQuery["filter"]); setOffset(0); } }}>
          <Option value="ALL">Все</Option><Option value="UNREAD">Непрочитанные</Option><Option value="ORDERS">По заказам</Option>
        </Dropdown> : <DmField label="Показать"><DmSelect value={filter} disabled={busy} onChange={event => { setPage(null); setFilter(event.target.value as ConversationQuery["filter"]); setOffset(0); }}><option value="ALL">Все</option><option value="UNREAD">Непрочитанные</option><option value="ORDERS">По заказам</option></DmSelect></DmField>}
        {loading && !page ? <div className="dm-conversations-placeholder" /> : page?.items.length === 0 ? <EmptyState title="Диалогов пока нет" description="Начните переписку из предложения поставщика или заказа." /> : null}
        {page?.items.map(item => <DmAction variant="row" density="compact" className="dm-conversations-item" key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => choose(item.id)} title={[item.counterpartyName, item.title, item.lastMessage].join(" · ")}>
          <span><span className="dm-conversations-row-top"><strong>{item.counterpartyName}</strong><time dateTime={item.updatedAt}>{time(item.updatedAt)}</time>{item.unread ? <span className="dm-conversation-unread" aria-label="Непрочитанное сообщение" /> : null}</span>
          <span className="dm-conversations-preview">{item.context?.productName ?? item.title} · {item.lastMessage}</span></span></DmAction>)}
        {compactList ? <div ref={listEnd} className="dm-conversations-list-end" /> : <div className="dm-conversations-toolbar"><DmButton disabled={!offset || busy || loading} onClick={() => setOffset(value => Math.max(0, value - 30))}>Назад</DmButton><DmButton disabled={!page?.hasMore || busy || loading} onClick={() => setOffset(value => value + 30)}>Далее</DmButton></div>}
      </aside>
      <div className="dm-conversations-detail">
        {selected || context ? <>
          <DmButton className="dm-conversations-back" disabled={busy} as={context ? "a" : undefined} href={context ? "?" : undefined} onClick={context ? undefined : () => choose(undefined)}>← К списку</DmButton>
          <header className="dm-conversation-header">
            {identity ? <ConversationContext key={identity.productId ?? draftId} context={identity} href={href ?? (identity.productId ? "/products/" + identity.productId : undefined)} /> : <div aria-busy="true" className="dm-conversations-placeholder" />}
            <ConversationActions api={api} conversation={current} operator={operator} canWrite={canWrite} busy={busy} run={run} refresh={refresh} feedback={setFeedback} />
          </header>
          <ConversationHistory key={`history:${draftId}`} api={api} detail={detail} organizationId={organizationId} busy={busy} sent={sent} onRead={markRead} onOlder={() => void run(async () => {
            if (!selected || !detail?.messages.length) return;
            const older = await api.conversation(selected, detail.messages[0].sequence);
            setDetail(value => value && value.conversation.id === older.conversation.id ? { ...value, hasOlder: older.hasOlder, messages: [...older.messages, ...value.messages] } : value);
          })} />
          {canWrite && messageContext ? <ConversationComposer key={`composer:${draftId}`} api={api} context={messageContext} draft={draft} onChange={updateDraft} disabled={!lookupReady || Boolean(selected && !detail)} busy={busy} onSubmit={() => void send()} /> : <p>У вашей роли нет права отправлять сообщения.</p>}
        </> : <EmptyState title="Выберите диалог" description="Здесь появится история переписки по предложению или заказу." />}
      </div>
    </div>
  </section>;
}
