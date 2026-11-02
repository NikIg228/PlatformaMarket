import { z } from "zod";
import { emailRegisterSchema, emailForgotPasswordSchema } from "../../../packages/schemas/src/commercial";
import { authRegistrationAcceptedSchema, authForgotAcceptedSchema } from "../../../packages/schemas/src/local-auth";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { MarketHttpError } from "./market-transport";
export const emailRegistrationInputSchema = emailRegisterSchema.pick({ email: true, displayName: true, password: true }).strict();
export const emailForgotInputSchema = emailForgotPasswordSchema.strict();
export type EmailRegistrationInput = Readonly<z.input<typeof emailRegistrationInputSchema>>;
export type EmailEntryKind = "register" | "forgot";
export type EmailEntryIssue = "input" | "conflict" | "denied" | "throttled" | "unavailable" | "network" | "contract";
export type EmailEntryFeedback = Readonly<{ kind: EmailEntryKind; phase: "accepted" | "rejected" | "unknown"; email?: string; delivery?: "LOCAL_FILE" | "PROVIDER"; issue?: EmailEntryIssue }>;
class EmailEntryFailure extends Error { constructor(readonly issue: "input" | "contract") { super("Email entry request could not be verified"); this.name = "EmailEntryFailure"; } }
export function parseEmailEntryInput(kind: EmailEntryKind, raw: unknown) {
  try { if (!raw || typeof raw !== "object" || !("email" in raw) || typeof raw.email !== "string") throw Error("input"); const value = { ...raw, email: raw.email.trim() }; const checked = (kind === "register" ? emailRegistrationInputSchema : emailForgotInputSchema).safeParse(value); if (!checked.success) throw Error("input"); return checked.data; } catch { throw new EmailEntryFailure("input"); }
}
/** Source acknowledgement only: neither an authenticated session nor delivery/account-existence proof. */
export function emailEntryAccepted(kind: EmailEntryKind, email: string, raw: unknown): EmailEntryFeedback {
  try { const parsed = (kind === "register" ? authRegistrationAcceptedSchema : authForgotAcceptedSchema).safeParse(raw); if (!parsed.success || "email" in parsed.data && parsed.data.email !== email) throw Error("contract"); return Object.freeze({ kind, phase: "accepted", email, delivery: parsed.data.delivery }); } catch { throw new EmailEntryFailure("contract"); }
}
export function emailEntryRejected(kind: EmailEntryKind, email: string | undefined, error: unknown): EmailEntryFeedback {
  if (error instanceof EmailEntryFailure) return Object.freeze({ kind, phase: error.issue === "input" ? "rejected" : "unknown", email, issue: error.issue });
  try { if (error instanceof MarketHttpError) { const envelope = errorResponseSchema.safeParse(error.payload); if (!envelope.success || envelope.data.statusCode !== error.status) return Object.freeze({ kind, phase: "unknown", email, issue: "contract" }); const issue: EmailEntryIssue | undefined = error.status === 400 ? "input" : error.status === 409 ? "conflict" : error.status === 401 || error.status === 403 ? "denied" : error.status === 429 ? "throttled" : error.status === 503 ? "unavailable" : undefined; if (issue) return Object.freeze({ kind, phase: "rejected", email, issue }); } } catch { /* Untrusted envelope does not prove a rejected request. */ }
  return Object.freeze({ kind, phase: "unknown", email, issue: "network" });
}
