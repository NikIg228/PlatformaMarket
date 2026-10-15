"use client";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApiContext } from "./admin-auth";

export function useOperatorProjection<T>(read: (api: MarketplaceApiClient, signal: AbortSignal) => Promise<T>, clearOnNotFound = false) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(""); setErrorStatus(null);
    try {
      const result = await read(api, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const denied = cause instanceof MarketplaceApiError && [401, 403].includes(cause.status);
      setErrorStatus(cause instanceof MarketplaceApiError ? cause.status : null);
      if (denied || (clearOnNotFound && cause instanceof MarketplaceApiError && cause.status === 404)) setData(null);
      setError(denied ? "Нет доступа к данным. Проверьте вход и права оператора." : "Не удалось обновить данные. Проверьте соединение и повторите загрузку.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [api, read, clearOnNotFound]);
  useEffect(() => { void refresh(); return () => pending.current?.abort(); }, [refresh]);
  return { data, loading, error, errorStatus, refresh };
}
