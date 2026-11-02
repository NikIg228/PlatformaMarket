import { CatalogMediaUi } from "./CatalogMediaUi";
import type { CatalogMediaPreview } from "./catalog-media-preview";
import type { ReactNode } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { CatalogSearchResponse, OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import { searchCatalogSchema } from "../../../packages/schemas/src/index";
import { copy } from "./i18n";
import { formatMinor, type Locale } from "./format-wire";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const catalogReadCopy = {
 ru: { description: "Описание товара", descriptionMissing: "Описание пока не добавлено", descriptionScope: "Описание относится к линейке товара. Исполнение и комплектацию уточняйте по выбранному артикулу.", emptyPage: "На этой странице товаров нет", changed: "Страница каталога не соответствует запросу", changedBody: "Обновите каталог или вернитесь к предыдущей странице.", stopped: "Следующая страница каталога недоступна" },
 kk: { description: "Тауар сипаттамасы", descriptionMissing: "Сипаттама әлі қосылмаған", descriptionScope: "Сипаттама тауар желісіне қатысты. Нұсқасы мен жиынтығын таңдалған артикул бойынша нақтылаңыз.", emptyPage: "Бұл бетте тауар жоқ", changed: "Каталог беті сұрауға сәйкес келмейді", changedBody: "Каталогты жаңартыңыз немесе алдыңғы бетке оралыңыз.", stopped: "Каталогтың келесі беті қолжетімсіз" },
} as const;
export function catalogNextOffset(page: CatalogSearchResponse, expectedOffset: number): number | null {
 const next = page.offset + page.limit;
 return page.offset === expectedOffset && next > expectedOffset && next < page.total && searchCatalogSchema.shape.offset.safeParse(next).success ? next : null;
}
export function CatalogListRead({ categoryLabel, supplierLabel, commercialSummary, media, onRefresh, page, offset, categoryId, supplierOrganizationId, locale, onClear, onNext, onVariant }: { categoryLabel?: string; supplierLabel?: string; commercialSummary?: ReactNode; media?: CatalogMediaPreview; onRefresh?: () => void; page: CatalogSearchResponse; offset: number; categoryId?: string; supplierOrganizationId?: string; locale: Locale; onClear: () => void; onNext: () => void; onVariant: (productId: string, variantId: string) => void }) {
 const t = copy[locale], c = catalogReadCopy[locale], next = catalogNextOffset(page, offset);
 if (page.offset !== offset) return <Notice title={c.changed} body={c.changedBody} />;
 return <FlatList data={page.items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={categoryId !== undefined || supplierOrganizationId !== undefined || commercialSummary !== undefined ? <Stack>{categoryId !== undefined && <Text>{t.categoryFilter}: {page.facets.categories.find(item => item.id === categoryId)?.name.trim() || categoryLabel?.trim() || t.filterSelected}</Text>}{supplierOrganizationId !== undefined && <Text>{t.supplierFilter}: {page.facets.suppliers.find(item => item.id === supplierOrganizationId)?.name.trim() || supplierLabel?.trim() || t.filterSelected}</Text>}{commercialSummary}<Button label={t.clearFilters} onPress={onClear} /></Stack> : undefined} ListEmptyComponent={<Notice title={offset > 0 || page.total > 0 ? c.emptyPage : t.emptyCatalog} />} renderItem={({ item }) => <Surface>
  <Text kind="subtitle" strong>{item.name}</Text>{media && <CatalogMediaUi model={media} product={item} locale={locale} onRefresh={onRefresh} />}<Text strong>{c.description}</Text>{item.description !== null && item.description.trim() ? <><Text>{item.description}</Text><Text secondary>{c.descriptionScope}</Text></> : <Text secondary>{c.descriptionMissing}</Text>}<Text secondary>{t.variants}</Text>{item.variants.length ? item.variants.map(variant => <Button key={variant.id} label={variant.label} accessibilityLabel={`${t.open}: ${item.name}, ${variant.label}`} onPress={() => onVariant(item.id, variant.id)} />) : <Text secondary>{t.noVariants}</Text>}
 </Surface>} ListFooterComponent={next !== null ? <Button label={t.next} onPress={onNext} /> : page.offset + page.limit < page.total ? <Notice title={c.stopped} body={c.changedBody} /> : undefined} />;
}
export function ComparisonListRead({ comparison, locale, controls, attributes, onOffer }: { comparison: OfferComparisonResponse; locale: Locale; controls?: ReactNode; attributes?: ReactNode; onOffer: (offerId: string) => void }) {
 const t = copy[locale]; return <FlatList data={comparison.offers.filter(offer => offer.variantId === comparison.selectedVariantId)} keyExtractor={offer => offer.offerId} contentContainerStyle={styles.list} ListHeaderComponent={<Stack><Text kind="subtitle" strong>{comparison.product.name}</Text>{controls}{attributes}</Stack>} ListEmptyComponent={<Notice title={t.emptyOffers} />} renderItem={({ item }) => <Surface>
 <Text strong>{item.supplier.name}</Text><Text>{formatMinor(item.price.amountMinor, item.price.currency, locale) ?? t.priceUnknown}</Text><Text secondary>{item.packaging.name}</Text><Text>{t.minimum}: {item.minimumOrderQuantity}</Text><Text>{t.orderIncrement}: {item.orderIncrement}</Text><Button label={t.open} accessibilityLabel={`${t.open}: ${item.supplier.name}`} onPress={() => onOffer(item.offerId)} />
 </Surface>} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
