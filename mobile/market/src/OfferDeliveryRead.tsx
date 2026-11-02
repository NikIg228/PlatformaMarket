import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import { formatMinor, type Locale } from "./format-wire";
import { copy, deliveryMethodLabel, deliveryPriceLabel } from "./i18n";
import { Notice, Stack, Surface, Text } from "./ui/controls";

type Delivery = OfferComparisonResponse["offers"][number]["delivery"][number];
export function OfferDeliveryRead({ options, locale }: { options: readonly Delivery[]; locale: Locale }) {
  const t = copy[locale];
  return <Stack><Text kind="subtitle" strong>{t.deliveryTerms}</Text><Text secondary>{t.deliveryTermsBody}</Text>
    {!options.length && <Notice title={t.deliveryUnknown} />}
    {options.map((option, index) => {
      // Optional delivery currency is never inherited from the goods price.
      const amount = formatMinor(option.fixedAmountMinor, option.currency ?? null, locale) ?? t.deliveryPriceUnknown;
      const threshold = formatMinor(option.freeFromAmountMinor ?? null, option.currency ?? null, locale) ?? t.deliveryPriceUnknown;
      const validLead = option.minLeadTimeHours >= 0 && (option.maxLeadTimeHours === null || option.maxLeadTimeHours >= option.minLeadTimeHours);
      return <Surface key={index}><Text strong>{deliveryMethodLabel(option.method, locale)}</Text>
        <Text>{deliveryPriceLabel(option.priceType, locale)}</Text>
        {option.priceType === "FIXED" && <Text>{t.deliveryFixed}: {amount}</Text>}
        {option.priceType === "FREE_FROM_AMOUNT" && <><Text>{t.deliveryThreshold}: {threshold}</Text><Text>{t.deliveryFallback}: {amount}</Text></>}
        <Text>{t.leadTime}: {validLead ? `${t.from} ${option.minLeadTimeHours}; ${option.maxLeadTimeHours === null ? t.upperUnknown : `${t.to} ${option.maxLeadTimeHours}`}` : t.leadUnknown}</Text>
        <Text>{t.temperature}: {option.temperatureControlled ? t.yes : t.no}</Text><Text>{t.installation}: {option.installationRequired ? t.yes : t.no}</Text>
      </Surface>;
    })}
  </Stack>;
}
