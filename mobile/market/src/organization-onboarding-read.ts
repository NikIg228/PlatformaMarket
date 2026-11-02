import { NativeOrganizationProfileError, type NativeOrganizationProfilePort } from "./native-organization-profile";
import type { OrganizationOnboarding } from "../../../packages/schemas/src/organization-profile";
import type { ReadScope } from "./read-controller";
export type OrganizationOnboardingIssue = "denied" | "authentication" | "missing" | "throttled" | "network" | "contract";
export type OrganizationOnboardingState = Readonly<{ phase: "idle" | "loading" | "ready" | "error"; value?: OrganizationOnboarding; issue?: OrganizationOnboardingIssue }>;
/** Read-only own-company evidence. It cannot resolve a profile save or authorize an action. */
export function createOrganizationOnboardingRead(scope: ReadScope, port: NativeOrganizationProfilePort | undefined, currentProfileVersion: () => number | undefined) {
  let active = true, ticket = 0, latestVersion = 0, state: OrganizationOnboardingState = Object.freeze({ phase: "idle" });
  const listeners = new Set<() => void>();
  const available = () => active && typeof port?.onboarding === "function" && port.available(scope);
  const publish = (value: OrganizationOnboardingState) => { state = Object.freeze(value); listeners.forEach(listener => listener()); };
  return {
    available, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    stale() { const version = currentProfileVersion(); return !!state.value && version !== undefined && state.value.organization.version < version; },
    async read() {
      if (!available() || state.phase === "loading") return;
      const mine = ++ticket; publish({ phase: "loading" });
      try {
        const value = await port!.onboarding!(scope);
        if (!available() || mine !== ticket) return;
        if (value.organization.organizationId !== scope.organizationId || value.organization.version < latestVersion) throw new NativeOrganizationProfileError("contract");
        latestVersion = value.organization.version; publish({ phase: "ready", value });
      } catch (error) {
        if (!available() || mine !== ticket) return;
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        const issue = error instanceof NativeOrganizationProfileError ? "contract" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "missing" : status === 429 ? "throttled" : "network";
        publish({ phase: "error", issue });
      }
    },
    activate() { active = true; },
    close() { active = false; ++ticket; latestVersion = 0; state = Object.freeze({ phase: "idle" }); listeners.forEach(listener => listener()); listeners.clear(); },
  };
}
export type OrganizationOnboardingRead = ReturnType<typeof createOrganizationOnboardingRead>;
