"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createPersonalSession, MarketplaceApiClient } from "@marketplace/api-client";
import { buyerMode, setBuyerMode, useBuyerMode } from "./buyer-context";
import { useVerifiedSession } from "./workspace-session";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export const personalSessionStore = createPersonalSession(apiUrl);
export function usePersonalSession() {
  const snapshot = useSyncExternalStore(personalSessionStore.subscribe, personalSessionStore.getSnapshot, personalSessionStore.getServerSnapshot);
  useEffect(() => {
    void personalSessionStore.start();
    const check = () => { if (document.visibilityState === "visible") void personalSessionStore.check(); };
    window.addEventListener("pageshow", check); window.addEventListener("focus", check);
    return () => { window.removeEventListener("pageshow", check); window.removeEventListener("focus", check); };
  }, []);
  return snapshot;
}

export function personalApiFor(sessionId: string) {
  return new MarketplaceApiClient(apiUrl, {
    getAccessToken: async () => {
      if (buyerMode() !== "personal") throw new Error("Контекст покупателя изменился. Проверьте выбранную корзину.");
      const token = await personalSessionStore.getAccessToken(sessionId);
      if (buyerMode() !== "personal") throw new Error("Контекст покупателя изменился. Проверьте выбранную корзину.");
      return token;
    },
    onUnauthorized: () => personalSessionStore.invalidate(sessionId),
  });
}

export function usePurchaseContext() {
  const organization = useVerifiedSession();
  const personal = usePersonalSession();
  const mode = useBuyerMode();
  useEffect(() => {
    // An account without a buyer workspace has only its own personal context.
    if (mode === "organization" && organization.ready && !organization.session && !organization.error && personal.session) setBuyerMode("personal");
  }, [mode, organization.ready, organization.session, organization.error, personal.session?.sessionId]);
  const isPersonal = mode === "personal";
  return { organization, personal, isPersonal,
    ready: organization.ready && personal.ready && mode !== "loading" && mode !== "switching",
    identityKey: isPersonal ? `personal:${personal.session?.sessionId ?? "guest"}` : `organization:${organization.session?.sessionId ?? "guest"}:${organization.session?.organizationId ?? ""}`,
  };
}
