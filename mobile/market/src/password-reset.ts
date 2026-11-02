import { z } from "zod";
import { emailResetPasswordSchema } from "../../../packages/schemas/src/commercial";
import { authPasswordResetResultSchema } from "../../../packages/schemas/src/auth-api";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { MarketHttpError } from "./market-transport";
export type PasswordResetInput = Readonly<{ token: string; password: string }>;
export type PasswordResetIssue = "input" | "expired" | "throttled" | "network" | "contract";
export type PasswordResetFeedback = Readonly<{ phase: "completed" | "rejected" | "unknown"; issue?: PasswordResetIssue }>;
class PasswordResetFailure extends Error { constructor(readonly issue: "input" | "contract") { super("Password reset could not be verified"); this.name = "PasswordResetFailure"; } }
const textInput = z.object({ token: z.string().max(4096), password: emailResetPasswordSchema.shape.password }).strict();
/** A pasted link is text carrying an opaque token, never navigation or origin/identity authority. */
export function parsePasswordResetToken(raw: string): string {
  try {
    if (typeof raw !== "string" || raw.length > 4096) throw Error("input"); let token = raw.trim();
    if (token.includes("://")) {
      const link = new URL(token);
      if (!["https:", "http:"].includes(link.protocol) || link.username || link.password || link.hash || !/(^|\/)reset-password$/.test(link.pathname) || link.searchParams.size !== 1 || link.searchParams.getAll("token").length !== 1) throw Error("input");
      token = link.searchParams.get("token") ?? "";
    }
    return emailResetPasswordSchema.shape.token.parse(token);
  } catch { throw new PasswordResetFailure("input"); }
}
export function parsePasswordResetInput(raw: unknown): PasswordResetInput {
  try { const input = textInput.parse(raw); return Object.freeze(emailResetPasswordSchema.strict().parse({ token: parsePasswordResetToken(input.token), password: input.password })); }
  catch { throw new PasswordResetFailure("input"); }
}
export function passwordResetAccepted(raw: unknown): PasswordResetFeedback {
  try { if (!authPasswordResetResultSchema.safeParse(raw).success) throw Error("contract"); return Object.freeze({ phase: "completed" }); }
  catch { throw new PasswordResetFailure("contract"); }
}
export function passwordResetRejected(error: unknown): PasswordResetFeedback {
  if (error instanceof PasswordResetFailure) return Object.freeze({ phase: error.issue === "input" ? "rejected" : "unknown", issue: error.issue });
  try {
    if (error instanceof MarketHttpError) {
      const envelope = errorResponseSchema.safeParse(error.payload);
      if (!envelope.success || envelope.data.statusCode !== error.status) return Object.freeze({ phase: "unknown", issue: "contract" });
      const issue = error.status === 400 ? "input" : error.status === 401 ? "expired" : error.status === 429 ? "throttled" : undefined;
      if (issue) return Object.freeze({ phase: "rejected", issue });
    }
  } catch { return Object.freeze({ phase: "unknown", issue: "contract" }); }
  return Object.freeze({ phase: "unknown", issue: "network" });
}
