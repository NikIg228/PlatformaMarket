"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IdentitySession } from "@marketplace/schemas";
import { DmButton, DmFeedback, LoadingState, errorMessage } from "./index";

export function SessionManagement({ api, currentSessionId, onCurrentRevoked }: {
  api: { listSessions(): Promise<IdentitySession[]>; revokeSession(id: string): Promise<unknown> };
  currentSessionId?: string; onCurrentRevoked: () => void;
}) {
  const [sessions, setSessions] = useState<IdentitySession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try { const result = await api.listSessions(); if (generation.current === request) setSessions(result); }
    catch (cause) { if (generation.current === request) setError(errorMessage(cause)); }
  }, [api]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  async function revoke() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await api.revokeSession(selected);
      if (selected === currentSessionId) { onCurrentRevoked(); return; }
      setSelected(null); setNotice(true); await load();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mp-member-management mp-stack" aria-label="Сессии аккаунта"><h2>Сессии аккаунта</h2>
    <p>Завершите незнакомую сессию. После отзыва её запросы больше не получат доступ.</p>
    {error ? <DmFeedback tone="danger" title="Не удалось обновить сессии" description={error} alert action={<DmButton disabled={busy} onClick={() => { setError(null); void load(); }}>Повторить</DmButton>} /> : null}
    {notice ? <DmFeedback tone="success" title="Сессия завершена" description="Для продолжения работы на том устройстве потребуется повторный вход." /> : null}
    {!sessions && !error ? <LoadingState label="Загружаем сессии" /> : null}
    {sessions?.length === 0 ? <p>Активных сессий нет. Войдите заново.</p> : null}
    {selected ? <div className="mp-member-confirm"><p>Завершить выбранную сессию? На этом устройстве потребуется повторный вход.</p><div className="mp-member-actions"><DmButton disabled={busy} onClick={() => void revoke()}>Подтвердить завершение</DmButton><DmButton disabled={busy} onClick={() => setSelected(null)}>Отмена</DmButton></div></div> : null}
    {sessions?.map(session => <article className="mp-member-card" key={session.id}><div><strong>{session.id === currentSessionId ? "Текущая сессия" : "Другая сессия"}</strong><p>{session.userAgent || "Устройство не определено"}</p><p>Последняя активность: {new Date(session.lastUsedAt ?? session.createdAt).toLocaleString("ru-KZ")}</p></div><DmButton disabled={busy} onClick={() => setSelected(session.id)}>Завершить сессию</DmButton></article>)}
  </section>;
}
