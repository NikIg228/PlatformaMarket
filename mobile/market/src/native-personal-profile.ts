import { decodeProfileAvatar, ProfileAvatarError, type OwnProfileAvatar } from "./profile-avatar-codec";
import { personalProfileSchema, profileAvatarSchema, updatePersonalProfileSchema, requestProfileEmailSchema, profileEmailRequestedSchema, type PersonalProfile, type UpdatePersonalProfile, type RequestProfileEmail, type ProfileEmailRequested } from "../../../packages/schemas/src/personal-profile";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type OwnPersonalProfile = Readonly<PersonalProfile>;
export type PersonalProfileUpdate = Readonly<UpdatePersonalProfile>;
export type PersonalProfileEmailInput = Readonly<RequestProfileEmail>;
export type PersonalProfileEmailReceipt = Readonly<ProfileEmailRequested>;
export type NativePersonalProfilePort = Readonly<{ available(scope: ReadScope): boolean; read(scope: ReadScope): Promise<OwnPersonalProfile>; save(scope: ReadScope, input: PersonalProfileUpdate): Promise<OwnPersonalProfile>; requestEmail?(scope: ReadScope, input: PersonalProfileEmailInput): Promise<PersonalProfileEmailReceipt>; canReadAvatar?(scope: ReadScope, profile: OwnPersonalProfile): boolean; avatar?(scope: ReadScope, profile: OwnPersonalProfile): Promise<OwnProfileAvatar> }>;
export type NativePersonalProfileClient = { nativePersonalProfile?: NativePersonalProfilePort };
export class NativePersonalProfileError extends Error { constructor(readonly code: "scope" | "input" | "contract") { super("Personal profile request is unavailable"); this.name = "NativePersonalProfileError"; } }
/** Own active actor/session profile. A keyless CAS write is never replayed automatically. */
export function bindNativePersonalProfile(scope: ReadScope, read: (path: string) => Promise<unknown>, postOnce: (path: string, body: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean, onProfile: (profile: OwnPersonalProfile) => void) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativePersonalProfileError("scope")); let used = new WeakSet<object>(), latestVersion = 0; let latestProfile: OwnPersonalProfile | undefined;
  const observe = (candidate: ReadScope, raw: unknown, minimumVersion: number) => {
    try {
      lifetime.assert(candidate); const identity = personalProfileSchema.pick({ id: true }).strip().parse(raw);
      if (identity.id !== lifetime.owner.userId) throw Error("owner"); lifetime.assert(candidate);
      const value = personalProfileSchema.parse(raw); lifetime.assert(candidate);
      if (value.id !== lifetime.owner.userId || value.version < Math.max(latestVersion, minimumVersion)) throw Error("version");
      const profile = Object.freeze(value); latestVersion = profile.version; latestProfile = profile; onProfile(profile); lifetime.assert(candidate); return profile;
    } catch (error) { lifetime.assert(candidate); throw new NativePersonalProfileError("contract"); }
  };
  const assertAvatarFrame = (candidate: ReadScope, profile: OwnPersonalProfile) => { lifetime.assert(candidate); if (!profile || profile !== latestProfile || profile.avatarAssetId === null) throw new NativePersonalProfileError("input"); lifetime.assert(candidate); };
  const port: NativePersonalProfilePort = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async read(candidate) { lifetime.assert(candidate); let raw: unknown; try { raw = await read("/auth/profile"); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; } return observe(candidate, raw, 1); },
    canReadAvatar(candidate, profile) { try { assertAvatarFrame(candidate, profile); return true; } catch { return false; } },
    async avatar(candidate, profile) {
      assertAvatarFrame(candidate, profile); let raw: unknown;
      try { raw = await read("/auth/profile/avatar"); assertAvatarFrame(candidate, profile); } catch (error) { lifetime.assert(candidate); throw error; }
      try {
        const keys = Object.keys(raw as object); assertAvatarFrame(candidate, profile);
        if (keys.length !== 2 || keys.some(key => key !== "contentType" && key !== "contentBase64")) throw new ProfileAvatarError("contract");
        const mime = profileAvatarSchema.pick({ contentType: true }).strip().safeParse(raw); assertAvatarFrame(candidate, profile);
        if (!mime.success) throw new ProfileAvatarError("contract");
        const contentBase64 = (raw as { contentBase64: unknown }).contentBase64; assertAvatarFrame(candidate, profile);
        const value = decodeProfileAvatar({ contentType: mime.data.contentType, contentBase64 }); assertAvatarFrame(candidate, profile); return value;
      } catch (error) { assertAvatarFrame(candidate, profile); if (error instanceof ProfileAvatarError) throw error; throw new ProfileAvatarError("contract"); }
    },
    async requestEmail(candidate, input) {
      lifetime.assert(candidate); if (!input || typeof input !== "object" || used.has(input)) throw new NativePersonalProfileError("input");
      let body: PersonalProfileEmailInput;
      try { body = Object.freeze(requestProfileEmailSchema.parse(input)); if (JSON.stringify(body) !== JSON.stringify(input)) throw Error("canonical"); } catch { lifetime.assert(candidate); throw new NativePersonalProfileError("input"); }
      lifetime.assert(candidate); used.add(input); let raw: unknown;
      try { raw = await postOnce("/auth/profile/email", body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      const parsed = profileEmailRequestedSchema.safeParse(raw); if (!parsed.success || parsed.data.email !== body.email) throw new NativePersonalProfileError("contract"); lifetime.assert(candidate);
      // Receipt has no new profile version, expiry, actor UUID, token or mail-arrival proof.
      return Object.freeze(parsed.data);
    },
    async save(candidate, input) {
      lifetime.assert(candidate); if (!input || typeof input !== "object" || used.has(input)) throw new NativePersonalProfileError("input");
      let body: PersonalProfileUpdate; try { body = Object.freeze(updatePersonalProfileSchema.parse(input)); if (JSON.stringify(body) !== JSON.stringify(input)) throw Error("canonical"); } catch { lifetime.assert(candidate); throw new NativePersonalProfileError("input"); }
      lifetime.assert(candidate); used.add(input); let raw: unknown;
      try { raw = await postOnce("/auth/profile", body); lifetime.assert(candidate); } catch (error) { lifetime.assert(candidate); throw error; }
      return observe(candidate, raw, body.expectedVersion + 1);
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); used = new WeakSet(); latestVersion = 0; latestProfile = undefined; } });
}
