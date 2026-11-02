import { createPersonalProfileAvatar } from "./personal-profile-avatar";
import { updatePersonalProfileSchema, requestProfileEmailSchema, profileEmailRequestedSchema } from "../../../packages/schemas/src/personal-profile";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { NativePersonalProfileError, type NativePersonalProfilePort, type OwnPersonalProfile, type PersonalProfileUpdate, type PersonalProfileEmailInput, type PersonalProfileEmailReceipt } from "./native-personal-profile";
import type { ReadScope } from "./read-controller";
export type PersonalProfileDraft = Readonly<{ displayName: string; phone: string }>;
export type PersonalProfileIssue = "consent" | "email" | "same-email" | "input" | "phone-removal" | "unchanged" | "denied" | "missing" | "conflict" | "throttled" | "network" | "contract";
export type PersonalProfileState = Readonly<{ phase: "idle" | "reading" | "ready" | "editing" | "review" | "saving" | "saved" | "rejected" | "unknown" | "observed" | "error" | "email-editing" | "email-review" | "email-requesting" | "email-requested"; action?: "profile" | "email"; emailDraft?: string; previousEmailDraft?: string; emailPreview?: PersonalProfileEmailInput; emailReceipt?: PersonalProfileEmailReceipt; emailConsent?: boolean; emailHistory?: readonly number[]; profile?: OwnPersonalProfile; draft?: PersonalProfileDraft; preview?: PersonalProfileUpdate; previousDraft?: PersonalProfileDraft; previousVersion?: number; previousFields?: readonly (keyof PersonalProfileDraft)[]; originalVersion?: number; unresolved: boolean; issue?: PersonalProfileIssue; history: readonly number[] }>;
const empty: PersonalProfileState = Object.freeze({ phase: "idle", unresolved: false, history: Object.freeze([]) });
function failure(error: unknown): { issue: PersonalProfileIssue; known: boolean } {
  if (error instanceof NativePersonalProfileError) return { issue: error.code === "input" ? "input" : "contract", known: false };
  try {
    if (error && typeof error === "object" && "status" in error && "payload" in error) {
      const checked = errorResponseSchema.safeParse(error.payload); if (!checked.success || checked.data.statusCode !== error.status) return { issue: "contract", known: false };
      const issue: PersonalProfileIssue = error.status === 400 ? "input" : error.status === 403 ? "denied" : error.status === 404 ? "missing" : error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : "network";
      return { issue, known: issue !== "network" };
    }
  } catch { return { issue: "contract", known: false }; }
  return { issue: "network", known: false };
}
/** Own profile version-CAS form. There is no request key or replay of an unknown write. */
export function createPersonalProfileEdit(scope: ReadScope, port: NativePersonalProfilePort) {
  let active = true, ticket = 0, state = empty; const listeners = new Set<() => void>();
  let avatar: ReturnType<typeof createPersonalProfileAvatar> | undefined;
  const available = () => active && port.available(scope), publish = (patch: Partial<PersonalProfileState>) => { state = Object.freeze({ ...state, ...patch }); avatar?.sync(); listeners.forEach(listener => listener()); };
  const busy = () => state.phase === "reading" || state.phase === "saving" || state.phase === "email-requesting";
  const canEdit = () => available() && state.phase === "ready" && !!state.profile && !state.unresolved;
  const canRequestEmail = () => canEdit() && typeof port.requestEmail === "function";
  const valid = (profile: OwnPersonalProfile, minimum: number) => { if (profile.id !== scope.userId || profile.version < Math.max(minimum, state.profile?.version ?? 1)) throw new NativePersonalProfileError("contract"); };
  avatar = createPersonalProfileAvatar(scope, port, () => active && state.issue !== "denied" && ["ready", "editing", "review", "saved", "email-editing", "email-review"].includes(state.phase) ? state.profile : undefined);
  return {
    avatar, available, canEdit, canRequestEmail, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, activate() { active = true; avatar!.activate(); },
    async read() {
      if (!available() || busy() || state.phase === "editing" || (state.phase === "review" || state.phase === "email-editing" || state.phase === "email-review")) return;
      const mine = ++ticket; publish({ phase: "reading", issue: undefined });
      try { const profile = await port.read(scope); if (!available() || mine !== ticket) return; valid(profile, 1); publish({ phase: state.unresolved ? "observed" : "ready", profile, preview: undefined, ...(!state.unresolved ? { originalVersion: undefined } : {}) }); }
      catch (error) { if (!available() || mine !== ticket) return; publish({ phase: state.unresolved ? "unknown" : "error", issue: failure(error).issue }); }
    },
    edit() { if (!canEdit()) return; publish({ phase: "editing", action: "profile", draft: Object.freeze({ displayName: state.profile!.displayName, phone: state.profile!.phone ?? "" }), preview: undefined, issue: undefined }); },
    restorePrevious() {
      if (!canEdit() || !state.previousDraft || !state.profile) return;
      const fresh = { displayName: state.profile.displayName, phone: state.profile.phone ?? "" };
      if (state.previousVersion === state.profile.version) Object.assign(fresh, state.previousDraft);
      else for (const field of state.previousFields ?? []) fresh[field] = state.previousDraft[field];
      publish({ phase: "editing", action: "profile", draft: Object.freeze(fresh), preview: undefined, issue: undefined });
    },
    change(field: keyof PersonalProfileDraft, value: string) { if (!available() || state.phase !== "editing" || !state.draft || !["displayName", "phone"].includes(field) || typeof value !== "string") return; publish({ draft: Object.freeze({ ...state.draft, [field]: value }), issue: undefined }); },
    review() {
      if (!available() || state.phase !== "editing" || !state.draft || !state.profile || state.unresolved) return;
      const { draft, profile } = state, displayName = draft.displayName.trim(), phone = draft.phone.trim(), nameChanged = displayName !== profile.displayName, phoneChanged = phone !== (profile.phone ?? "");
      if (!nameChanged && !phoneChanged) { publish({ issue: "unchanged" }); return; }
      if (phoneChanged && !phone && profile.phone !== null) { publish({ issue: "phone-removal" }); return; }
      const checked = updatePersonalProfileSchema.safeParse({ expectedVersion: profile.version, ...(nameChanged ? { displayName: draft.displayName } : {}), ...(phoneChanged ? { phone: draft.phone } : {}) });
      if (!checked.success) { publish({ issue: "input" }); return; }
      publish({ phase: "review", action: "profile", preview: Object.freeze(checked.data), issue: undefined });
    },
    backToEdit() { if (available() && state.phase === "review") publish({ phase: "editing", preview: undefined }); },
    cancel() { if (available() && ["editing", "review"].includes(state.phase)) publish({ phase: "ready", draft: undefined, preview: undefined, issue: undefined }); },
    beginEmail() { if (!canRequestEmail()) return; publish({ phase: "email-editing", action: "email", emailDraft: state.previousEmailDraft ?? "", emailPreview: undefined, emailReceipt: undefined, emailConsent: false, issue: undefined }); },
    changeEmail(value: string) { if (available() && state.phase === "email-editing" && typeof value === "string") publish({ emailDraft: value, emailConsent: false, issue: undefined }); },
    reviewEmail() {
      if (!available() || state.phase !== "email-editing" || state.emailDraft === undefined || !state.profile || state.unresolved || typeof port.requestEmail !== "function") return;
      const checked = requestProfileEmailSchema.safeParse({ expectedVersion: state.profile.version, email: state.emailDraft.trim() });
      if (!checked.success) { publish({ issue: "email" }); return; }
      if (checked.data.email === state.profile.email.toLowerCase()) { publish({ issue: "same-email" }); return; }
      publish({ phase: "email-review", emailPreview: Object.freeze(checked.data), emailConsent: false, issue: undefined });
    },
    emailConsent(value: boolean) { if (available() && state.phase === "email-review") publish({ emailConsent: value === true, issue: undefined }); },
    backToEmail() { if (available() && state.phase === "email-review") publish({ phase: "email-editing", emailPreview: undefined, emailConsent: false, issue: undefined }); },
    cancelEmail() { if (available() && ["email-editing", "email-review"].includes(state.phase)) publish({ phase: "ready", emailDraft: undefined, emailPreview: undefined, emailConsent: false, issue: undefined }); },
    hide() { avatar!.hide(); if (state.phase === "email-review") publish({ emailConsent: false, issue: undefined }); },
    async confirmEmail() {
      if (!available() || state.phase !== "email-review" || !state.emailPreview || state.emailDraft === undefined || state.unresolved || typeof port.requestEmail !== "function") return;
      if (!state.emailConsent) { publish({ issue: "consent" }); return; }
      const input = state.emailPreview, mine = ++ticket;
      publish({ phase: "email-requesting", action: "email", previousEmailDraft: state.emailDraft, emailDraft: undefined, emailPreview: undefined, emailReceipt: undefined, emailConsent: false, originalVersion: input.expectedVersion, issue: undefined });
      try {
        const raw = await port.requestEmail(scope, input); if (!available() || mine !== ticket) return;
        const parsed = profileEmailRequestedSchema.safeParse(raw); if (!parsed.success || parsed.data.email !== input.email) throw new NativePersonalProfileError("contract");
        publish({ phase: "email-requested", emailReceipt: Object.freeze(parsed.data), unresolved: false, originalVersion: undefined });
      } catch (error) { if (!available() || mine !== ticket) return; const result = failure(error); publish({ phase: result.known ? "rejected" : "unknown", unresolved: !result.known, issue: result.issue }); }
    },
    async confirm() {
      if (!available() || state.phase !== "review" || !state.preview || !state.draft || state.unresolved) return;
      const input = state.preview, mine = ++ticket; publish({ phase: "saving", action: "profile", previousDraft: state.draft, previousVersion: input.expectedVersion, previousFields: Object.freeze((["displayName", "phone"] as const).filter(field => input[field] !== undefined)), draft: undefined, preview: undefined, originalVersion: input.expectedVersion, issue: undefined });
      try { const profile = await port.save(scope, input); if (!available() || mine !== ticket) return; valid(profile, input.expectedVersion + 1); publish({ phase: "saved", profile, unresolved: false, originalVersion: undefined, previousDraft: undefined, previousVersion: undefined, previousFields: undefined }); }
      catch (error) { if (!available() || mine !== ticket) return; const result = failure(error); publish({ phase: result.known ? "rejected" : "unknown", unresolved: !result.known, issue: result.issue }); }
    },
    acceptObserved() { if (!available() || state.phase !== "observed" || !state.unresolved || state.originalVersion === undefined) return; const originalVersion = state.originalVersion; publish({ phase: "ready", unresolved: false, originalVersion: undefined, ...(state.action === "email" ? { emailHistory: Object.freeze([...(state.emailHistory ?? []), originalVersion]) } : { history: Object.freeze([...state.history, originalVersion]) }), issue: undefined }); },
    close() { active = false; ++ticket; state = empty; avatar!.close(); listeners.forEach(listener => listener()); listeners.clear(); },
  };
}
export type PersonalProfileEdit = ReturnType<typeof createPersonalProfileEdit>;
