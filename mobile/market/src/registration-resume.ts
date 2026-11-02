import { z } from "zod";
import { registrationResumeRequestSchema, registrationResumeProofSchema, registrationResumeCompleteSchema, registrationResumeRequestedSchema, registrationResumeDetailsSchema, registrationResumeCompletedSchema, type RegistrationResumeDetails } from "../../../packages/schemas/src/registration-resume";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { MarketHttpError } from "./market-transport";
export type ResumePath = "/auth/registration/resume/request" | "/auth/registration/resume/inspect" | "/auth/registration/resume/complete";
export type ResumeTarget = Readonly<{ email: string; bin: string; capability: "BUYER" }>;
export type ResumeDetails = Readonly<RegistrationResumeDetails>;
export type ResumeIssue = "input" | "invalid" | "conflict" | "throttled" | "unavailable" | "network" | "contract";
type Phase = "entry" | "requesting" | "requested" | "request-error" | "request-unknown" | "inspecting" | "ready" | "read-error" | "observed-completed" | "completing" | "complete-rejected" | "complete-unknown" | "completed";
export type RegistrationResumeState = Readonly<{ frame: number; phase: Phase; raw: Readonly<{ email: string; bin: string }>; details?: ResumeDetails; hasProof?: true; issue?: ResumeIssue; requestUncertain?: true; completeUncertain?: true }>;
class ResumeFailure extends Error { constructor(readonly issue: "input" | "contract") { super("Registration continuation could not be confirmed"); this.name = "ResumeFailure"; } }
export function parseResumeProof(raw: unknown): Readonly<{ token: string }> {
  try {
    const input = z.object({ token: z.string().max(4096) }).strict().parse(raw); let token = input.token.trim();
    if (token.includes("://")) {
      const link = new URL(token), fragment = new URLSearchParams(link.hash.slice(1));
      if (!["http:","https:"].includes(link.protocol) || link.username || link.password || link.pathname !== "/register/resume" || link.search || fragment.size !== 1 || fragment.getAll("token").length !== 1) throw Error("input");
      token = fragment.get("token") ?? "";
    }
    return Object.freeze(registrationResumeProofSchema.parse({ token }));
  } catch { throw new ResumeFailure("input"); }
}
function decodeDetails(raw: unknown, expected: ResumeTarget | undefined): ResumeDetails {
  try {
    const publicBinding = registrationResumeDetailsSchema.pick({ email: true, bin: true, capability: true }).strip().parse(raw);
    if (publicBinding.capability !== "BUYER" || expected && (publicBinding.email !== expected.email || publicBinding.bin !== expected.bin)) throw Error("contract");
    return Object.freeze(registrationResumeDetailsSchema.parse(raw));
  } catch { throw new ResumeFailure("contract"); }
}
function issue(error: unknown): ResumeIssue {
  if (error instanceof ResumeFailure) return error.issue;
  try { if (error instanceof MarketHttpError) { const checked = errorResponseSchema.safeParse(error.payload); if (!checked.success || checked.data.statusCode !== error.status) return "contract"; return error.status === 400 ? "input" : error.status === 401 ? "invalid" : error.status === 409 ? "conflict" : error.status === 429 ? "throttled" : error.status === 503 ? "unavailable" : "network"; } } catch { return "contract"; }
  return "network";
}
/** Source continuation credential stays private. All three operations require explicit user actions. */
export function createRegistrationResume(transport: Readonly<{ available(): boolean; post(path: ResumePath, body: unknown): Promise<unknown> }>) {
  let frame = 1, closed = false, proofCompleted = false, token: string | undefined, target: ResumeTarget | undefined;
  const consumed = new WeakSet<object>(), listeners = new Set<() => void>();
  const initial = (): RegistrationResumeState => Object.freeze({ frame, phase: "entry", raw: Object.freeze({ email: "", bin: "" }) });
  let state = initial();
  const pending = () => ["requesting","inspecting","completing"].includes(state.phase);
  const live = (expectedFrame = frame) => { try { return !closed && expectedFrame === frame && transport.available() === true && expectedFrame === frame && !closed; } catch { return false; } };
  const publish = (next: RegistrationResumeState) => { if (!closed) { state = Object.freeze(next); listeners.forEach(listener => listener()); } };
  const patch = (next: Partial<RegistrationResumeState>) => publish({ ...state, ...next });
  async function inspect(proof: Readonly<{ token: string }>) {
    const expectedFrame = ++frame; if (token !== proof.token) proofCompleted = false; token = proof.token; patch({ frame, phase: "inspecting", details: undefined, hasProof: true, issue: undefined });
    try { const raw = await transport.post("/auth/registration/resume/inspect", proof); if (!live(expectedFrame)) return; const details = decodeDetails(raw,target); if (!live(expectedFrame)) return; if (proofCompleted && details.status !== "COMPLETED") throw new ResumeFailure("contract"); if (details.status === "COMPLETED") proofCompleted = true; patch({ phase: details.status === "COMPLETED" ? "observed-completed" : "ready", details, issue: undefined }); }
    catch (error) { if (live(expectedFrame)) patch({ phase: "read-error", details: undefined, issue: issue(error) }); }
  }
  function begin(proofOnly: boolean) { if (!live() || pending()) return; frame++; token = undefined; target = undefined; proofCompleted = false; publish({ ...initial(), raw: proofOnly ? initial().raw : state.raw, requestUncertain: state.requestUncertain, completeUncertain: state.completeUncertain }); }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    prefill(value: Readonly<{ email: string; bin: string }>) { const expectedFrame = frame; if (!live(expectedFrame) || state.phase !== "entry" || state.raw.email || state.raw.bin) return; try { const checked = registrationResumeRequestSchema.safeParse({ email: value.email.trim(), bin: value.bin.trim(), capability: "BUYER" }); if (live(expectedFrame) && checked.success) patch({ raw: Object.freeze({ email: checked.data.email, bin: checked.data.bin }) }); } catch { /* Draft hints do not authorize or replace a proof. */ } },
    change(field: "email" | "bin", value: string, expectedFrame = frame) { if (!live(expectedFrame) || state.phase !== "entry" || !["email","bin"].includes(field) || typeof value !== "string" || value.length > 4096) return; patch({ raw: Object.freeze({ ...state.raw, [field]: value }), issue: undefined }); },
    async request() {
      if (!live() || !["entry","request-error"].includes(state.phase)) return;
      const checked = registrationResumeRequestSchema.safeParse({ email: state.raw.email.trim(), bin: state.raw.bin.trim(), capability: "BUYER" }); if (!checked.success) { patch({ phase: "entry", issue: "input" }); return; }
      const expectedFrame = frame; target = Object.freeze({ ...checked.data, capability: "BUYER" }); token = undefined; patch({ phase: "requesting", details: undefined, hasProof: undefined, issue: undefined });
      try { const raw = await transport.post("/auth/registration/resume/request", target); if (!live(expectedFrame)) return; if (!registrationResumeRequestedSchema.safeParse(raw).success) throw new ResumeFailure("contract"); patch({ phase: "requested", issue: undefined }); }
      catch (error) { if (!live(expectedFrame)) return; const problem = issue(error), known = ["input","throttled","unavailable"].includes(problem); patch({ phase: known ? "request-error" : "request-unknown", issue: problem, requestUncertain: known ? state.requestUncertain : true }); }
    },
    async inspect(input: Readonly<{ token: string }>) {
      const expectedFrame = frame; if (!live(expectedFrame) || pending()) return;
      let proof: Readonly<{ token: string }>;
      try { proof = parseResumeProof(input); } catch { if (live(expectedFrame)) { token = undefined; frame++; patch({ frame, phase: "read-error", details: undefined, hasProof: undefined, issue: "input" }); } return; }
      if (!live(expectedFrame)) return; await inspect(proof);
    },
    inspectCurrent() { if (!live() || pending() || !token) return Promise.resolve(); return inspect(Object.freeze({ token })); },
    async complete(expected: ResumeDetails, input: Readonly<{ password: string }>) {
      if (!live() || state.phase !== "ready" || state.details !== expected || !token || !input || typeof input !== "object" || consumed.has(input)) return;
      const expectedFrame = frame, checked = registrationResumeCompleteSchema.pick({ password: true }).strict().safeParse(input);
      if (!live(expectedFrame) || state.details !== expected) return;
      if (!checked.success) { patch({ issue: "input" }); return; }
      const body = Object.freeze(registrationResumeCompleteSchema.parse({ token, email: expected.email, bin: expected.bin, capability: expected.capability, password: checked.data.password }));
      consumed.add(input); patch({ phase: "completing", details: undefined, issue: undefined });
      try { const raw = await transport.post("/auth/registration/resume/complete", body); if (!live(expectedFrame)) return; if (!registrationResumeCompletedSchema.safeParse(raw).success) throw new ResumeFailure("contract"); token = undefined; patch({ phase: "completed", details: undefined, hasProof: undefined, issue: undefined }); }
      catch (error) { if (!live(expectedFrame)) return; const problem = issue(error), known = ["input","invalid","conflict","throttled"].includes(problem); patch({ phase: known ? "complete-rejected" : "complete-unknown", details: undefined, issue: problem, completeUncertain: known ? state.completeUncertain : true }); }
    },
    newProof: () => begin(true),
    newRequest: () => begin(false),
    reset() { if (closed) return; frame++; token = undefined; target = undefined; proofCompleted = false; publish(initial()); },
    close() { frame++; closed = true; token = undefined; target = undefined; proofCompleted = false; state = initial(); listeners.clear(); },
  });
}
export type RegistrationResume = ReturnType<typeof createRegistrationResume>;
