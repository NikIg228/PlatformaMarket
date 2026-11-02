import { render, screen } from "@testing-library/react-native";
import { comparedOfferSchema } from "../../../packages/schemas/src/core-api";
import { deliveryMethodSchema, deliveryPriceTypeSchema } from "../../../packages/schemas/src/index";
import { OfferDeliveryRead } from "./OfferDeliveryRead";
import { copy, deliveryMethodLabel, deliveryPriceLabel } from "./i18n";
import { formatMinor } from "./format-wire";
const option = () => comparedOfferSchema.shape.delivery.element.parse({ method: "CARRIER", priceType: "FREE_FROM_AMOUNT", fixedAmountMinor: "90071992547409931234", freeFromAmountMinor: "12345678901234567890", currency: "USD", minLeadTimeHours: 0, maxLeadTimeHours: null, temperatureControlled: true, installationRequired: false });
it.each(["ru", "kk"] as const)("shows exact separate delivery currency/threshold and unknown upper lead in %s", async locale => {
  const t = copy[locale]; const data = option();
  await render(<OfferDeliveryRead options={[data]} locale={locale} />);
  expect(screen.getByText(`${t.deliveryThreshold}: ${formatMinor(data.freeFromAmountMinor!, "USD", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.deliveryFallback}: ${formatMinor(data.fixedAmountMinor, "USD", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.leadTime}: ${t.from} 0; ${t.upperUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.temperature}: ${t.yes}`)).toBeOnTheScreen();
});
it("does not assume goods currency, a zero fee or free eligibility when optional delivery fields are missing", async () => {
  const data = option(); delete data.currency; delete data.freeFromAmountMinor; data.fixedAmountMinor = null;
  await render(<OfferDeliveryRead options={[data]} locale="ru" />);
  expect(screen.getByText(`${copy.ru.deliveryThreshold}: ${copy.ru.deliveryPriceUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${copy.ru.deliveryFallback}: ${copy.ru.deliveryPriceUnknown}`)).toBeOnTheScreen();
  expect(screen.queryByText(/0,00 KZT/)).toBeNull();
});
it("keeps unknown method/type and contradictory lead time unsupported without exposing raw values", async () => {
  const data = option(); data.method = "__proto__"; data.priceType = "FUTURE_TARIFF"; data.minLeadTimeHours = 3; data.maxLeadTimeHours = 1;
  await render(<OfferDeliveryRead options={[data]} locale="kk" />);
  expect(screen.getByText(copy.kk.methodUnknown)).toBeOnTheScreen();
  expect(screen.getByText(copy.kk.deliveryPriceUnknown)).toBeOnTheScreen();
  expect(screen.getByText(`${copy.kk.leadTime}: ${copy.kk.leadUnknown}`)).toBeOnTheScreen();
  expect(screen.queryByText("FUTURE_TARIFF")).toBeNull();
  expect(screen.queryByText(/USD/)).toBeNull();
});
it.each(["ru", "kk"] as const)("shows missing delivery and translates every known schema method/type in %s", async locale => {
  await render(<OfferDeliveryRead options={[]} locale={locale} />);
  expect(screen.getByText(copy[locale].deliveryUnknown)).toBeOnTheScreen();
  for (const key of deliveryMethodSchema.options) expect(deliveryMethodLabel(key, locale)).not.toBe(key);
  for (const key of deliveryPriceTypeSchema.options) expect(deliveryPriceLabel(key, locale)).not.toBe(key);
});
it("FREE and PRICE_ON_REQUEST do not display unrelated numeric fields as a quoted charge", async () => {
  const data = option(); data.priceType = "FREE";
  await render(<OfferDeliveryRead options={[data, { ...data, priceType: "PRICE_ON_REQUEST" }]} locale="ru" />);
  expect(screen.getByText(copy.ru.deliveryFree)).toBeOnTheScreen();
  expect(screen.getByText(copy.ru.deliveryOnRequest)).toBeOnTheScreen();
  expect(screen.queryByText(/USD/)).toBeNull();
});
