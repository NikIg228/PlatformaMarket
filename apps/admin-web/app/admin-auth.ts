import type { ApiContext } from "@marketplace/api-client";
import { unifiedFrontend } from "@marketplace/api-client";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { currentOperatorSessionSchema, type OperatorSession } from "@marketplace/schemas";

const SESSION_KEY = "dentmarket_admin_session";
const DEV_ACTOR = process.env.NEXT_PUBLIC_DEV_USER_ID ?? "00000000-0000-4000-8000-000000000002";
const DEV_ORGANIZATION = process.env.NEXT_PUBLIC_DEV_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";
type AdminSession = { accessToken: string; sessionId?: string; activeOrganizationId?: string; organizationId?: string; csrfToken?: string; expiresAt?: number; user?: { id?: string; displayName?: string } };
let restoring: Promise<AdminSession | null> | null = null;
let generation = 0;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function saveAdminSession(session: OperatorSession) {
  const stored = { ...session, expiresAt: Date.now() + session.accessTokenExpiresIn * 1000 };
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  return stored;
}

export function restoreAdminSession() {
  if (!restoring) {
    const started = generation;
    restoring = new MarketplaceApiClient(apiUrl, {}).currentOperatorSession().then(payload => {
      if (started !== generation) return null;
      const session = currentOperatorSessionSchema.parse(payload);
      if (session) return saveAdminSession(session);
      clearAdminSession(); return null;
    }).finally(() => { restoring = null; });
  }
  return restoring;
}

async function adminAccessToken(force = false) {
  const session = readAdminSession();
  if (!force && session && (!session.expiresAt || session.expiresAt > Date.now() + 60_000)) return session.accessToken;
  const restored = await restoreAdminSession();
  if (!restored) { window.location.assign(workspacePath("ADMIN", "/login")); throw new Error("Сессия завершена. Войдите снова."); }
  return restored.accessToken;
}

export async function logoutAdmin() {
  const session = readAdminSession();
  await new MarketplaceApiClient(apiUrl, {}).logoutOperator(session?.csrfToken ?? "");
  clearAdminSession();
  window.location.assign(workspacePath("ADMIN", "/login"));
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const handoff = window.location.hash.startsWith("#session=") ? decodeURIComponent(window.location.hash.slice(9)) : null;
  if (handoff) {
    try { window.sessionStorage.setItem(SESSION_KEY, handoff); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
    catch { return null; }
  }
  try { const parsed = JSON.parse(handoff ?? window.sessionStorage.getItem(SESSION_KEY) ?? "null") as AdminSession | null; return parsed?.accessToken ? parsed : null; }
  catch { return null; }
}

export function isLocalAdminDevelopment() {
  if (unifiedFrontend) return false;
  return typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function adminApiContext(): ApiContext {
  const session = readAdminSession();
  return session?.accessToken ? { accessToken: session.accessToken, getAccessToken: adminAccessToken, onUnauthorized: () => { clearAdminSession(); window.location.assign(workspacePath("ADMIN", "/login")); } } : isLocalAdminDevelopment() ? { actorId: DEV_ACTOR, organizationId: DEV_ORGANIZATION } : {};
}

export function adminAuthHeaders(contentType = true): Record<string, string> {
  const context = adminApiContext();
  const headers: Record<string, string> = contentType ? { "content-type": "application/json" } : {};
  if (context.accessToken) headers.authorization = `Bearer ${context.accessToken}`;
  else if (context.actorId && context.organizationId) { headers["x-user-id"] = context.actorId; headers["x-organization-id"] = context.organizationId; }
  return headers;
}

export function clearAdminSession() {
  generation += 1;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(SESSION_KEY);
}
