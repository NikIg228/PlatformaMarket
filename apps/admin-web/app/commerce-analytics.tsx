"use client";
import { useCallback, useMemo } from "react";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { CommerceAnalytics } from "@marketplace/ui/commerce-analytics";
import type { CommerceAnalyticsQuery } from "@marketplace/schemas";
import { adminApiContext } from "./admin-auth";
export function OperatorCommerceAnalytics() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const load = useCallback((query: CommerceAnalyticsQuery, signal: AbortSignal) => api.commerceAnalytics(query, { signal }), [api]);
  return <CommerceAnalytics operator load={load} orderHref={id => `${workspacePath("ADMIN", "/")}?section=orders&queueType=SUPPLIER_CONFIRMATION&object=${encodeURIComponent(id)}`} />;
}
