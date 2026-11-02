import { decodeProfileAvatar, ProfileAvatarError } from "./profile-avatar-codec";
import { NativePersonalProfileError, type NativePersonalProfilePort, type OwnPersonalProfile } from "./native-personal-profile";
import type { ReadScope } from "./read-controller";
export type PersonalAvatarIssue = "authentication" | "denied" | "missing" | "throttled" | "network" | "contract" | "size" | "decode";
export type PersonalAvatarState = Readonly<{ phase: "idle" | "loading" | "ready" | "error"; profile?: OwnPersonalProfile; uri?: string; issue?: PersonalAvatarIssue }>;
const empty: PersonalAvatarState = Object.freeze({ phase: "idle" });
/** One scoped own-account preview in memory. Reply has no asset/version echo; never present a selected asset-ID receipt. */
export function createPersonalProfileAvatar(scope: ReadScope, port: NativePersonalProfilePort, sourceProfile: () => OwnPersonalProfile | undefined) {
  let active = true, ticket = 0, pending: object | null = null, observed: OwnPersonalProfile | undefined, state = empty; const listeners = new Set<() => void>();
  const supported = () => active && port.available(scope) && typeof port.canReadAvatar === "function" && typeof port.avatar === "function";
  const frame = () => { if (!supported()) return undefined; const value = sourceProfile(); return value?.id === scope.userId ? value : undefined; };
  const canLoad = () => { const value = frame(); return !!value && value.avatarAssetId !== null && port.canReadAvatar!(scope, value); };
  const publish = (value: PersonalAvatarState) => { state = Object.freeze(value); listeners.forEach(listener => listener()); };
  const sync = () => { const current = frame(); if (current !== observed) { observed = current; ++ticket; pending = null; publish({ phase: "idle" }); } };
  const model = {
    supported, frame, canLoad, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    sync, activate() { active = true; sync(); },
    async load() {
      sync(); const profile = frame(); if (!profile || !canLoad() || pending) return;
      const request = {}, mine = ++ticket; pending = request; publish({ phase: "loading", profile });
      try {
        const raw = await port.avatar!(scope, profile); if (!active || mine !== ticket || pending !== request || frame() !== profile || !canLoad()) return;
        const value = decodeProfileAvatar(raw), uri = `data:${value.contentType};base64,${value.contentBase64}`;
        if (!active || mine !== ticket || pending !== request || frame() !== profile || !canLoad()) return;
        pending = null; publish({ phase: "ready", profile, uri });
      } catch (error) {
        if (!active || mine !== ticket || pending !== request || frame() !== profile || !canLoad()) return; pending = null;
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        const issue: PersonalAvatarIssue = error instanceof ProfileAvatarError ? error.code : error instanceof NativePersonalProfileError ? "contract" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "missing" : status === 429 ? "throttled" : "network";
        publish({ phase: "error", profile, issue });
      }
    },
    hide() { ++ticket; pending = null; publish({ phase: "idle" }); },
    renderFailed(snapshot: PersonalAvatarState) { if (active && state === snapshot && state.phase === "ready" && state.profile === frame() && canLoad()) publish({ phase: "error", profile: state.profile, issue: "decode" }); },
    close() { active = false; ++ticket; pending = null; observed = undefined; state = Object.freeze({ phase: "idle" }); listeners.forEach(listener => listener()); listeners.clear(); },
  }; return model;
}
export type PersonalProfileAvatar = ReturnType<typeof createPersonalProfileAvatar>;
