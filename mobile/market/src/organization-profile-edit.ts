import { organizationProfileFieldsSchema, supplierOrganizationProfileFieldsSchema, type OrganizationProfileResponse, type OrganizationProfileFields } from "../../../packages/schemas/src/organization-profile";
import { NativeOrganizationProfileError, type NativeOrganizationProfilePort, type ProfileSave } from "./native-organization-profile";
import type { ReadScope } from "./read-controller";
import type { PublicCity } from "./public-cities-fixture-read";
export type ProfileContactDraft = Readonly<{ contactName: string; phone: string; email: string }>;
export type ProfileAddressDraft = Readonly<{ cityId: string; line1: string; postalCode: string }>;
export type OrganizationProfileDraft = ProfileContactDraft & Readonly<{ additionalContacts: readonly ProfileContactDraft[]; legalAddress: ProfileAddressDraft; deliveryAddress: ProfileAddressDraft }>;
export type ProfileIssue = "input" | "cities" | "denied" | "conflict" | "throttled" | "network" | "contract" | "key";
export type OrganizationProfileState = Readonly<{ phase: "idle" | "reading" | "ready" | "editing" | "review" | "saving" | "saved" | "rejected" | "unknown" | "observed" | "error"; profile?: OrganizationProfileResponse; draft?: OrganizationProfileDraft; preview?: Readonly<OrganizationProfileFields>; cities: readonly PublicCity[]; citiesPending: boolean; issue?: ProfileIssue; history: readonly number[] }>;
const blankContact = (): ProfileContactDraft => ({ contactName: "", phone: "", email: "" });
function draftOf(profile: OrganizationProfileResponse): OrganizationProfileDraft {
  const p = profile.profile, blankAddress = () => ({ cityId: "", line1: "", postalCode: "" });
  const reserves = (p?.additionalContacts ?? []).map(value => ({ ...value }));
  while (reserves.length < (profile.requiredReserveContacts ?? 0)) reserves.push(blankContact());
  return { ...(p ? { contactName: p.contactName, phone: p.phone, email: p.email } : blankContact()), additionalContacts: reserves, legalAddress: p ? { ...p.legalAddress, postalCode: p.legalAddress.postalCode ?? "" } : blankAddress(), deliveryAddress: p ? { ...p.deliveryAddress, postalCode: p.deliveryAddress.postalCode ?? "" } : blankAddress() };
}
function classify(error: unknown): ProfileIssue {
  if (error instanceof NativeOrganizationProfileError) return error.code === "key" ? "key" : error.code === "input" ? "input" : "contract";
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return status === 400 ? "input" : status === 403 ? "denied" : status === 409 ? "conflict" : status === 429 ? "throttled" : "network";
}
/** Same-scope in-memory form. Only explicit confirmation issues a key; unknown retries keep the complete original request. */
export function createOrganizationProfileEdit(scope: ReadScope, port?: NativeOrganizationProfilePort) {
  let closed = false, ticket = 0, cityTicket = 0, attempt: ProfileSave | undefined, wasUnknown = false, denied = false;
  let rejectedDraft: Readonly<{ version: number; draft: OrganizationProfileDraft }> | undefined;
  let state: OrganizationProfileState = { phase: "idle", cities: [], citiesPending: false, history: [] };
  const listeners = new Set<() => void>(), current = () => !closed && port?.available(scope) === true;
  const publish = (patch: Partial<OrganizationProfileState>) => {
    for (const value of [patch.draft, patch.preview]) if (value) { Object.freeze(value.legalAddress); Object.freeze(value.deliveryAddress); value.additionalContacts?.forEach(Object.freeze); if (value.additionalContacts) Object.freeze(value.additionalContacts); Object.freeze(value); }
    state = Object.freeze({ ...state, ...patch }); listeners.forEach(listener => listener()); };
  const busy = () => state.phase === "reading" || state.phase === "saving";
  const validVersion = (value: OrganizationProfileResponse) => { if (value.organizationId !== scope.organizationId || state.profile && value.version < state.profile.version) throw new NativeOrganizationProfileError("contract"); };
  const canEdit = () => current() && !denied && state.profile?.canEdit === true && state.phase === "ready" && port?.canIssueKey(scope) === true;
  const loadCities = async () => {
    if (!current() || state.citiesPending || !["editing", "ready", "observed", "saved"].includes(state.phase)) return;
    const mine = ++cityTicket; publish({ citiesPending: true, issue: undefined });
    try { const cities = await port!.cities(scope); if (!current() || mine !== cityTicket) return; publish({ cities, citiesPending: false }); }
    catch { if (current() && mine === cityTicket) publish({ cities: [], citiesPending: false, issue: "cities" }); }
  };
  const send = async () => {
    if (!current() || !attempt || busy() || denied) return;
    const mine = ++ticket; publish({ phase: "saving", issue: undefined });
    try { const profile = await port!.save(scope, attempt); if (!current() || mine !== ticket) return; validVersion(profile); wasUnknown = false; attempt = undefined; rejectedDraft = undefined; publish({ phase: "saved", profile, draft: undefined, preview: undefined }); }
    catch (error) {
      if (!current() || mine !== ticket) return;
      const issue = classify(error), known = ["input", "conflict", "throttled"].includes(issue) && !(error instanceof NativeOrganizationProfileError);
      if (known && !wasUnknown && state.draft && attempt) rejectedDraft = Object.freeze({ version: attempt.expectedVersion, draft: state.draft });
      if (issue === "denied") denied = true;
      wasUnknown ||= !known; publish({ phase: wasUnknown ? "unknown" : "rejected", issue, draft: undefined, preview: undefined });
    }
  };
  const model = {
    available: current, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, activate() { closed = false; },
    async read() {
      if (!current() || busy() || state.phase === "editing" || state.phase === "review") return;
      const mine = ++ticket; publish({ phase: "reading", issue: undefined });
      try { const profile = await port!.read(scope); if (!current() || mine !== ticket) return; validVersion(profile); denied = !profile.canEdit; publish({ phase: wasUnknown ? "observed" : "ready", profile, draft: undefined, preview: undefined }); if (!wasUnknown) attempt = undefined; void loadCities(); }
      catch (error) { if (current() && mine === ticket) { const issue = classify(error); if (issue === "denied") denied = true; publish({ phase: wasUnknown ? "unknown" : "error", issue }); } }
    },
    canEdit,
    edit() { if (!canEdit()) return; publish({ phase: "editing", draft: rejectedDraft?.version === state.profile!.version ? rejectedDraft.draft : draftOf(state.profile!), preview: undefined, issue: undefined }); if (!state.cities.length) void loadCities(); },
    loadCities,
    changeContact(index: number, field: keyof ProfileContactDraft, value: string) {
      const draft = state.draft; if (!current() || state.phase !== "editing" || !draft || !["contactName", "phone", "email"].includes(field) || typeof value !== "string") return;
      if (index === -1) publish({ draft: { ...draft, [field]: value }, issue: undefined });
      else if (Number.isInteger(index) && index >= 0 && index < draft.additionalContacts.length) publish({ draft: { ...draft, additionalContacts: draft.additionalContacts.map((contact, i) => i === index ? { ...contact, [field]: value } : contact) }, issue: undefined });
    },
    addContact() { const draft = state.draft; if (!current() || state.phase !== "editing" || !draft || draft.additionalContacts.length >= (state.profile?.requiredReserveContacts === 2 ? 2 : 9)) return; publish({ draft: { ...draft, additionalContacts: [...draft.additionalContacts, blankContact()] } }); },
    removeContact(index: number) { const draft = state.draft; if (!current() || state.phase !== "editing" || !draft || !Number.isInteger(index) || index < 0 || index >= draft.additionalContacts.length || state.profile?.requiredReserveContacts === 2) return; publish({ draft: { ...draft, additionalContacts: draft.additionalContacts.filter((_, i) => i !== index) } }); },
    changeAddress(kind: "legalAddress" | "deliveryAddress", field: "line1" | "postalCode", value: string) { const draft = state.draft; if (!current() || state.phase !== "editing" || !draft || !["legalAddress", "deliveryAddress"].includes(kind) || !["line1", "postalCode"].includes(field)) return; publish({ draft: { ...draft, [kind]: { ...draft[kind], [field]: value } }, issue: undefined }); },
    chooseCity(kind: "legalAddress" | "deliveryAddress", city: PublicCity) { const draft = state.draft; if (!current() || state.phase !== "editing" || !draft || !["legalAddress", "deliveryAddress"].includes(kind) || !state.cities.includes(city)) return; publish({ draft: { ...draft, [kind]: { ...draft[kind], cityId: city.id } }, issue: undefined }); },
    review() {
      if (!current() || state.phase !== "editing" || !state.draft || state.citiesPending || !state.profile?.canEdit) return;
      const draft = state.draft, contact = (value: ProfileContactDraft) => ({ contactName: value.contactName, phone: value.phone, email: value.email.trim() }), address = (value: ProfileAddressDraft) => ({ ...value, postalCode: value.postalCode.trim() || null });
      if (![draft.legalAddress, draft.deliveryAddress].every(value => state.cities.some(city => city.id === value.cityId))) { publish({ issue: "cities" }); return; }
      const schema = state.profile.requiredReserveContacts === 2 ? supplierOrganizationProfileFieldsSchema : organizationProfileFieldsSchema;
      const checked = schema.safeParse({ ...contact(draft), additionalContacts: draft.additionalContacts.map(contact), legalAddress: address(draft.legalAddress), deliveryAddress: address(draft.deliveryAddress) });
      if (!checked.success) { publish({ issue: "input" }); return; }
      publish({ phase: "review", preview: checked.data, issue: undefined });
    },
    backToEdit() { if (current() && state.phase === "review" && !attempt) publish({ phase: "editing", preview: undefined }); },
    cancel() { if (!current() || !["editing", "review"].includes(state.phase) || attempt) return; ++cityTicket; rejectedDraft = undefined; publish({ phase: "ready", draft: undefined, preview: undefined, citiesPending: false, issue: undefined }); },
    async confirm() {
      if (!current() || state.phase !== "review" || !state.preview || !state.profile?.canEdit || !port!.canIssueKey(scope) || attempt) return;
      try { const idempotencyKey = port!.nextKey(scope); if (!current()) return; attempt = Object.freeze({ ...state.preview, expectedVersion: state.profile.version, idempotencyKey }); }
      catch { if (current()) publish({ issue: "key" }); return; }
      await send();
    },
    canRetry: () => current() && !denied && !!attempt && wasUnknown && ["unknown", "observed"].includes(state.phase),
    async retry() { if (model.canRetry()) await send(); },
    acceptObserved() { if (!current() || state.phase !== "observed" || !wasUnknown || !attempt) return; const version = attempt.expectedVersion; attempt = undefined; wasUnknown = false; publish({ phase: "ready", history: Object.freeze([...state.history, version]), issue: undefined }); },
    close() { closed = true; ++ticket; ++cityTicket; attempt = undefined; wasUnknown = false; denied = false; rejectedDraft = undefined; state = { phase: "idle", cities: [], citiesPending: false, history: [] }; listeners.forEach(listener => listener()); listeners.clear(); },
  };
  return model;
}
export type OrganizationProfileEdit = ReturnType<typeof createOrganizationProfileEdit>;
