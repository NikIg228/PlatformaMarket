"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceInventoryPage } from "@marketplace/schemas";
import { errorMessage } from "@marketplace/ui";

export function useInventoryList(load: (cursor: string | undefined, signal: AbortSignal) => Promise<WorkspaceInventoryPage>) {
  const [page, setPage] = useState<WorkspaceInventoryPage | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const flight = useRef<AbortController | null>(null), generation = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const fetchPage = useCallback(async (cursor?: string) => {
    if (flight.current) return;
    const ticket = generation.current, controller = new AbortController();
    flight.current = controller; setLoading(true); setError("");
    try {
      const result = await load(cursor, controller.signal);
      if (ticket !== generation.current || controller.signal.aborted) return;
      setPage(previous => ({ ...result, items: cursor ? [...new Map([...(previous?.items ?? []), ...result.items].map(item => [item.id, item])).values()] : result.items }));
    } catch (cause) { if (ticket === generation.current && !controller.signal.aborted) setError(errorMessage(cause)); }
    finally { if (ticket === generation.current) { flight.current = null; setLoading(false); } }
  }, [load]);
  useEffect(() => {
    generation.current++; flight.current?.abort(); flight.current = null;
    setPage(null); void fetchPage();
    return () => { generation.current++; flight.current?.abort(); flight.current = null; };
  }, [fetchPage]);
  useEffect(() => {
    if (!page?.nextCursor || loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void fetchPage(page.nextCursor!); }, { rootMargin: "300px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [page?.nextCursor, loading, error, fetchPage]);
  return { page, loading, error, sentinel, retry: () => fetchPage(page?.nextCursor ?? undefined) };
}
