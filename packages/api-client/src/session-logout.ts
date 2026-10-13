import { sessionLogoutResponseSchema } from "@marketplace/schemas";

/** Revoke only the captured target; the server proves its optional origin login. */
export async function revokeWorkspaceSession(apiUrl: string, session: { sessionId?: string; accessToken?: string } | null,
  renewProof?: () => Promise<string | undefined>): Promise<void> {
  if (!session?.sessionId || !session.accessToken) throw new Error("Не удалось определить серверную сессию. Выход не подтверждён.");
  const sessionId = session.sessionId;
  async function send(accessToken: string): Promise<Response> {
    try {
      return await fetch(`${apiUrl.replace(/\/$/, "")}/auth/session-logout`, {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { throw new Error("Не удалось связаться с сервером. Выход не подтверждён — проверьте соединение и повторите."); }
  }
  let response = await send(session.accessToken);
  let payload: unknown = await response.json().catch(() => null);
  const expired = response.status === 401 && payload !== null && typeof payload === "object" && "code" in payload && payload.code === "SESSION_LOGOUT_PROOF_EXPIRED";
  if (expired && renewProof) {
    const renewed = await renewProof();
    if (!renewed) throw new Error("Сервер не подтвердил выход. Войдите в выбранный аккаунт, чтобы завершить его сессию.");
    response = await send(renewed);
    payload = await response.json().catch(() => null);
  }
  if (!response.ok) throw new Error("Сервер не подтвердил выход. Если вход истёк или изменён в другой вкладке, войдите в выбранный аккаунт; при сетевой ошибке повторите попытку.");
  const receipt = sessionLogoutResponseSchema.safeParse(payload);
  if (!receipt.success || receipt.data.sessionId !== sessionId) throw new Error("Сервер не подтвердил отзыв текущей сессии. Повторите попытку.");
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("dentmarket:session-revoked");
    channel.postMessage({ type: "revoked", sessionId }); channel.close();
  }
}
