"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import { outboxDeadLetterQuerySchema, outboxReplaySchema, outboxDeadLetterItemSchema, type OutboxDeadLetterItem, type OutboxReplayInput } from "@marketplace/schemas";
import { DmButton, DmDialog, DmFeedback, DmField, DmInput, DmSurface, DmTextarea, EmptyState, ErrorState, LoadingState } from "@marketplace/ui";
import { adminApiContext, readAdminSession } from "./admin-auth";
import { useAdminQuery } from "./use-admin-query";
import { useOperatorProjection } from "./use-operator-projection";
import { auditTime } from "./operator-audit";
import styles from "./operator-orders.module.css";

type PendingReplay = { event: OutboxDeadLetterItem; input: OutboxReplayInput };
const signature = (event: OutboxDeadLetterItem) => `${event.id}:${event.availableAt}:${event.attempts}`;
export function OperatorDeadLetters({ canReplay, onReplayed }: { canReplay: boolean; onReplayed: () => Promise<void> }) {
  const { state, write } = useAdminQuery();
  const [eventType, setEventType] = useState(state.outboxEventType), [eventId, setEventId] = useState(state.outboxEventId), [invalid, setInvalid] = useState(false);
  useEffect(() => { setEventType(state.outboxEventType); setEventId(state.outboxEventId); setInvalid(false); }, [state.outboxEventType, state.outboxEventId]);
  const { outboxEventType, outboxEventId, outboxOffset } = state;
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.listOutboxDeadLetters({ eventType: outboxEventType || undefined, eventId: outboxEventId || undefined, offset: outboxOffset, limit: 25 }, signal), [outboxEventType, outboxEventId, outboxOffset]);
  // Keyed child clears stale rows when filters change; replay state stays above it.
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState<OutboxDeadLetterItem | null>(null), [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [pending, setPending] = useState<PendingReplay | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false), [fresh, setFresh] = useState<OutboxDeadLetterItem | null | undefined>(), [handled, setHandled] = useState<string[]>([]);
  const trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null), lock = useRef(false), retryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open && error && !busy) retryButton.current?.focus(); }, [open, error, busy]);
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const storageKey = useMemo(() => `operator-replay:${readAdminSession()?.sessionId ?? "development"}`, []);
  useEffect(() => {
    try { const saved = sessionStorage.getItem(storageKey); if (saved) { const value = JSON.parse(saved) as PendingReplay; const event = outboxDeadLetterItemSchema.parse(value.event), input = outboxReplaySchema.parse(value.input); setPending({ event, input }); setSelected(event); setReason(input.reason); } } catch { setError("Не удалось восстановить незавершённое действие. Проверьте журнал перед новым повтором."); }
  }, [storageKey]);
  const persist = (value: PendingReplay | null) => { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); setPending(value); };
  async function replay() {
    if (!selected || lock.current || !canReplay || conflict) return;
    const command = pending ?? { event: selected, input: { idempotencyKey: crypto.randomUUID(), reason: reason.trim(), expectedAvailableAt: selected.availableAt, expectedAttempts: selected.attempts } };
    if (!outboxReplaySchema.safeParse(command.input).success) { setError("Укажите причину от 10 до 500 символов."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      // Persist before sending: a lost response or navigation must retain this exact command.
      persist(command);
      await api.replayOutboxDeadLetter(command.event.id, command.input);
      setHandled(previous => [...previous, signature(command.event)]); persist(null); setOpen(false); setSelected(null);
      setNotice(`Событие ${command.event.id} поставлено в очередь. Попытки сброшены; обработка ещё не подтверждена.`);
      setRevision(previous => previous + 1); void onReplayed();
    } catch (cause) {
      if (cause instanceof MarketplaceApiError && cause.status === 409) { setConflict(true); setFresh(undefined); setError("Состояние события изменилось. Загрузите его актуальное состояние перед новым решением."); }
      else if (cause instanceof MarketplaceApiError && [401, 403].includes(cause.status)) setError("Нет права на повтор. Проверьте вход и разрешения оператора.");
      else setError("Результат запроса не подтверждён. Проверьте соединение и повторите этот же запрос с сохранённой причиной.");
    } finally { lock.current = false; setBusy(false); }
  }
  async function refreshConflict() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true);
    try { const result = await api.listOutboxDeadLetters({ eventId: selected.id, limit: 1 }); setFresh(result.items[0] ?? null); setError(""); setRevision(previous => previous + 1); }
    catch { setError("Не удалось проверить событие. Повторите загрузку; новый запрос не отправлен."); }
    finally { lock.current = false; setBusy(false); }
  }
  function acceptFresh() {
    try { persist(null); } catch { setError("Не удалось сохранить состояние действия. Повторите попытку."); return; }
    setConflict(false); setError("");
    if (fresh) { setSelected(fresh); setFresh(undefined); }
    else { setSelected(null); setOpen(false); setFresh(undefined); }
  }
  return <section className={styles.section} aria-label="События с исчерпанными попытками"><h3 ref={heading} tabIndex={-1}>События с исчерпанными попытками</h3>
    <p>Повтор возвращает одно событие outbox в очередь, сбрасывает счётчик попыток и сохраняет его содержимое. Причина и действие записываются в журнал.</p>
    {!canReplay ? <p>Повтор недоступен: требуется право на повтор и актуальное техническое состояние.</p> : null}
    {notice ? <DmFeedback presentation="inline" tone="success" title="Событие поставлено в очередь" description={notice} /> : null}
    {pending && !open ? <DmFeedback presentation="inline" tone="warning" title="Есть незавершённый запрос" description={`Событие ${pending.event.id}. Проверьте результат перед другим повтором.`} action={<DmButton onClick={() => setOpen(true)}>Вернуться к запросу</DmButton>} /> : null}
    {error && !open ? <DmFeedback presentation="inline" tone="danger" title="Действие требует внимания" description={error} /> : null}
    <DmSurface variant="filters"><form className={styles.filters} onSubmit={event => { event.preventDefault(); const valid = outboxDeadLetterQuerySchema.safeParse({ eventType: eventType.trim() || undefined, eventId: eventId.trim() || undefined }).success; setInvalid(!valid); if (valid) { try { write({ ...state, outboxEventType: eventType.trim(), outboxEventId: eventId.trim(), outboxOffset: 0 }); } catch { setInvalid(true); } } }}>
      <DmField label="Тип события"><DmInput value={eventType} maxLength={120} onChange={(_, data) => setEventType(data.value)} /></DmField><DmField label="ID события" validationState={invalid ? "error" : "none"} validationMessage={invalid ? "Укажите UUID события и тип до 120 символов, без # и обратной косой черты. При длинном адресе сократите фильтры." : undefined}><DmInput value={eventId} onChange={(_, data) => setEventId(data.value)} /></DmField>
      <div className={styles.actions}><DmButton type="submit">Найти события</DmButton><DmButton onClick={() => write({ ...state, outboxEventType: "", outboxEventId: "", outboxOffset: 0 })}>Сбросить поиск событий</DmButton></div>
    </form></DmSurface>
    <DeadLetterRows key={`${outboxEventType}|${outboxEventId}|${outboxOffset}|${revision}`} read={read} canReplay={canReplay && !pending && !busy} handled={handled} select={(event, button) => { trigger.current = button; setSelected(event); setReason(""); setError(""); setConflict(false); setFresh(undefined); setOpen(true); }} />
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => { if (trigger.current?.isConnected && !trigger.current.disabled) trigger.current.focus(); else heading.current?.focus(); }} title="Повтор выбранного события" actions={<><DmButton onClick={() => setOpen(false)}>Закрыть</DmButton>{conflict ? <DmButton ref={retryButton} disabled={busy} onClick={() => void refreshConflict()}>Проверить событие</DmButton> : <DmButton ref={retryButton} appearance="primary" disabled={busy || !canReplay || (!pending && reason.trim().length < 10)} onClick={() => void replay()}>{pending ? "Повторить тот же запрос" : "Подтвердить повтор"}</DmButton>}</>}>
      <div className={styles.section}><p>{selected?.eventType} · {selected?.id}</p><p>Попыток: {selected?.attempts}. Последнее состояние: {selected ? auditTime(selected.availableAt) : ""}.</p><p>Событие будет повторно передано обработчику. Убедитесь, что причина сбоя устранена.</p>
        <DmField label="Причина повтора" hint="От 10 до 500 символов"><DmTextarea value={reason} maxLength={500} disabled={busy || Boolean(pending)} onChange={(_, data) => setReason(data.value)} /></DmField>
        {error ? <DmFeedback presentation="inline" tone="danger" title="Повтор не подтверждён" description={error} /> : null}
        {conflict && fresh !== undefined ? <><p>{fresh ? `Событие снова в списке ошибок. Попыток: ${fresh.attempts}; состояние от ${auditTime(fresh.availableAt)}. Подтвердите использование этого состояния.` : "Событие больше не находится в списке исчерпавших попытки. Это не доказывает успешную обработку; проверьте журнал."}</p><DmButton disabled={busy} onClick={acceptFresh}>{fresh ? "Принять актуальное состояние" : "Завершить проверку"}</DmButton></> : null}
      </div>
    </DmDialog>
  </section>;
}

