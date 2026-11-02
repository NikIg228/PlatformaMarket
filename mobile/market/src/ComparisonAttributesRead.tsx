import { projectComparisonAttributes, type AttributeValue } from "./comparison-attributes";
import type { Locale } from "./format-wire";
import { Notice, Stack, Text } from "./ui/controls";
export const attributesCopy = {
 ru: { brand: "Бренд", manufacturer: "Производитель", sku: "Артикул выбранного варианта", infoUnknown: "Не передано", title: "Характеристики", product: "Характеристики товара", variant: "Характеристики выбранного варианта", selected: "Выбранный вариант", noLabel: "Название варианта не передано", empty: "Характеристики не переданы", unavailable: "Характеристики выбранного товара и варианта недоступны", unknown: "Значение не определено", nameUnknown: "Название характеристики не передано", unbound: "Связь части характеристик с вариантом не определена", yes: "Да", no: "Нет" },
 kk: { brand: "Бренд", manufacturer: "Өндіруші", sku: "Таңдалған нұсқа артикулы", infoUnknown: "Берілмеген", title: "Сипаттамалар", product: "Тауар сипаттамалары", variant: "Таңдалған нұсқаның сипаттамалары", selected: "Таңдалған нұсқа", noLabel: "Нұсқа атауы берілмеген", empty: "Сипаттамалар берілмеген", unavailable: "Таңдалған тауар мен нұсқаның сипаттамалары қолжетімсіз", unknown: "Мәні анықталмаған", nameUnknown: "Сипаттама атауы берілмеген", unbound: "Кейбір сипаттамалардың нұсқамен байланысы анықталмаған", yes: "Иә", no: "Жоқ" },
} as const;
export function attributeValueText(value: AttributeValue, locale: Locale): string { const t = attributesCopy[locale]; return value.kind === "unknown" ? t.unknown : value.kind === "boolean" ? value.value ? t.yes : t.no : value.text.trim() ? value.text : t.unknown; }
export function ComparisonAttributesRead({ comparison, productId, variantId, locale }: { comparison: unknown; productId: string; variantId: string; locale: Locale }) {
 const view = projectComparisonAttributes(comparison, productId, variantId), t = attributesCopy[locale];
 if (view.state !== "ready") return <Notice title={t.unavailable} />;
 return <Stack><Text kind="subtitle" strong>{t.title}</Text><Text>{t.selected}: {view.variantLabel.trim() ? view.variantLabel : t.noLabel}</Text>{(["brand", "manufacturer", "sku"] as const).map(field => <Text key={field}>{t[field]}: {view.identity[field]?.trim() ? view.identity[field] : t.infoUnknown}</Text>)}{view.unboundVariant && <Notice title={t.unbound} />}
  {(["product", "variant"] as const).map(scope => <Stack key={scope}><Text strong>{t[scope]}</Text>{view[scope].length ? view[scope].map(row => <Stack key={row.key}><Text strong>{row.name.trim() ? row.name : t.nameUnknown}</Text><Text>{attributeValueText(row.value, locale)}</Text></Stack>) : <Text secondary>{t.empty}</Text>}</Stack>)}
 </Stack>;
}
