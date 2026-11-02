import { FlatList, StyleSheet } from "react-native";
import { workspaceOrderStatusSchema, type WorkspaceOrderQuery } from "../../../packages/schemas/src/workspace-reads";
import { statusLabel } from "./i18n";
import type { Locale } from "./format-wire";
import { Button, Stack, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const orderStatusCopy = {
  ru: { title: "Статус заказа", all: "Все статусы", prompt: "Выберите статус заказов", clear: "Снять фильтр по статусу", empty: "Заказы с выбранными фильтрами не найдены" },
  kk: { title: "Тапсырыс мәртебесі", all: "Барлық мәртебелер", prompt: "Тапсырыс мәртебесін таңдаңыз", clear: "Мәртебе сүзгісін алып тастау", empty: "Таңдалған сүзгілерге сәйкес тапсырыстар табылмады" },
} as const;
export const orderStatusChoices = [undefined, ...workspaceOrderStatusSchema.options] as const;
export const orderStatusFilterLabel = (status: WorkspaceOrderQuery["status"], locale: Locale) => status === undefined ? orderStatusCopy[locale].all : statusLabel(status, locale);
export function OrderStatusFilters({ status, locale, onSelect, disabled = false }: { disabled?: boolean; status?: WorkspaceOrderQuery["status"]; locale: Locale; onSelect: (status: WorkspaceOrderQuery["status"]) => void }) {
  const t = orderStatusCopy[locale];
  return <FlatList data={orderStatusChoices} keyExtractor={item => item ?? "all"} contentContainerStyle={styles.list} ListHeaderComponent={<Stack><Text>{t.prompt}</Text>{status !== undefined && <Button disabled={disabled} label={t.clear} onPress={() => onSelect(undefined)} />}</Stack>} renderItem={({ item }) => <Button disabled={disabled} tone="tab" selected={item === status} label={orderStatusFilterLabel(item, locale)} accessibilityLabel={`${t.title}: ${orderStatusFilterLabel(item, locale)}`} onPress={() => onSelect(item)} />} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.medium, paddingBottom: theme.space.section } });
