import type { ReactNode } from "react";
import { FlatList, StyleSheet } from "react-native";
import type { CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
import { copy } from "./i18n";
import type { Locale } from "./format-wire";
import { Button, Notice, Stack, Text } from "./ui/controls";
import { theme } from "./ui/theme";

type FilterField = "categoryId" | "supplierOrganizationId";
export function CatalogFiltersRead({ reference, useReferenceChoices = false, categoryLabel, supplierLabel, advanced, facets, categoryId, supplierOrganizationId, q, locale, onSelect, onClear }: { reference?: ReactNode; useReferenceChoices?: boolean; categoryLabel?: string; supplierLabel?: string; advanced?: ReactNode; facets: CatalogSearchResponse["facets"]; categoryId?: string; supplierOrganizationId?: string; q: string; locale: Locale; onSelect: (field: FilterField, value: string) => void; onClear: () => void }) {
  const t = copy[locale];
  const options = useReferenceChoices ? [] : [...facets.categories.map(item => ({ ...item, field: "categoryId" as const })), ...facets.suppliers.map(item => ({ ...item, field: "supplierOrganizationId" as const }))];
  return <FlatList data={options} keyExtractor={item => `${item.field}:${item.id}`} contentContainerStyle={styles.list} ListHeaderComponent={<Stack><Text>{t.filterPrompt}</Text>
    {!!q && <Text kind="caption" secondary>{t.searchApplied}: {q}</Text>}
    {categoryId !== undefined && <Text>{t.categoryFilter}: {facets.categories.find(item => item.id === categoryId)?.name.trim() || categoryLabel?.trim() || t.filterSelected}</Text>}
    {supplierOrganizationId !== undefined && <Text>{t.supplierFilter}: {facets.suppliers.find(item => item.id === supplierOrganizationId)?.name.trim() || supplierLabel?.trim() || t.filterSelected}</Text>}
    {(categoryId !== undefined || supplierOrganizationId !== undefined) && <Button label={t.clearFilters} onPress={onClear} />}
    {reference}
    {advanced}
    {!useReferenceChoices && !facets.categories.length && <Notice title={t.noCategoryChoices} />}{!useReferenceChoices && !facets.suppliers.length && <Notice title={t.noSupplierChoices} />}
  </Stack>} renderItem={({ item }) => <Button tone="tab" selected={item.field === "categoryId" ? item.id === categoryId : item.id === supplierOrganizationId} label={`${item.field === "categoryId" ? t.categoryFilter : t.supplierFilter}: ${item.name.trim() ? item.name : t.filterNameUnknown}`} onPress={() => onSelect(item.field, item.id)} />} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.medium, paddingBottom: theme.space.section } });
