"use client";
import { useMemo } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { ConversationCounter } from "@marketplace/ui";
import { sessionApiContext } from "../../workspace-session";
export default function HeaderMessages() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", sessionApiContext), []);
  return <ConversationCounter api={api} href="/clinic/messages" />;
}
