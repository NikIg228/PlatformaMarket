import { z } from "zod";
import { createRegistrationIntentSchema, emailRegisterSchema } from "../../../packages/schemas/src/commercial";
import { emailEntryAccepted, emailEntryRejected } from "./email-entry";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { MarketHttpError } from "./market-transport";
import type { NativeUuidProvider } from "./native-uuid-source";
import { registrationLegalVersion } from "./registration-legal";
export const buyerRegistrationFields = ["ownerDisplayName", "email", "bin", "legalName", "organizationDisplayName"] as const;
export type BuyerRegistrationField = typeof buyerRegistrationFields[number];
export type BuyerRegistrationRaw = Readonly<Record<BuyerRegistrationField, string>>;
type Consents = Readonly<{ termsAccepted: boolean; privacyAccepted: boolean; marketingConsent: boolean }>;
const previewSchema = createRegistrationIntentSchema.omit({ idempotencyKey: true }).extend({ capability: z.literal("BUYER"), consentVersion: z.literal(registrationLegalVersion), source: z.literal("mobile_registration") }).strict();
export type BuyerRegistrationPreview = Readonly<z.infer<typeof previewSchema>>;
const registrationSchema = z.object({ id: z.uuid(), email: z.email(), capability: z.enum(["BUYER", "SUPPLIER"]), status: z.enum(["PENDING", "CLAIMED", "EXPIRED", "CANCELLED"]), expiresAt: z.iso.datetime(), organizationId: z.uuid().nullable(), createdAt: z.iso.datetime() }).strict();
export type BuyerRegistrationReceipt = Readonly<z.infer<typeof registrationSchema>>;
export type BuyerRegistrationIssue = "input" | "conflict" | "denied" | "throttled" | "unavailable" | "network" | "contract" | "key";
type Phase = "editing" | "review" | "creating" | "unknown" | "rejected" | "pending" | "unavailable" | "registering" | "registered" | "registration-rejected" | "registration-unknown";
export type BuyerRegistrationState = Readonly<{ frame: number; phase: Phase; raw: BuyerRegistrationRaw; consents: Consents; selections: Readonly<Partial<Record<BuyerRegistrationField, Readonly<{ start: number; end: number }>>>>; errors?: Readonly<Partial<Record<BuyerRegistrationField | "termsAccepted" | "privacyAccepted", true>>>; preview?: BuyerRegistrationPreview; receipt?: BuyerRegistrationReceipt; issue?: BuyerRegistrationIssue; delivery?: "LOCAL_FILE" | "PROVIDER" }>;
export type BuyerRegistrationTransport = Readonly<{ available(): boolean; post(path: "/onboarding/registrations" | "/auth/register", body: unknown): Promise<unknown>; uuidProvider?: NativeUuidProvider }>;
class RegistrationFailure extends Error { constructor(readonly issue: "contract" | "key") { super("Registration could not be confirmed"); this.name = "RegistrationFailure"; } }
function decodeIntent(raw: unknown, expected: Readonly<{ email: string }>) {
  try {
    if (!raw || typeof raw !== "object" || Object.keys(raw).some(key => !["registration", "registrationToken", "replayed"].includes(key))) throw Error("contract");
    const shell = z.object({ registration: registrationSchema, replayed: z.boolean() }).strip().parse(raw), receipt = Object.freeze(shell.registration);
    if (receipt.email !== expected.email || receipt.capability !== "BUYER") throw Error("contract");
    // Check public correlation before the private producer token, which is never a public receipt field.
    const token = emailRegisterSchema.shape.registrationToken.unwrap().nullable().parse((raw as { registrationToken?: unknown }).registrationToken);
    if (token !== null && (receipt.status !== "PENDING" || receipt.organizationId !== null)) throw Error("contract");
    return { receipt, token };
  } catch { throw new RegistrationFailure("contract"); }
}
function intentIssue(error: unknown): { unknown: boolean; issue: BuyerRegistrationIssue } {
  if (error instanceof RegistrationFailure) return { unknown: error.issue !== "key", issue: error.issue };
  try { if (error instanceof MarketHttpError) { const envelope = errorResponseSchema.safeParse(error.payload); if (!envelope.success || envelope.data.statusCode !== error.status) return { unknown: true, issue: "contract" }; const issue = error.status === 400 ? "input" : error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : undefined; if (issue) return { unknown: false, issue }; } } catch { return { unknown: true, issue: "contract" }; }
  return { unknown: true, issue: "network" };
}
/** Owned anonymous form/attempt lifetime; no invented actor/org scope or client-side permission grant. */
export function createBuyerRegistration(transport: BuyerRegistrationTransport) {
  let frame = 1, closed = false, issuing = false, accountStarted = false;
  let attempt: Readonly<z.infer<typeof createRegistrationIntentSchema>> | undefined, registrationToken: string | undefined;
  let generate: (() => unknown) | undefined;
  try { const method = transport.uuidProvider?.randomUUID; if (typeof method === "function") generate = () => method.call(transport.uuidProvider); } catch { /* Native capability absent; no random fallback. */ }
  const issued = new Set<string>(), accountInputs = new WeakSet<object>(), listeners = new Set<() => void>();
  const initial = (): BuyerRegistrationState => Object.freeze({ frame, phase: "editing", raw: Object.freeze(Object.fromEntries(buyerRegistrationFields.map(field => [field, ""])) as Record<BuyerRegistrationField, string>), consents: Object.freeze({ termsAccepted: false, privacyAccepted: false, marketingConsent: false }), selections: Object.freeze({}) });
  let state = initial();
  const live = (expected = frame) => { try { return !closed && expected === frame && transport.available() === true && expected === frame && !closed; } catch { return false; } };
  const publish = (next: BuyerRegistrationState) => { if (closed) return; state = Object.freeze(next); listeners.forEach(listener => listener()); };
  const patch = (next: Partial<BuyerRegistrationState>) => publish({ ...state, ...next });
  async function sendIntent(expectedFrame: number) {
    if (!attempt || accountStarted || !live(expectedFrame)) return;
    patch({ phase: "creating", issue: undefined });
    try {
      const raw = await transport.post("/onboarding/registrations", attempt); if (!live(expectedFrame)) return;
      const result = decodeIntent(raw, attempt); if (!live(expectedFrame)) return;
      registrationToken = result.token ?? undefined; patch({ phase: result.token ? "pending" : "unavailable", receipt: result.receipt, issue: undefined });
    } catch (error) { if (!live(expectedFrame)) return; const problem = intentIssue(error); patch({ phase: problem.unknown ? "unknown" : "rejected", issue: problem.issue }); }
  }
  function reset() { if (closed) return; frame++; attempt = undefined; registrationToken = undefined; accountStarted = false; issued.clear(); publish(initial()); }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    supported: () => !closed && !!generate,
    change(field: BuyerRegistrationField, value: string, expectedFrame = frame) {
      if (!live(expectedFrame) || state.phase !== "editing" || !buyerRegistrationFields.includes(field) || typeof value !== "string" || value.length > 4096) return;
      const selection = state.selections[field];
      patch({ raw: Object.freeze({ ...state.raw, [field]: value }), ...(selection ? { selections: Object.freeze({ ...state.selections, [field]: Object.freeze({ start: Math.min(selection.start, value.length), end: Math.min(selection.end, value.length) }) }) } : {}), errors: undefined, issue: undefined });
    },
    selection(field: BuyerRegistrationField, value: Readonly<{ start: number; end: number }>, expectedFrame = frame) {
      if (!live(expectedFrame) || state.phase !== "editing" || !buyerRegistrationFields.includes(field) || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 || value.end < value.start || value.end > state.raw[field].length) return;
      const previous = state.selections[field]; if (previous?.start === value.start && previous.end === value.end) return;
      patch({ selections: Object.freeze({ ...state.selections, [field]: Object.freeze({ start: value.start, end: value.end }) }) });
    },
    consent(field: "termsAccepted" | "privacyAccepted", value: boolean, expectedFrame = frame) { if (live(expectedFrame) && state.phase === "editing" && ["termsAccepted", "privacyAccepted"].includes(field) && typeof value === "boolean") patch({ consents: Object.freeze({ ...state.consents, [field]: value }), errors: undefined }); },
    review(expectedFrame = frame) {
      if (!live(expectedFrame) || state.phase !== "editing") return;
      const checked = previewSchema.safeParse({ ...state.raw, email: state.raw.email.trim(), bin: state.raw.bin.trim(), ...state.consents, capability: "BUYER", consentVersion: registrationLegalVersion, source: "mobile_registration" });
      if (!checked.success) { const errors: Partial<Record<BuyerRegistrationField | "termsAccepted" | "privacyAccepted", true>> = {}; for (const issue of checked.error.issues) { const field = issue.path[0]; if ([...buyerRegistrationFields, "termsAccepted", "privacyAccepted"].includes(field as BuyerRegistrationField)) errors[field as keyof typeof errors] = true; } patch({ errors: Object.freeze(errors), issue: "input" }); return; }
      patch({ phase: "review", preview: Object.freeze(checked.data), errors: undefined, issue: undefined });
    },
    backToEdit(expected: BuyerRegistrationPreview) { if (live() && state.phase === "review" && state.preview === expected) patch({ phase: "editing", preview: undefined, issue: undefined }); },
    async confirm(expected: BuyerRegistrationPreview) {
      if (!live() || state.phase !== "review" || state.preview !== expected || attempt || issuing) return;
      const expectedFrame = frame; issuing = true;
      try {
        if (!generate) throw new RegistrationFailure("key"); const key = generate(); if (!live(expectedFrame)) return;
        if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key) || issued.has(key)) throw new RegistrationFailure("key"); issued.add(key);
        attempt = Object.freeze(createRegistrationIntentSchema.strict().parse({ ...expected, idempotencyKey: key }));
      } catch { if (live(expectedFrame)) patch({ issue: "key" }); return; }
      finally { issuing = false; }
      await sendIntent(expectedFrame);
    },
    retryIntent() { if (state.phase !== "unknown" || accountStarted) return Promise.resolve(); return sendIntent(frame); },
    editRejected() { if (!live() || state.phase !== "rejected") return; attempt = undefined; registrationToken = undefined; patch({ phase: "editing", preview: undefined, receipt: undefined, issue: undefined, consents: Object.freeze({ ...state.consents, termsAccepted: false, privacyAccepted: false }) }); },
    async registerAccount(expected: BuyerRegistrationReceipt, input: Readonly<{ password: string }>) {
      if (!live() || !registrationToken || !attempt || state.receipt !== expected || !(state.phase === "pending" || state.phase === "registration-rejected" && ["input", "throttled", "unavailable"].includes(state.issue ?? "")) || !input || typeof input !== "object" || accountInputs.has(input)) return;
      const checked = emailRegisterSchema.pick({ password: true }).strict().safeParse(input); if (!checked.success) { patch({ issue: "input" }); return; }
      const expectedFrame = frame, body = emailRegisterSchema.strict().parse({ email: attempt.email, displayName: attempt.ownerDisplayName, password: checked.data.password, registrationToken });
      accountInputs.add(input); accountStarted = true; patch({ phase: "registering", issue: undefined });
      try {
        const raw = await transport.post("/auth/register", body); if (!live(expectedFrame)) return;
        const accepted = emailEntryAccepted("register", expected.email, raw); if (!live(expectedFrame)) return;
        registrationToken = undefined; patch({ phase: "registered", delivery: accepted.delivery, issue: undefined });
      } catch (error) {
        if (!live(expectedFrame)) return; const problem = emailEntryRejected("register", expected.email, error);
        if (problem.phase === "unknown") registrationToken = undefined;
        patch({ phase: problem.phase === "unknown" ? "registration-unknown" : "registration-rejected", issue: problem.issue });
      }
    },
    reset,
    close() { frame++; closed = true; attempt = undefined; registrationToken = undefined; accountStarted = false; state = initial(); generate = undefined; issued.clear(); listeners.clear(); },
  });
}
export type BuyerRegistration = ReturnType<typeof createBuyerRegistration>;
