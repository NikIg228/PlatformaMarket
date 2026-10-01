"use client";
import { useMemo } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { PromotionWorkspace } from "@marketplace/ui/promotions";
import { adminApiContext } from "./admin-auth";
export function PromotionModeration() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api", adminApiContext()), []);
  return <PromotionWorkspace api={api} operator />;
}
