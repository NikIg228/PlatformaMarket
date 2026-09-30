"use client";
import { useCallback, useEffect, useRef, useState } from "react";
/** Each page owns its request; late responses from a previous page cannot replace it. */
export function useResource<T>(load: () => Promise<T>, { intervalMs = 0, automatic = true, retainDataOnChange = false } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const sequence = useRef(0);
  const flight = useRef<{ load: typeof load; promise: Promise<void> } | null>(null);
  const refresh = useCallback((): Promise<void> => {
    if (flight.current?.load === load) return flight.current.promise;
    if (!navigator.onLine) {
      setOffline(true);
      setLoading(false);
      setError("Нет подключения к сети. Данные могут быть устаревшими.");
      return Promise.resolve();
    }
    const request = ++sequence.current;
    setOffline(false);
    setLoading(true);
    setError(null);
    const promise = (async () => {
    try {
      const result = await load();
      if (request === sequence.current) {
        setData(result);
        setLastSuccessAt(Date.now());
      }
    } catch (cause) {
      if (request === sequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось загрузить данные. Повторите попытку.",
        );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
    })();
    const current = { load, promise };
    flight.current = current;
    void promise.finally(() => { if (flight.current === current) flight.current = null; });
    return promise;
  }, [load]);
  const refreshAfterWrite = useCallback(async () => {
    const request = sequence.current;
    const pending = flight.current;
    if (pending?.load === load) await pending.promise;
    if (request !== sequence.current) return;
    await refresh();
  }, [load, refresh]);
  useEffect(() => {
    if (!retainDataOnChange) { setData(null); setLastSuccessAt(null); }
    setOffline(!navigator.onLine);
    void refresh();
    return () => {
      sequence.current++;
      flight.current = null;
    };
  }, [refresh, retainDataOnChange]);
  useEffect(() => {
    const reload = () => {
      setOffline(!navigator.onLine);
      if (automatic && document.visibilityState === "visible") void refresh();
    };
    const disconnect = () => setOffline(true);
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    window.addEventListener("offline", disconnect);
    document.addEventListener("visibilitychange", reload);
    const timer = automatic && intervalMs ? window.setInterval(reload, intervalMs) : undefined;
    return () => {
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", disconnect);
      document.removeEventListener("visibilitychange", reload);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [refresh, automatic, intervalMs]);
  return { data, setData, loading, initialLoading: loading && data === null,
    refreshing: loading && data !== null, error, lastSuccessAt,
    offline, stale: offline || error !== null, refresh, refreshAfterWrite };
}
