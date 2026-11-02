import { z } from "zod";
import { emailTokenSchema } from "../../../packages/schemas/src/commercial";
import { authEmailVerifiedSchema, type AuthEmailVerified } from "../../../packages/schemas/src/auth-api";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { MarketHttpError } from "./market-transport";
export type EmailVerificationInput = Readonly<{ token: string }>;
export type EmailVerificationIssue = "input" | "throttled" | "unconfirmed" | "contract";
export type EmailVerificationFeedback = Readonly<{ phase: "verified" | "rejected" | "unknown"; issue?: EmailVerificationIssue }>;
class EmailVerificationFailure extends Error { constructor(readonly issue: "input" | "contract") { super("Email verification could not be confirmed"); this.name = "EmailVerificationFailure"; } }
const textInput = z.object({ token: z.string().max(4096) }).strict();
/** Existing mail link is opaque input, never a trusted navigation/callback or workspace selector. */
export function parseEmailVerificationInput(raw: unknown): EmailVerificationInput {
  try {
    const input = textInput.parse(raw); let token = input.token.trim();
    if (token.includes("://")) {
      const link = new URL(token);
      if (!["http:", "https:"].includes(link.protocol) || link.username || link.password || link.hash || !/(^|\/)verify-email$/.test(link.pathname) || link.searchParams.getAll("token").length !== 1) throw Error("input");
      for (const key of link.searchParams.keys()) if (!["token", "returnTo"].includes(key) || link.searchParams.getAll(key).length !== 1) throw Error("input");
      // The optional source web return hint is not forwarded or acted upon.
      token = link.searchParams.get("token") ?? "";
    }
    return Object.freeze(emailTokenSchema.strict().parse({ token }));
  } catch { throw new EmailVerificationFailure("input"); }
}
export function decodeEmailVerification(raw: unknown): AuthEmailVerified {
  try {
    if (raw && typeof raw === "object" && "refreshToken" in raw) throw Error("contract");
    const value = authEmailVerifiedSchema.parse(raw);
    if (new Set(value.organizationIds).size !== value.organizationIds.length || value.activeOrganizationId !== null && !value.organizationIds.includes(value.activeOrganizationId) || value.actorId !== undefined && value.actorId !== value.user.id || value.registration && value.registration.email !== value.user.email) throw Error("contract");
    return value;
  } catch { throw new EmailVerificationFailure("contract"); }
}
export function emailVerificationRejected(error: unknown): EmailVerificationFeedback {
  if (error instanceof EmailVerificationFailure) return Object.freeze({ phase: error.issue === "input" ? "rejected" : "unknown", issue: error.issue });
  try {
    if (error instanceof MarketHttpError) {
      const envelope = errorResponseSchema.safeParse(error.payload);
      if (!envelope.success || envelope.data.statusCode !== error.status) return Object.freeze({ phase: "unknown", issue: "contract" });
      if (error.status === 429) return Object.freeze({ phase: "rejected", issue: "throttled" });
    }
  } catch { return Object.freeze({ phase: "unknown", issue: "contract" }); }
  // The email-token transaction can commit before registration claim/session issuance fails.
  return Object.freeze({ phase: "unknown", issue: "unconfirmed" });
}
