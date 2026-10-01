"use client";
import { useMemo } from "react";
import { MarketplaceApiClient, type ApiContext } from "@marketplace/api-client";
import { PromotionWorkspace } from "@marketplace/ui/promotions";
export function PromotionsPanel({ apiContext }: { supplierId: string; apiContext?: ApiContext }) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api", apiContext ?? {}), [apiContext]);
  return <PromotionWorkspace api={api} />;
}
