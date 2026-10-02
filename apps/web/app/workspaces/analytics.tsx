"use client";
import { useCallback } from "react";
import { CommerceAnalytics } from "@marketplace/ui/commerce-analytics";
import type { CommerceAnalyticsQuery } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
export default function Analytics() {
  const { api, role } = useWorkspace();
  const load = useCallback((query: CommerceAnalyticsQuery, signal: AbortSignal) => api.commerceAnalytics(query, { signal }), [api]);
  return <CommerceAnalytics load={load} orderHref={id => `/${role}/orders/${id}`} />;
}
