import type { PersonalSession } from "@marketplace/schemas";

type Snapshot = { ready: boolean; session: PersonalSession | null; error: string | null };
const initial: Snapshot = { ready: false, session: null, error: null };
const changed = "Аккаунт изменился. Проверьте личную корзину перед повтором.";

/** Personal identity is restored only from the server cookie, never local storage
 * or workspace membership. Each API request rechecks the cookie identity. */
export function createPersonalSession(apiUrl: string) {
  let snapshot = initial;
  let generation = 0;
  let initialization: Promise<void> | undefined;
  let pending: Promise<PersonalSession | null> | undefined;
  const listeners = new Set<() => void>();
  const publish = (session: PersonalSession | null, error: string | null = null) => {
    snapshot = { ready: true, session, error };
    for (const listener of listeners) listener();
  };
  const invalidate = (expectedSessionId?: string) => {
    if (expectedSessionId && snapshot.session?.sessionId !== expectedSessionId) return;
    generation++; pending = undefined; publish(null);
  };
  async function restore() {
    const started = generation;
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/personal-current`, {
      credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Не удалось проверить личный вход. Повторите попытку.");
    const { personalSessionSchema } = await import("@marketplace/schemas");
    const session = personalSessionSchema.nullable().parse(await response.json());
    if (started !== generation) throw new Error(changed);
    publish(session);
    return session;
  }
  function recheck() {
    if (!pending) {
      const request = restore(); pending = request;
      void request.finally(() => { if (pending === request) pending = undefined; }).catch(() => {});
    }
    return pending;
  }
  async function initialize() {
    const started = generation;
    try { await recheck(); }
    catch { if (started === generation) publish(snapshot.session, "Не удалось проверить личный вход. Повторите попытку."); }
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => { initialization ??= initialize(); return initialization; },
    check: initialize,
    retry: () => { generation++; pending = undefined; initialization = initialize(); return initialization; },
    invalidate,
    async getAccessToken(expectedSessionId: string) {
      if (snapshot.session?.sessionId !== expectedSessionId) throw new Error(changed);
      const verified = await recheck();
      if (!verified) throw new Error("Войдите в личный аккаунт.");
      if (verified.sessionId !== expectedSessionId || snapshot.session?.sessionId !== expectedSessionId) throw new Error(changed);
      return verified.accessToken;
    },
  };
}
