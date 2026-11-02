import { ScrollView, StyleSheet } from "react-native";
import type { CheckoutResponse } from "../../../packages/schemas/src/core-api";
import { checkoutIntentFixturePointer, type PaymentIntentFixture } from "./payment-intent-fixture-read";
import { copy, intentStatusLabel } from "./i18n";
import { formatTimestamp, type Locale } from "./format-wire";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export function CheckoutIntentFixtureLink({ checkout, buyerOrganizationId, locale, onOpen }: { checkout: CheckoutResponse; buyerOrganizationId: string; locale: Locale; onOpen: () => void }) {
  const t = copy[locale], link = checkoutIntentFixturePointer(checkout, buyerOrganizationId);
  if (link.kind === "none") return <Notice title={t.intentNotSpecified} />;
  if (link.kind !== "available") return <Notice title={t.intentLinkUnavailable} />;
  return <Stack><Text>{t.intentCheckoutState}: {intentStatusLabel(link.status, locale)}</Text><Text secondary>{t.intentSeparateRead}</Text><Button label={t.intentOpen} onPress={onOpen} /></Stack>;
}
export function PaymentIntentRead({ intent, locale, onBack }: { intent: PaymentIntentFixture; locale: Locale; onBack: () => void }) {
  const t = copy[locale], date = (value: string | null | undefined) => formatTimestamp(value, locale) ?? t.dateUnknown;
  return <ScrollView contentContainerStyle={styles.body}><Notice title={t.intentTitle} body={t.intentBoundary} />
    <Surface><Text strong>{t.intentState}: {intentStatusLabel(intent.status, locale)}</Text>
      <Text>{t.intentAmount}: {intent.totalAmountMinor ?? t.amountUnknown}</Text><Text>{t.intentCurrency}: {intent.currency ?? t.intentCurrencyUnknown}</Text>
      <Text>{t.intentProvider}: {intent.provider?.name?.trim() ? intent.provider.name : t.intentProviderUnknown}</Text>
      {intent.provider?.code === "MOCK" && <Notice title={t.intentMock} body={t.intentMockBody} />}
      <Text>{t.createdAt}: {date(intent.createdAt)}</Text><Text>{t.recordUpdated}: {date(intent.updatedAt)}</Text><Text>{t.intentExpires}: {intent.expiresAt === null ? t.intentNoExpiry : date(intent.expiresAt)}</Text>
    </Surface><Text secondary>{t.intentFreshness}</Text><Button label={t.intentBack} onPress={onBack} />
  </ScrollView>;
}
const styles = StyleSheet.create({ body: { gap: theme.space.page, paddingBottom: theme.space.section } });
