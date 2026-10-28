"use client";
import { workspaceSessionStore, type ApiContext } from "@marketplace/api-client";
import { useWorkspaceSession } from "@marketplace/ui";
import { requireOrganizationMode, useBuyerMode } from "./buyer-context";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
export const sessionStore = workspaceSessionStore(apiUrl, "BUYER");
export const sessionApiContext: ApiContext = { getAccessToken: async (...args) => { requireOrganizationMode(); return sessionStore.getAccessToken(...args); }, onUnauthorized: sessionStore.invalidate };
export const useVerifiedSession = () => {
  const value = useWorkspaceSession(sessionStore);
  const mode = useBuyerMode();
  return { ...value, ready: value.ready && mode !== "loading" && mode !== "switching", session: mode === "organization" ? value.session : null };
};
export const logoutSession = sessionStore.logout;
