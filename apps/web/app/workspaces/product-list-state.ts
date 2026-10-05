"use client";
import { useEffect, useState } from "react";

type State = { query: string; appliedQuery: string; attentionOnly: boolean; status: "" | "published" | "hidden"; cursors: Array<string | undefined> };
const empty: State = { query: "", appliedQuery: "", attentionOnly: false, status: "", cursors: [undefined] };
/** Per-tab, per-organization list context; no product/customer payload is persisted. */
export function useProductListState(organizationId: string) {
  const key = `supplier-product-list:${organizationId}`;
  const [state, setState] = useState<State>(empty), [restoredKey, setRestoredKey] = useState("");
  useEffect(() => {
    let next = empty;
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved && typeof saved === "object") {
        const data = saved as Record<string, unknown>;
        if (typeof data.query === "string" && typeof data.appliedQuery === "string" && typeof data.attentionOnly === "boolean" && ["", "published", "hidden"].includes(String(data.status)) && Array.isArray(data.cursors) && data.cursors.length > 0 && data.cursors.length < 100 && data.cursors.every(value => value === null || typeof value === "string"))
          next = { query: data.query.slice(0,160), appliedQuery: data.appliedQuery.slice(0,160), attentionOnly: data.attentionOnly, status: data.status as State["status"], cursors: data.cursors.map(value => value ?? undefined) };
      }
    } catch { /* Storage can be disabled; the list still works. */ }
    setState(next); setRestoredKey(key);
  }, [key]);
  useEffect(() => { if (restoredKey === key) { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional restoration only. */ } } }, [state, key, restoredKey]);
  const change = <K extends keyof State>(name: K, value: State[K]) => setState(current => ({ ...current, [name]: value }));
  return { ...state, change, navigation: {
    cursor: state.cursors.at(-1), page: state.cursors.length,
    next: (cursor: string) => setState(current => ({ ...current, cursors: [...current.cursors, cursor] })),
    previous: () => setState(current => ({ ...current, cursors: current.cursors.length > 1 ? current.cursors.slice(0,-1) : current.cursors })),
    reset: () => change("cursors", [undefined]),
  } };
}
