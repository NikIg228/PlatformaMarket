"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@marketplace/ui";
import type { SearchResult } from "../../catalog-search-types";
import { appendCatalogPage, fetchLiveCatalog, loadCatalogWindow } from "../../catalog/live-search";
import { marketplaceCatalogUrl, readMarketplaceCatalog } from "../../catalog/marketplace-url";
import { publicCatalogQuery } from "../../catalog/public-catalog-query";
import { useDeliveryContext } from "../marketplace-header/delivery-context";

export function usePublicCatalog() {
  const delivery = useDeliveryContext();
  const [location, setLocation] = useState(() => ({ state: readMarketplaceCatalog(new URLSearchParams()), path: "/", ready: false }));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flight = useRef<AbortController | null>(null);
  const count = useRef(24);
  useEffect(() => {
    const restore = () => {
      const state = readMarketplaceCatalog(new URLSearchParams(window.location.search));
      count.current = state.count;
      setResult(null); setLoading(true);
      setLocation({ state, path: window.location.pathname, ready: true });
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const state = useMemo(() => ({ ...location.state,
    ...(delivery.ready ? { deliveryCityId: delivery.city?.id, inCity: delivery.inCity } : {}),
  }), [location.state, delivery.ready, delivery.city?.id, delivery.inCity]);
  const query = publicCatalogQuery(state, delivery.inCity ? delivery.city?.id : undefined).toString();
  const reload = useCallback(async () => {
    flight.current?.abort();
    const controller = new AbortController();
    flight.current = controller;
    setLoading(true); setLoadingMore(false); setError(null);
    try {
      const next = await loadCatalogWindow<SearchResult>((offset, limit) => {
        const params = new URLSearchParams(query);
        params.set("offset", String(offset)); params.set("limit", String(limit));
        return fetchLiveCatalog<SearchResult>(params, controller.signal);
      }, count.current);
      if (!controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (!controller.signal.aborted) { setResult(null); setError(errorMessage(cause)); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [query]);
  useEffect(() => {
    if (location.ready && delivery.ready) void reload();
    return () => { flight.current?.abort(); };
  }, [reload, location, delivery.ready]);

  const returnUrl = marketplaceCatalogUrl({ ...state, count: result?.nextOffset ?? result?.items.length ?? state.count }, location.path);
  useEffect(() => {
    if (location.ready && delivery.ready && !loading) window.history.replaceState(window.history.state, "", returnUrl);
  }, [returnUrl, location.ready, delivery.ready, loading]);

  const more = async () => {
    if (loading || loadingMore) return;
    flight.current?.abort();
    const controller = new AbortController(); flight.current = controller;
    const offset = result?.nextOffset ?? result?.items.length ?? 0;
    setLoadingMore(true); setError(null);
    try {
      const params = new URLSearchParams(query); params.set("offset", String(offset));
      const next = await fetchLiveCatalog<SearchResult>(params, controller.signal);
      if (controller.signal.aborted) return;
      setResult(previous => {
        if (controller.signal.aborted || (previous?.nextOffset ?? previous?.items.length ?? 0) !== offset) return previous;
        const merged = appendCatalogPage(previous, next); count.current = merged.nextOffset; return merged;
      });
      setError(null);
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally { if (!controller.signal.aborted) setLoadingMore(false); }
  };
  const loadFilterOptions = async (categoryId: string, signal: AbortSignal) => {
    const params = new URLSearchParams(query);
    if (categoryId) params.set("categoryId", categoryId); else params.delete("categoryId");
    params.delete("categoryName"); params.delete("attributeFilters");
    params.set("offset", "0"); params.set("limit", "1");
    return (await fetchLiveCatalog<SearchResult>(params, signal)).filterOptions;
  };
  return { result, state, returnUrl, loading, loadingMore, error, reload, more, loadFilterOptions };
}
