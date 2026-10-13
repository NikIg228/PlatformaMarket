import type { ApiContext } from "@marketplace/api-client";
import { unifiedFrontend } from "@marketplace/api-client";
import { MarketplaceApiClient, revokeWorkspaceSession, workspacePath } from "@marketplace/api-client";
import { currentOperatorSessionSchema, type OperatorSession } from "@marketplace/schemas";
import { adminLoginUrl } from "./admin-navigation";

const SESSION_KEY = "dentmarket_admin_session";
const DEV_ACTOR = process.env.NEXT_PUBLIC_DEV_USER_ID ?? "00000000-0000-4000-8000-000000000002";
const DEV_ORGANIZATION = process.env.NEXT_PUBLIC_DEV_ORGANIZATION_ID ?? "00000000-0000-4000-8000-000000000001";
type AdminSession = { accessToken: string; sessionId?: string; activeOrganizationId?: string; organizationId?: string; csrfToken?: string; expiresAt?: number; user?: { id?: string; displayName?: string } };
let restoring: Promise<AdminSession | null> | null = null;
let generation = 0;
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export const ADMIN_SESSION_ENDED = "dentmarket:admin-session-ended";

function sameIdentity(left: AdminSession | null, right: AdminSession | null) {
  return Boolean(left?.sessionId && right?.sessionId && left.sessionId === right.sessionId &&
    left.user?.id && left.user.id === right.user?.id &&
    (left.activeOrganizationId ?? left.organizationId) === (right.activeOrganizationId ?? right.organizationId));
}

function sessionChanged(expected: AdminSession) {
  if (clearAdminSession(expected)) {
    const url = new URL(adminLoginUrl(window.location), window.location.origin);
    url.searchParams.set("notice", "session-changed");
    window.location.replace(url.pathname + url.search);
  }
  return new Error("Аккаунт изменён в другой вкладке. Войдите снова, чтобы продолжить.");
}

export function saveAdminSession(session: OperatorSession) {
  generation += 1;
  const stored = { ...session, expiresAt: Date.now() + session.accessTokenExpiresIn * 1000 };
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  return stored;
}

export function restoreAdminSession() {
  if (!restoring) {
    const started = generation;
    const expected = readAdminSession();
    restoring = new MarketplaceApiClient(apiUrl, {}).currentOperatorSession().then(payload => {
      if (started !== generation) throw new Error("Состояние входа изменилось. Повторите проверку.");
      const session = currentOperatorSessionSchema.parse(payload);
      if (expected && session && !sameIdentity(expected, session)) throw sessionChanged(expected);
      if (session) return saveAdminSession(session);
      clearAdminSession(expected ?? undefined); return null;
    }).finally(() => { restoring = null; });
  }
  return restoring;
}

async function adminAccessToken(expected: AdminSession, force = false) {
  const session = readAdminSession();
  if (!sameIdentity(expected, session)) throw sessionChanged(expected);
  if (!force && session && (!session.expiresAt || session.expiresAt > Date.now() + 60_000)) return session.accessToken;
  const restored = await restoreAdminSession();
  if (!restored) { window.location.assign(adminLoginUrl(window.location)); throw new Error("Сессия завершена. Войдите снова."); }
  if (!sameIdentity(expected, restored)) throw sessionChanged(expected);
  return restored.accessToken;
}

export async function logoutAdmin() {
  const session = readAdminSession();
  if (!session) throw new Error("Не удалось определить сессию. Войдите снова.");
  await revokeWorkspaceSession(apiUrl, session, () => adminAccessToken(session, true));
  if (clearAdminSession(session)) window.location.assign(workspacePath("ADMIN", "/login"));
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
  return session?.accessToken ? {
    accessToken: session.accessToken,
    getAccessToken: force => adminAccessToken(session, force),
    onUnauthorized: () => { if (clearAdminSession(session)) window.location.assign(adminLoginUrl(window.location)); },
  } : isLocalAdminDevelopment() ? { actorId: DEV_ACTOR, organizationId: DEV_ORGANIZATION } : {};
}

export function adminAuthHeaders(contentType = true): Record<string, string> {
  const context = adminApiContext();
  const headers: Record<string, string> = contentType ? { "content-type": "application/json" } : {};
  if (context.accessToken) headers.authorization = `Bearer ${context.accessToken}`;
  else if (context.actorId && context.organizationId) { headers["x-user-id"] = context.actorId; headers["x-organization-id"] = context.organizationId; }
  return headers;
}

export function clearAdminSession(expected?: AdminSession) {
  if (expected && !sameIdentity(expected, readAdminSession())) return false;
  generation += 1;
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event(ADMIN_SESSION_ENDED));
  }
  return true;
}
