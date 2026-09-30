import { currentSessionSchema } from "@marketplace/schemas/workspace-session";

/** End the browser login too, so /login cannot silently recreate a workspace. */
export async function logoutPrimarySession(apiUrl: string) {
  const base = apiUrl.replace(/\/$/, "");
  const current = await fetch(`${base}/auth/current`, { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!current.ok) throw new Error("Не удалось проверить вход. Повторите выход.");
  const value: unknown = await current.json();
  if (value === null) return;
  const session = currentSessionSchema.parse(value);
  const csrf = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith("mp_csrf="));
  if (!csrf) throw new Error("Не удалось подтвердить выход. Обновите страницу и повторите.");
  const response = await fetch(`${base}/auth/logout`, {
    method: "POST", credentials: "include", signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${session.accessToken}`, "x-csrf-token": decodeURIComponent(csrf.slice("mp_csrf=".length)) },
  });
  if (!response.ok || (await response.json()).ok !== true) throw new Error("Сервер не подтвердил выход. Повторите попытку.");
}
