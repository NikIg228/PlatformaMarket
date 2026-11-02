import { z } from "zod";
import { mfaStatusSchema, mfaEnrollmentSchema, mfaVerificationResultSchema, mfaDisabledSchema, mfaVerifiedFactorSchema, mfaElevatedSessionSchema, mfaChallengeResultSchema, mfaChallengeFactorSchema } from "../../../packages/schemas/src/auth-api";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type MfaStatus = Readonly<z.output<typeof mfaStatusSchema>>;
export type MfaEnrollment = Readonly<Omit<z.output<typeof mfaEnrollmentSchema>, "recoveryCodes"> & { recoveryCodes: readonly string[] }>;
export type MfaChallenged = Readonly<z.output<typeof mfaChallengeFactorSchema>>;
export type MfaVerified = Readonly<z.output<typeof mfaVerifiedFactorSchema>>;
export type MfaElevation = Readonly<Omit<z.output<typeof mfaElevatedSessionSchema>, "authenticationMethods"> & { authenticationMethods: readonly string[] }>;
export type MfaCode = Readonly<{ code: string }>;
// Closed source codec: packages/schemas/src/index.ts mfaCodeSchema; avoid the large browser/API barrel.
export const mfaCodeInputSchema = z.object({ code: z.string().trim().regex(/^(?:\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/i) }).strict();
export type NativeMfaPort = Readonly<{ available(scope: ReadScope): boolean; status(scope: ReadScope): Promise<MfaStatus>; enroll(scope: ReadScope): Promise<MfaEnrollment>; verify(scope: ReadScope, input: MfaCode): Promise<MfaVerified>; challenge(scope: ReadScope, input: MfaCode): Promise<MfaChallenged>; disable(scope: ReadScope, input: MfaCode): Promise<Readonly<{ enabled: false }>> }>;
export type NativeMfaClient = { nativeMfa?: NativeMfaPort };
export class NativeMfaError extends Error { constructor(readonly code: "scope" | "input" | "contract") { super("Account MFA request is unavailable"); this.name = "NativeMfaError"; } }
export function decodeMfaEnrollment(raw: unknown, email: string): MfaEnrollment {
  try {
    const root = mfaEnrollmentSchema.pick({ factorId: true }).strip().parse(raw), value = mfaEnrollmentSchema.parse(raw);
    if (value.factorId !== root.factorId || !/^[A-Z2-7]{32}$/.test(value.secret) || value.recoveryCodes.length !== 10 || new Set(value.recoveryCodes).size !== 10 || value.recoveryCodes.some(code => !/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code))) throw Error("contract");
    const uri = new URL(value.otpauthUri), issuer = uri.searchParams.get("issuer"), required = ["secret", "issuer", "algorithm", "digits", "period"];
    if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || uri.username || uri.password || uri.port || uri.hash || uri.searchParams.size !== required.length || required.some(key => uri.searchParams.getAll(key).length !== 1) || issuer === null || decodeURIComponent(uri.pathname.slice(1)) !== `${issuer}:${email}` || uri.searchParams.get("secret") !== value.secret || uri.searchParams.get("algorithm") !== "SHA1" || uri.searchParams.get("digits") !== "6" || uri.searchParams.get("period") !== "30") throw Error("contract");
    return Object.freeze({ ...value, recoveryCodes: Object.freeze([...value.recoveryCodes]) });
  } catch { throw new NativeMfaError("contract"); }
}
/** Own-account source RPC only. No permission receipt, local TOTP generation, keyless replay or external URI handler. */
export function bindNativeMfa(scope: ReadScope, read: (path: string) => Promise<unknown>, postOnce: (path: string, body?: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean, options: Readonly<{ email: string; applyElevation: (value: MfaElevation) => void; onDisabled: () => void }>) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeMfaError("scope")), consumed = new WeakSet<object>(), challenges = new Set<string>();
  const code = (input: MfaCode, verifying: boolean) => { try { const checked = mfaCodeInputSchema.safeParse(input); if (!checked.success || checked.data.code !== input.code || verifying && !/^\d{6}$/.test(checked.data.code) || consumed.has(input)) throw Error("input"); consumed.add(input); return Object.freeze(checked.data); } catch { throw new NativeMfaError("input"); } };
  const get = async (candidate: ReadScope, action: "status" | "enroll") => { lifetime.assert(candidate); try { const raw = await (action === "status" ? read("/identity/mfa") : postOnce("/identity/mfa/totp/enroll")); lifetime.assert(candidate); return raw; } catch (error) { lifetime.assert(candidate); throw error; } };
  const port: NativeMfaPort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async status(candidate) { const raw = await get(candidate, "status"), parsed = mfaStatusSchema.safeParse(raw); if (!parsed.success || parsed.data.enabled !== (parsed.data.status === "ACTIVE")) throw new NativeMfaError("contract"); lifetime.assert(candidate); return Object.freeze(parsed.data); },
    async enroll(candidate) { const raw = await get(candidate, "enroll"); const value = decodeMfaEnrollment(raw, options.email); lifetime.assert(candidate); return value; },
    async verify(candidate, input) { lifetime.assert(candidate); const body = code(input, true); lifetime.assert(candidate); let raw: unknown; try { raw = await postOnce("/identity/mfa/totp/verify", body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      const parsed = mfaVerificationResultSchema.safeParse(raw); if (!parsed.success) throw new NativeMfaError("contract"); lifetime.assert(candidate);
      if ("accessToken" in parsed.data) { if (parsed.data.activeOrganizationId !== lifetime.owner.organizationId || !parsed.data.authenticationMethods.includes("totp")) throw new NativeMfaError("contract"); options.applyElevation(Object.freeze({ accessToken: parsed.data.accessToken, accessTokenExpiresIn: parsed.data.accessTokenExpiresIn, activeOrganizationId: parsed.data.activeOrganizationId, authenticationMethods: Object.freeze([...parsed.data.authenticationMethods]) })); lifetime.assert(candidate); return Object.freeze({ ...parsed.data.factor }); }
      return Object.freeze({ ...parsed.data });
    },
    async challenge(candidate, input) { lifetime.assert(candidate); const body = code(input, false); lifetime.assert(candidate); let raw: unknown; try { raw = await postOnce("/identity/mfa/challenge", body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      const parsed = mfaChallengeResultSchema.safeParse(raw); if (!parsed.success) throw new NativeMfaError("contract"); lifetime.assert(candidate);
      const factor = "accessToken" in parsed.data ? parsed.data.factor : parsed.data, expectedMethod = /^\d{6}$/.test(body.code) ? "TOTP" : "RECOVERY_CODE";
      if (factor.method !== expectedMethod || challenges.has(factor.challengeId)) throw new NativeMfaError("contract");
      if ("accessToken" in parsed.data) { if (parsed.data.activeOrganizationId !== lifetime.owner.organizationId || !parsed.data.authenticationMethods.includes("totp")) throw new NativeMfaError("contract"); challenges.add(factor.challengeId); options.applyElevation(Object.freeze({ accessToken: parsed.data.accessToken, accessTokenExpiresIn: parsed.data.accessTokenExpiresIn, activeOrganizationId: parsed.data.activeOrganizationId, authenticationMethods: Object.freeze([...parsed.data.authenticationMethods]) })); lifetime.assert(candidate); }
      else challenges.add(factor.challengeId);
      return Object.freeze({ ...factor });
    },
    async disable(candidate, input) { lifetime.assert(candidate); const body = code(input, false); lifetime.assert(candidate); let raw: unknown; try { raw = await postOnce("/identity/mfa/disable", body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; } const parsed = mfaDisabledSchema.safeParse(raw); if (!parsed.success) throw new NativeMfaError("contract"); lifetime.assert(candidate); const receipt = Object.freeze(parsed.data);
      // This validated source command deliberately revokes every session, including this captured scope.
      options.onDisabled(); return receipt;
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); challenges.clear(); } });
}
