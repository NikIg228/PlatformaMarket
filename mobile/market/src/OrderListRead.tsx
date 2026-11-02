import type { ReactElement } from "react";
import { canAdvanceCursor } from "./cursor-navigation";
import { FlatList, StyleSheet } from "react-native";
import type { WorkspaceOrderPage } from "../../../packages/schemas/src/workspace-reads";
import { copy, paymentLabel, statusLabel } from "./i18n";
import { orderStatusCopy } from "./OrderStatusFilters";
import { formatMinor, formatTimestamp, type Locale } from "./format-wire";
import { Button, Notice, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
export const orderListCopy = {
  ru: { stopped: "Следующая страница недоступна", stoppedBody: "Не удалось продолжить список. Обновите страницу или вернитесь назад." },
  kk: { stopped: "Келесі бет қолжетімсіз", stoppedBody: "Тізімді жалғастыру мүмкін болмады. Бетті жаңартыңыз немесе артқа оралыңыз." },
} as const;
export { canAdvanceCursor as canAdvanceOrderPage } from "./cursor-navigation";
export function OrderListRead({ controls, page, locale, cursor, statusFiltered, visited, onNext, onOpen }: { controls?:ReactElement; page: WorkspaceOrderPage; locale: Locale; cursor?: string; statusFiltered: boolean; visited: readonly (string | undefined)[]; onNext: (page: WorkspaceOrderPage) => void; onOpen: (page: WorkspaceOrderPage, id: string) => void }) {
 const t = copy[locale], n = orderListCopy[locale], next = canAdvanceCursor(page.nextCursor, visited);
 return <FlatList ListHeaderComponent={controls} data={page.items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Notice title={cursor === undefined && page.nextCursor === null && statusFiltered ? orderStatusCopy[locale].empty : t.emptyOrders} />} renderItem={({ item }) => <Surface>
   <Text kind="subtitle" strong>{item.orderNumber}</Text><Text>{t.supplier}: {item.supplier.displayName.trim() ? item.supplier.displayName : t.partyUnknown}</Text><Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text><Text>{t.itemCount}: {item.itemCount}</Text><Text>{t.status}: {statusLabel(item.status, locale)}</Text><Text>{t.payment}: {paymentLabel(item.paymentStatus, locale)}</Text><Text>{formatMinor(item.subtotalAmountMinor, item.currency, locale) ?? t.priceUnknown}</Text>
   <Button label={t.open} accessibilityLabel={`${t.open}: ${item.orderNumber}`} onPress={() => onOpen(page, item.id)} />
 </Surface>} ListFooterComponent={page.nextCursor === null ? undefined : next ? <Button label={t.next} onPress={() => onNext(page)} /> : <Notice title={n.stopped} body={n.stoppedBody} />} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
