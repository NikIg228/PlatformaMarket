import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { NativeMfaError, mfaCodeInputSchema, type NativeMfaPort, type MfaStatus, type MfaEnrollment, type MfaVerified, type MfaChallenged } from "./native-mfa";
import { MarketHttpError } from "./market-transport";
import type { ReadScope } from "./read-controller";
export type MfaAction = "enroll" | "verify" | "disable" | "challenge";
export type MfaIssue = "input" | "backup" | "consent" | "code-or-session" | "denied" | "missing" | "conflict" | "throttled" | "network" | "contract";
export type MfaManagementState = Readonly<{ phase: "idle" | "reading" | "ready" | "review-enroll" | "enrolling" | "setup" | "verifying" | "review-disable" | "disabling" | "unknown" | "rejected" | "verified" | "disabled" | "observed" | "review-challenge" | "challenging" | "challenged"; status?: MfaStatus; enrollment?: MfaEnrollment; factor?: MfaVerified; challenge?: MfaChallenged; action?: MfaAction; issue?: MfaIssue; backedUp: boolean; consent: boolean; rotation: boolean; unresolved: boolean; history: readonly MfaAction[] }>;
const empty: MfaManagementState = Object.freeze({ phase: "idle", backedUp: false, consent: false, rotation: false, unresolved: false, history: Object.freeze([]) });
const running = new Set(["reading", "enrolling", "verifying", "disabling", "challenging"]);
function issueFor(error: unknown, action?: MfaAction): { issue: MfaIssue; rejected: boolean } {
  if (error instanceof NativeMfaError) return { issue: error.code === "input" ? "input" : "contract", rejected: error.code === "input" };
  try { if (error instanceof MarketHttpError) { const value = errorResponseSchema.safeParse(error.payload); if (!value.success || value.data.statusCode !== error.status) return { issue: "contract", rejected: false }; const issue: MfaIssue | undefined = error.status === 400 ? "input" : error.status === 401 ? "code-or-session" : error.status === 403 ? "denied" : error.status === 404 ? "missing" : error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : undefined; if (issue) return { issue, rejected: !((action === "verify" || action === "challenge") && error.status === 401) }; } } catch { /* A malformed error never proves that the command was rejected. */ }
  return { issue: "network", rejected: false };
}
/** Scoped own-account UI. Keyless commands never replay; independent status cannot attribute an unknown command. */
export function createMfaManagement(scope: ReadScope, port: NativeMfaPort) {
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>(); let state = empty, active = true, pending: object | null = null, reviewBase: MfaManagementState | null = null;
  const available = () => { try { return active && port.available(owner) === true; } catch { return false; } };
  const emit = (next: MfaManagementState) => { state = Object.freeze(next); listeners.forEach(fn => fn()); };
  const eligible = () => available() && !pending && !running.has(state.phase) && !state.unresolved;
  const pendingSetup = () => !!state.enrollment || state.status?.status === "PENDING";
  const canVerify = () => eligible() && ["ready", "setup", "rejected"].includes(state.phase) && pendingSetup() && (state.phase !== "rejected" || state.action === "verify" && ["input", "code-or-session", "throttled"].includes(state.issue ?? ""));
  const canReviewEnroll = () => eligible() && ["ready", "setup", "rejected"].includes(state.phase) && (!!state.enrollment || !!state.status && ["NOT_ENROLLED", "REVOKED", "PENDING"].includes(state.status.status)) && (state.phase !== "rejected" || state.action === "verify");
  const canReviewDisable = () => eligible() && state.phase === "ready" && state.status?.status === "ACTIVE";
  const canReviewChallenge = () => eligible() && state.phase === "ready" && state.status?.status === "ACTIVE";
  const canRead = () => available() && !pending && !running.has(state.phase);
  const settleFailure = (token: object, action: MfaAction, error: unknown) => { if (!available() || pending !== token) return; pending = null; const result = issueFor(error, action); emit({ ...state, phase: result.rejected ? "rejected" : "unknown", action, issue: result.issue, unresolved: !result.rejected, ...(result.rejected ? {} : { enrollment: undefined, backedUp: false }), consent: false }); };
  return {
    getSnapshot: () => state, available, canRead, canVerify, canReviewEnroll, canReviewDisable, canReviewChallenge,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async readStatus() {
      if (!canRead()) return; const token = {}; pending = token; reviewBase = null; emit({ ...state, phase: "reading", issue: undefined, consent: false });
      try { const value = await port.status(owner); if (!available() || pending !== token) return; pending = null; const status = Object.freeze({ ...value }), enrollment = status.status === "PENDING" ? state.enrollment : undefined;
        emit({ ...state, phase: state.unresolved ? "observed" : enrollment ? "setup" : "ready", status, enrollment, action: state.unresolved ? state.action : undefined, ...(enrollment ? {} : { backedUp: false }), issue: undefined, consent: false });
      } catch (error) { if (!available() || pending !== token) return; pending = null; emit({ ...state, phase: state.unresolved ? "unknown" : "rejected", issue: issueFor(error).issue, consent: false }); }
    },
    reviewEnroll() { if (!canReviewEnroll()) return false; reviewBase = state; emit({ ...state, phase: "review-enroll", rotation: pendingSetup(), consent: false, issue: undefined }); return true; },
    reviewDisable() { if (!canReviewDisable()) return false; reviewBase = state; emit({ ...state, phase: "review-disable", consent: false, issue: undefined }); return true; },
    reviewChallenge() { if (!canReviewChallenge()) return false; reviewBase = state; emit({ ...state, phase: "review-challenge", consent: false, issue: undefined }); return true; },
    consent(value: boolean) { if (!eligible() || !["review-enroll", "review-disable"].includes(state.phase) || typeof value !== "boolean") return false; emit({ ...state, consent: value, issue: undefined }); return true; },
    backup(value: boolean) { if (!eligible() || !["ready", "setup", "rejected"].includes(state.phase) || !pendingSetup() || typeof value !== "boolean") return false; emit({ ...state, backedUp: value, issue: undefined }); return true; },
    cancelReview() { if (!eligible() || !reviewBase || !["review-enroll", "review-disable", "review-challenge"].includes(state.phase)) return false; const previous = reviewBase; reviewBase = null; emit(previous); return true; },
    canConfirmEnroll() { return eligible() && state.phase === "review-enroll" && (!state.rotation || state.consent); },
    async confirmEnroll() {
      if (!eligible() || state.phase !== "review-enroll") return; if (state.rotation && !state.consent) { emit({ ...state, issue: "consent" }); return; }
      const token = {}; pending = token; reviewBase = null; emit({ ...state, phase: "enrolling", action: "enroll", status: undefined, enrollment: undefined, factor: undefined, challenge: undefined, backedUp: false, consent: false, issue: undefined });
      try { const value = await port.enroll(owner); if (!available() || pending !== token) return; pending = null; const enrollment = Object.freeze({ ...value, recoveryCodes: Object.freeze([...value.recoveryCodes]) }); emit({ ...state, phase: "setup", enrollment, action: undefined, backedUp: false, unresolved: false, issue: undefined }); }
      catch (error) { settleFailure(token, "enroll", error); }
    },
    async verify(raw: string) {
      if (!canVerify()) return false; const parsed = mfaCodeInputSchema.safeParse({ code: raw }); if (!parsed.success || !/^\d{6}$/.test(parsed.data.code)) { emit({ ...state, issue: "input" }); return false; } if (!state.backedUp) { emit({ ...state, issue: "backup" }); return false; }
      const token = {}, input = Object.freeze(parsed.data); pending = token; emit({ ...state, phase: "verifying", action: "verify", issue: undefined, consent: false });
      try { const value = await port.verify(owner, input); if (!available() || pending !== token) return false; pending = null; emit({ ...state, phase: "verified", factor: Object.freeze({ ...value }), challenge: undefined, status: undefined, enrollment: undefined, action: undefined, backedUp: false, unresolved: false, issue: undefined }); return true; }
      catch (error) { settleFailure(token, "verify", error); return false; }
    },
    canConfirmDisable() { return eligible() && state.phase === "review-disable" && state.consent; },
    async confirmDisable(raw: string) {
      if (!eligible() || state.phase !== "review-disable") return false; const parsed = mfaCodeInputSchema.safeParse({ code: raw }); if (!parsed.success) { emit({ ...state, issue: "input" }); return false; } if (!state.consent) { emit({ ...state, issue: "consent" }); return false; }
      const token = {}, input = Object.freeze(parsed.data); pending = token; reviewBase = null; emit({ ...state, phase: "disabling", action: "disable", status: undefined, enrollment: undefined, factor: undefined, challenge: undefined, backedUp: false, issue: undefined, consent: false });
      try { await port.disable(owner, input); if (!available() || pending !== token) return false; pending = null; emit({ ...empty, phase: "disabled", history: state.history }); return true; }
      catch (error) { settleFailure(token, "disable", error); return false; }
    },
    async confirmChallenge(raw: string) {
      if (!eligible() || state.phase !== "review-challenge") return false; const parsed = mfaCodeInputSchema.safeParse({ code: raw }); if (!parsed.success) { emit({ ...state, issue: "input" }); return false; }
      const token = {}, input = Object.freeze(parsed.data); pending = token; reviewBase = null; emit({ ...state, phase: "challenging", action: "challenge", status: undefined, enrollment: undefined, factor: undefined, challenge: undefined, backedUp: false, issue: undefined });
      try { const value = await port.challenge(owner, input); if (!available() || pending !== token) return false; pending = null; emit({ ...state, phase: "challenged", challenge: Object.freeze({ ...value }), action: undefined, unresolved: false, issue: undefined }); return true; }
      catch (error) { settleFailure(token, "challenge", error); return false; }
    },
    canAcceptObserved() { return available() && !pending && state.phase === "observed" && state.unresolved && !!state.status && !!state.action; },
    acceptObserved() { if (!this.canAcceptObserved()) return false; const action = state.action!; emit({ ...state, phase: "ready", history: Object.freeze([...state.history, action]), action: undefined, unresolved: false, enrollment: undefined, factor: undefined, challenge: undefined, backedUp: false, consent: false, issue: undefined }); return true; },
    hide() {
      if (!available()) return;
      if (reviewBase) reviewBase = Object.freeze({ ...reviewBase, consent: false, backedUp: false });
      if (state.consent || state.backedUp) emit({ ...state, consent: false, backedUp: false });
    },
    activate() { active = true; },
    close() { active = false; pending = null; reviewBase = null; emit(empty); listeners.clear(); },
  };
}
export type MfaManagement = ReturnType<typeof createMfaManagement>;
