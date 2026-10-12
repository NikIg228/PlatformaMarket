"use client";
import { useEffect, useMemo, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { PromotionListQuery, PublicPromotionPage } from "@marketplace/schemas";
import { errorMessage } from "@marketplace/ui";
import { activePromotions } from "./promotion-display";

export function usePromotionPage(query: Partial<PromotionListQuery>, enabled = true) {
  const key = JSON.stringify(query);
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {}), []);
  const [state, setState] = useState<{ key: string; page: PublicPromotionPage | null; error: string | null }>({ key: "", page: null, error: null });
  const [revision, retry] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ key, page: null, error: null });
    api.listPublicPromotions(JSON.parse(key) as Partial<PromotionListQuery>)
      .then(page => { if (active) { setState({ key, page, error: null }); setNow(Date.now()); } })
      .catch(cause => { if (active) setState({ key, page: null, error: errorMessage(cause) }); });
    return () => { active = false; };
  }, [api, key, enabled, revision]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [enabled]);
  const page = enabled && state.key === key ? state.page : null;
  const error = enabled && state.key === key ? state.error : null;
  return { page, error, items: activePromotions(page?.items ?? [], now), loading: enabled && !page && !error, retry: () => retry(n => n + 1) };
}