function DeadLetterRows({ read, canReplay, handled, select }: { read: (api: MarketplaceApiClient, signal: AbortSignal) => ReturnType<MarketplaceApiClient["listOutboxDeadLetters"]>; canReplay: boolean; handled: string[]; select: (event: OutboxDeadLetterItem, button: HTMLButtonElement) => void }) {
  const { state, write } = useAdminQuery();
  const { data, loading, error, refresh } = useOperatorProjection(read);
  return <div className={styles.section} aria-busy={loading}><div className={styles.header}><p role="status">{data ? `Найдено событий с ошибкой: ${data.total}${loading || error ? " · Последняя загрузка" : ""}` : ""}</p><DmButton disabled={loading} onClick={() => void refresh()}>Обновить список событий</DmButton></div>
    {loading && !data ? <LoadingState label="Загружаем события с ошибкой" /> : null}
    {error ? <ErrorState presentation="inline" title="Список событий не обновлён" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку событий</DmButton>} /> : null}
    {data?.items.length === 0 ? <EmptyState title="Событий с ошибкой не найдено" description="Проверьте фильтры или вернитесь к первой странице." /> : null}
    {data?.items.map(event => <DmSurface key={event.id} variant="card" className={styles.section}><h4>{event.eventType}</h4><p>ID события: {event.id}</p><p>Объект: {event.aggregateType} · {event.aggregateId}</p><p>Попытки: {event.attempts} / {event.maxAttempts} · Состояние от {auditTime(event.availableAt)}</p><p>{event.lastError ?? "Подробности ошибки недоступны."}</p><div className={styles.actions}><DmButton disabled={!canReplay || loading || Boolean(error) || handled.includes(signature(event))} onClick={button => select(event, button.currentTarget)}>Повторить событие</DmButton><DmButton onClick={() => write({ ...state, controlView: "audit", auditEntityType: "OutboxEvent", auditEntityId: event.id, auditOrganization: "", auditActor: "", auditAction: "", auditFrom: "", auditTo: "", auditOffset: 0 })}>Журнал события</DmButton></div></DmSurface>)}
    {data ? <nav className={styles.actions} aria-label="Страницы событий с ошибкой"><DmButton disabled={loading || state.outboxOffset === 0} onClick={() => write({ ...state, outboxOffset: Math.max(0, state.outboxOffset - 25) })}>Назад</DmButton><span>Страница {state.outboxOffset / 25 + 1}</span><DmButton disabled={loading || state.outboxOffset + 25 >= data.total || state.outboxOffset >= 1000000} onClick={() => write({ ...state, outboxOffset: state.outboxOffset + 25 })}>Далее</DmButton>{state.outboxOffset ? <DmButton onClick={() => write({ ...state, outboxOffset: 0 })}>В начало событий</DmButton> : null}</nav> : null}
  </div>;
}
