import { revokeSessionSchema } from "../../../packages/schemas/src/commercial";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { NativeOwnSessionsError, type NativeOwnSessionsPort, type OwnSession, type OwnSessionRevocation } from "./native-own-sessions";
import type { ReadScope } from "./read-controller";
export type OwnSessionIssue = "consent" | "input" | "denied" | "missing" | "throttled" | "network" | "contract";
export type OwnSessionState = Readonly<{ phase: "idle" | "loading" | "ready" | "review" | "revoking" | "revoked" | "unknown" | "observed" | "rejected" | "error"; rows: readonly OwnSession[]; selected?: OwnSession; selectedCurrent?: boolean; receipt?: OwnSessionRevocation; consent: boolean; issue?: OwnSessionIssue; history: readonly string[] }>;
const empty: OwnSessionState = Object.freeze({ phase: "idle", rows: Object.freeze([]), consent: false, history: Object.freeze([]) });
function failure(error: unknown): { issue: OwnSessionIssue; known: boolean } {
  if (error instanceof NativeOwnSessionsError) return { issue: error.code === "input" ? "input" : "contract", known: false };
  try {
    if (error && typeof error === "object" && "status" in error && "payload" in error) {
      const checked = errorResponseSchema.safeParse(error.payload); if (!checked.success || checked.data.statusCode !== error.status) return { issue: "contract", known: false };
      const issue: OwnSessionIssue = error.status === 400 ? "input" : error.status === 403 ? "denied" : error.status === 404 ? "missing" : error.status === 429 ? "throttled" : "network";
      return { issue, known: issue !== "network" };
    }
  } catch { return { issue: "contract", known: false }; }
  return { issue: "network", known: false };
}
/** Keyless selected-session termination. Independent ACTIVE-list presence is observation, never attribution of an unknown command. */
export function createOwnSessionManagement(scope: ReadScope, port: NativeOwnSessionsPort) {
  let active = true, ticket = 0, unresolved = false, state = empty; const listeners = new Set<() => void>();
  const available = () => active && port.available(scope), busy = () => state.phase === "loading" || state.phase === "revoking";
  const publish = (patch: Partial<OwnSessionState>) => { state = Object.freeze({ ...state, ...patch }); listeners.forEach(listener => listener()); };
  const model = {
    available, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, activate() { active = true; },
    async read() {
      if (!available() || busy() || state.phase === "review") return;
      const mine = ++ticket; publish({ phase: "loading", rows: Object.freeze([]), receipt: undefined, consent: false, issue: undefined, ...(!unresolved ? { selected: undefined, selectedCurrent: undefined } : {}) });
      try { const rows = await port.list(scope); if (!available() || mine !== ticket) return; publish({ phase: unresolved ? "observed" : "ready", rows }); }
      catch (error) { if (!available() || mine !== ticket) return; publish({ phase: unresolved ? "unknown" : "error", issue: failure(error).issue }); }
    },
    isCurrent(row: OwnSession) { return available() && port.isCurrent(scope, row); },
    review(row: OwnSession) { if (!available() || state.phase !== "ready" || unresolved || !state.rows.includes(row)) return; publish({ phase: "review", selected: row, selectedCurrent: port.isCurrent(scope, row), consent: false, issue: undefined, receipt: undefined }); },
    consent(value: boolean) { if (available() && state.phase === "review") publish({ consent: value === true, issue: undefined }); },
    cancel() { if (available() && state.phase === "review") publish({ phase: "ready", selected: undefined, selectedCurrent: undefined, consent: false, issue: undefined }); },
    hide() { if (state.phase === "review") publish({ consent: false, issue: undefined }); },
    async confirm() {
      if (!available() || state.phase !== "review" || !state.selected || unresolved) return;
      if (!state.consent) { publish({ issue: "consent" }); return; }
      const row = state.selected, body = Object.freeze(revokeSessionSchema.parse({})), mine = ++ticket; publish({ phase: "revoking", consent: false, issue: undefined, rows: Object.freeze([]) });
      try { const receipt = await port.revoke(scope, row, body); if (!available() || mine !== ticket) return; if (receipt.id !== row.id || receipt.status !== "REVOKED") throw new NativeOwnSessionsError("contract"); publish({ phase: "revoked", receipt }); }
      catch (error) { if (!available() || mine !== ticket) return; const result = failure(error); unresolved = !result.known; publish({ phase: unresolved ? "unknown" : "rejected", issue: result.issue }); }
    },
    observedPresence(): boolean | null { return state.phase === "observed" && state.selected ? state.rows.some(row => row.id === state.selected!.id) : null; },
    acceptObserved() { if (!available() || state.phase !== "observed" || !state.selected || !unresolved) return; const target = state.selected.id; unresolved = false; publish({ phase: "ready", selected: undefined, selectedCurrent: undefined, history: Object.freeze([...state.history, target]), issue: undefined }); },
    close() { active = false; ++ticket; unresolved = false; state = empty; listeners.forEach(listener => listener()); listeners.clear(); },
  }; return model;
}
export type OwnSessionManagement = ReturnType<typeof createOwnSessionManagement>;
