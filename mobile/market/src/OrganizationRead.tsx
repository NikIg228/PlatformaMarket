import { OrganizationOnboardingUi } from "./OrganizationOnboardingUi";
import type { OrganizationOnboardingRead } from "./organization-onboarding-read";
import { useSyncExternalStore, type ReactNode } from "react";
import { OrganizationProfileUi } from "./OrganizationProfileUi";
import type { OrganizationProfileEdit } from "./organization-profile-edit";
import { ScrollView, StyleSheet } from "react-native";
import type { OrganizationProfileResponse } from "../../../packages/schemas/src/organization-profile";
import type { Locale } from "./format-wire";
import { copy } from "./i18n";
import { Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
/** Existing summary remains for read-only clients; native full details require explicit own-scoped read. */
export function OrganizationRead({ profile, locale, model, onboarding }: { profile: OrganizationProfileResponse; locale: Locale; model?: OrganizationProfileEdit; onboarding?: OrganizationOnboardingRead }) {
  if (model?.available()) return <NativeOrganizationRead model={model} profile={profile} locale={locale} onboarding={onboarding} />;
  return <OrganizationSummary profile={profile} locale={locale} />;
}
function NativeOrganizationRead({ model, profile, locale, onboarding }: { model: OrganizationProfileEdit; profile: OrganizationProfileResponse; locale: Locale; onboarding?: OrganizationOnboardingRead }) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const panels = <Stack><OrganizationProfileUi model={model} locale={locale} />{onboarding && <OrganizationOnboardingUi model={onboarding} profileModel={model} locale={locale} />}</Stack>;
  if (state.phase === "idle") return <OrganizationSummary profile={profile} locale={locale}>{panels}</OrganizationSummary>;
  return <ScrollView contentContainerStyle={styles.content}>{panels}</ScrollView>;
}
function OrganizationSummary({ profile, locale, children }: { profile: OrganizationProfileResponse; locale: Locale; children?: ReactNode }) {
  const t = copy[locale];
  return <ScrollView contentContainerStyle={styles.content}>
    <Notice title={t.organizationSummary} body={children ? undefined : t.organizationReadOnly} />
    <Surface><Text>{t.organizationName}: {profile.displayName.trim() ? profile.displayName : t.partyUnknown}</Text><Text>{t.legalName}: {profile.legalName.trim() ? profile.legalName : t.partyUnknown}</Text><Text>{t.snapshotVersion}: {profile.version}</Text></Surface>
    <Surface><Text>{t.profileState}: {profile.complete ? t.profileComplete : t.profileIncomplete}</Text><Text>{t.profileData}: {profile.profile === null ? t.profileDataUnknown : t.profileDataPresent}</Text>
      <Text>{t.reserveRequired}: {profile.requiredReserveContacts ?? t.detailsUnknown}</Text><Text>{t.reserveRecorded}: {profile.profile?.additionalContacts?.length ?? t.detailsUnknown}</Text>
    </Surface>
    {children}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { gap: theme.space.page, paddingBottom: theme.space.section } });
