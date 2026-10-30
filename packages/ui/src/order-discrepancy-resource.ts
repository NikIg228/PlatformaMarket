"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderDiscrepanciesResponse, OrderDiscrepancyCommand, OrderDiscrepancyResult } from "@marketplace/schemas";
import { errorMessage } from "./format";
import type { ResupplyDocumentApi } from "./resupply-document-panel";
export type OrderDiscrepancyApi = Partial<ResupplyDocumentApi> & {
  getOrderDiscrepancies(id: string): Promise<OrderDiscrepanciesResponse>;
  executeOrderDiscrepancy(id: string, input: OrderDiscrepancyCommand): Promise<OrderDiscrepancyResult>;
  uploadDiscrepancyAttachment(id: string, input: { fileName: string; contentBase64: string }): Promise<{ id: string; name: string; mimeType: string; sizeBytes: number }>;
  downloadDiscrepancyAttachment(id: string, discrepancyId: string, assetId: string): Promise<{ fileName: string; mimeType: string; contentBase64: string }>;
};
export function useOrderDiscrepancies(api: OrderDiscrepancyApi, orderId: string, orderVersion: number) {
  const [data, setData] = useState<OrderDiscrepanciesResponse | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false), [reviewReady, setReviewReady] = useState(false);
  const sequence = useRef(0), alive = useRef(true), working = useRef(false), pending = useRef<OrderDiscrepancyCommand | null>(null);
  const reload = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true);
    try { const next = await api.getOrderDiscrepancies(orderId); if (alive.current && seq === sequence.current) { setData(next); setError(""); setReviewReady(true); } return next; }
    catch (cause) { if (alive.current && seq === sequence.current) setError(errorMessage(cause)); return null; }
    finally { if (alive.current && seq === sequence.current) setLoading(false); }
  }, [api, orderId]);
  useEffect(() => { alive.current = true; void reload(); return () => { alive.current = false; ++sequence.current; }; }, [reload, orderVersion]);
  const run = async (command: OrderDiscrepancyCommand) => {
    if (working.current || conflict) return null;
    working.current = true; setBusy(true); setError(""); setNotice(""); pending.current ??= command;
    try {
      const result = await api.executeOrderDiscrepancy(orderId, pending.current);
      if (!alive.current) return null;
      pending.current = null; setUncertain(false); setNotice("Изменения сохранены"); await reload(); return result;
    } catch (cause) {
      if (!alive.current) return null;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : null;
      const definitive = typeof status === "number" && status >= 400 && status < 500 && status !== 408;
      if (definitive) pending.current = null;
      setUncertain(!definitive); setError(errorMessage(cause));
      if (status === 409) { setConflict(true); setReviewReady(false); }
      return null;
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  return { data, error, setError, loading, busy, notice, uncertain, conflict, reviewReady, reload, run,
    retry: () => pending.current ? run(pending.current) : Promise.resolve(null),
    reviewed: () => { if (reviewReady) { setConflict(false); setError(""); } } };
}
