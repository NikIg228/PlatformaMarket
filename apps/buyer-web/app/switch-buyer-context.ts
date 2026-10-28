"use client";
import { workspaceContextSchema } from "@marketplace/schemas/workspace-session";
import { sessionStore } from "./workspace-session";
import { setBuyerMode } from "./buyer-context";

let changing = false;
export async function switchBuyerOrganization(organizationId: string) {
  if (changing) throw new Error("Смена организации уже выполняется.");
  changing = true;
  try {
    await switchOrganization(organizationId);
  } finally { changing = false; }
}
async function switchOrganization(organizationId: string) {
  const captured = sessionStore.getSnapshot().session;
  if (!captured?.sessionId) throw new Error("Войдите в аккаунт, чтобы выбрать организацию.");
  setBuyerMode("switching");
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
  try {
    // A handoff initially scopes the workspace session to one organization.
    // Refresh rechecks current memberships before requesting another organization.
    const token = await sessionStore.getAccessToken(true);
    if (sessionStore.getSnapshot().session?.sessionId !== captured.sessionId || sessionStore.getSnapshot().session?.organizationId !== captured.organizationId) throw new Error("Аккаунт изменился. Повторите выбор организации.");
    const response = await fetch(`${api}/auth/sessions/${encodeURIComponent(captured.sessionId)}/organization`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ organizationId }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Не удалось выбрать организацию. Проверьте доступ и повторите попытку.");
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("accessToken" in result) || typeof result.accessToken !== "string" ||
      !("activeOrganizationId" in result) || result.activeOrganizationId !== organizationId) throw new Error("Сервер не подтвердил выбранную организацию.");
    const verified = await fetch(`${api}/auth/workspace-context`, { headers: { authorization: `Bearer ${result.accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const context = verified.ok ? workspaceContextSchema.parse(await verified.json()) : null;
    if (!context || context.organizationId !== organizationId || !context.capabilities.includes("BUYER")) throw new Error("У организации нет доступа к покупкам.");
    // Discard old forms and cached responses. The next document restores the
    // switched session from its HttpOnly cookie and revalidates all cart terms.
    sessionStore.invalidate();
    setBuyerMode("organization");
  } catch (cause) {
    // A timeout may follow a committed switch. Never continue with the old token.
    if (sessionStore.getSnapshot().session?.sessionId === captured.sessionId) sessionStore.invalidate();
    setBuyerMode("personal");
    await sessionStore.retry();
    throw cause;
  }
}
