"use client";
import { useCallback, useEffect, useState } from "react";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { errorMessage } from "@marketplace/ui";
import { adminApiContext, clearAdminSession, isLocalAdminDevelopment, readAdminSession, restoreAdminSession } from "./admin-auth";
import { hasOperatorOrganizationAccess } from "./login/admin-login-view-model";

export function useAdminAccess() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!ready) return;
    const renew = () => {
      const session = readAdminSession();
      if (document.visibilityState !== "visible" || !session?.expiresAt || session.expiresAt > Date.now() + 120_000) return;
      void restoreAdminSession().then(current => {
        if (!current) { setReady(false); window.location.replace(workspacePath("ADMIN", "/login")); }
      }).catch(() => { /* A failed refresh leaves the valid token and permits the next retry. */ });
    };
    const timer = window.setInterval(renew, 60_000);
    window.addEventListener("focus", renew); document.addEventListener("visibilitychange", renew);
    return () => { clearInterval(timer); window.removeEventListener("focus", renew); document.removeEventListener("visibilitychange", renew); };
  }, [ready]);
  useEffect(() => {
    let active = true; setError("");
    const verify = async () => {
      if (isLocalAdminDevelopment()) { if (active) setReady(true); return; }
      const session = readAdminSession() ?? await restoreAdminSession();
      if (!active) return;
      if (!session) { window.location.replace(workspacePath("ADMIN", "/login")); return; }
      const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext());
      const organizations = await api.get<unknown>("/organizations");
      if (!active) return;
      if (!hasOperatorOrganizationAccess(organizations, session.activeOrganizationId ?? session.organizationId ?? "")) {
        clearAdminSession(); throw new Error("Для входа нужна учётная запись оператора.");
      }
      setReady(true);
    };
    void verify().catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [attempt]);
  return { ready, error, retry };
}
