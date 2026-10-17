"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import type { OperatorDocumentException, OperatorExceptionReview } from "@marketplace/schemas";
import { errorMessage } from "@marketplace/ui/format";
import { adminApiContext } from "./admin-auth";

export function useOperatorException(id: string) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const [data, setData] = useState<OperatorDocumentException | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false), [reviewReady, setReviewReady] = useState(false), [applied, setApplied] = useState(false);
  const active = useRef(false), lock = useRef(false), read = useRef<AbortController | null>(null), pending = useRef<OperatorExceptionReview | null>(null);
  const refresh = useCallback(async () => {
    read.current?.abort(); const controller = new AbortController(); read.current = controller;
    setLoading(true);
    try {
      const next = await api.operatorDocumentException(id, controller.signal);
      if (!active.current || controller.signal.aborted) return false;
      setData(next); setError(""); setReviewReady(true); setApplied(false); return true;
    } catch (cause) {
      if (!active.current || controller.signal.aborted) return false;
      if (cause instanceof MarketplaceApiError && [401, 403, 404].includes(cause.status)) setData(null);
      setError("Не удалось загрузить расхождение. Проверьте доступ и соединение, затем повторите загрузку. Ввод сохранён."); return false;
    } finally { if (active.current && !controller.signal.aborted) setLoading(false); }
  }, [api, id]);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; read.current?.abort(); }; }, [refresh]);
  const publish = async (input?: OperatorExceptionReview) => {
    if (lock.current || conflict || !pending.current && !input) return false;
    pending.current ??= input!; lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await api.publishOperatorExceptionRecommendation(id, pending.current);
      if (!active.current) return false;
      pending.current = null; setUncertain(false); setApplied(true);
      setNotice("Рекомендация опубликована для клиники и поставщика. Обработка этой редакции завершена.");
      await refresh(); return true;
    } catch (cause) {
      if (!active.current) return false;
      const status = cause instanceof MarketplaceApiError ? cause.status : null;
      const definitive = status !== null && status >= 400 && status < 500 && status !== 408;
      if (definitive) pending.current = null;
      if (status === 401 || status === 403 || status === 404) setData(null);
      setUncertain(!definitive); setError(errorMessage(cause));
      if (status === 409) { setConflict(true); setReviewReady(false); }
      return false;
    } finally { lock.current = false; if (active.current) setBusy(false); }
  };
  return { data, error, loading, busy, notice, uncertain, conflict, reviewReady, applied, refresh, publish,
    reviewed: () => { if (reviewReady) { setConflict(false); setError(""); } } };
}
