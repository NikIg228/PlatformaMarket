"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationInbox, NotificationInboxQuery, NotificationInboxItem } from "@marketplace/schemas";
import { errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";

const changedEvent = "marketplace-notifications-read";
export function useNotificationInbox({ unreadOnly = false, category, limit = 20, holdChanges = true }: {
  unreadOnly?: boolean; category?: NotificationInboxItem["category"]; limit?: number; holdChanges?: boolean;
} = {}) {
  const { api, organizationId } = useWorkspace();
  const [data, setData] = useState<NotificationInbox | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newEvents, setNewEvents] = useState(false);
  const current = useRef(data); current.current = data;
  const hold = useRef(holdChanges); hold.current = holdChanges;
  const generation = useRef(0);
  const request = useRef(false);
  const readSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const sender = useRef(Symbol("notification-inbox"));
  const writeLock = useRef(false);
  const alive = useRef(true);
  const load = useCallback(async (mode: "refresh" | "poll" | "more" = "refresh") => {
    if (request.current && mode !== "refresh") return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const sequence = ++readSequence.current;
    request.current = true;
    const epoch = generation.current;
    if (mode !== "poll") setLoading(true);
    try {
      const query: NotificationInboxQuery = { limit, unreadOnly: unreadOnly ? "true" : "false", category, cursor: mode === "more" ? current.current?.nextCursor ?? undefined : undefined };
      const page = await api.notificationInbox(organizationId, query, { signal: abort.signal });
      if (epoch !== generation.current || sequence !== readSequence.current) return;
      setError("");
      const previous = current.current;
      if (mode === "poll" && hold.current && previous && page.items.some(item => !previous.items.some(old => old.id === item.id))) {
        setNewEvents(true);
        setData({ ...previous, unreadCount: page.unreadCount });
      } else if (mode === "more" && previous) {
        setData({ ...page, asOf: previous.asOf, items: [...new Map([...previous.items, ...page.items].map(item => [item.id, item])).values()] });
      } else if (mode === "poll" && hold.current && previous) {
        setData({ ...previous, unreadCount: page.unreadCount, items: previous.items.map(item => page.items.find(next => next.id === item.id) ?? item) });
      } else { setData(page); setNewEvents(false); }
    } catch (cause) { if (epoch === generation.current && sequence === readSequence.current && !abort.signal.aborted) setError(errorMessage(cause)); }
    finally { if (epoch === generation.current && sequence === readSequence.current) { request.current = false; setLoading(false); } }
  }, [api, organizationId, unreadOnly, category, limit]);
  useEffect(() => {
    alive.current = true; generation.current++; request.current = false; setData(null); setNewEvents(false); void load();
    const poll = () => { if (!document.hidden) void load("poll"); };
    const sync = (event: Event) => { if ((event as CustomEvent).detail !== sender.current) void load(); };
    const timer = window.setInterval(poll, 30_000);
    window.addEventListener("focus", poll); window.addEventListener("online", poll); window.addEventListener(changedEvent, sync);
    return () => { alive.current = false; generation.current++; controller.current?.abort(); request.current = false; clearInterval(timer); window.removeEventListener("focus", poll); window.removeEventListener("online", poll); window.removeEventListener(changedEvent, sync); };
  }, [load]);
  const markRead = async (item?: NotificationInboxItem) => {
    if (writeLock.current || !current.current || item?.readAt) return;
    writeLock.current = true; setBusy(true); setError("");
    const epoch = generation.current;
    try {
      if (item) await api.readNotification(item.id);
      else await api.readNotificationInbox(organizationId, current.current.asOf);
      if (epoch === generation.current) await load();
      window.dispatchEvent(new CustomEvent(changedEvent, { detail: sender.current }));
    } catch (cause) { if (epoch === generation.current) setError(errorMessage(cause)); }
    finally { writeLock.current = false; if (alive.current) setBusy(false); }
  };
  return { data, error, loading, busy, newEvents, refresh: () => load(), more: () => load("more"), markRead };
}
