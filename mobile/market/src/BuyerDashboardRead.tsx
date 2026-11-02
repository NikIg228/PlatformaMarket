import { FlatList, StyleSheet } from "react-native";
import type { BuyerDashboardFixture } from "./buyer-dashboard-fixture-read";
import type { Locale } from "./format-wire";
import { formatTimestamp } from "./format-wire";
import { copy, statusLabel } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

export function BuyerDashboardRead({ dashboard, locale, onCart, onOrder, onLists }: { dashboard: BuyerDashboardFixture; locale: Locale; onCart?: (id: string) => void; onOrder: (id: string) => void; onLists?: () => void }) {
  const t = copy[locale], cart = dashboard.activeCart;
  return <FlatList data={dashboard.recentOrders} keyExtractor={order => order.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    <Notice title={t.buyerDashboard} body={t.dashboardSnapshot} /><Text secondary>{t.dashboardSeparateReads}</Text>
    <Surface><Text strong>{t.dashboardPending}: {dashboard.pendingOrders}</Text><Text secondary>{t.dashboardPendingMeaning}</Text></Surface>
    <Surface><Text strong>{t.dashboardSavedLists}: {dashboard.savedLists}</Text>{onLists ? <Button label={t.dashboardOpenLists} onPress={onLists} /> : <Text secondary>{t.dashboardListsUnavailable}</Text>}</Surface>
    <Surface><Text kind="subtitle" strong>{t.dashboardCart}</Text>{cart ? <Stack><Text>{t.dashboardCartItems}: {cart.itemCount}</Text><Text>{t.recordUpdated}: {formatTimestamp(cart.updatedAt, locale) ?? t.dateUnknown}</Text>{onCart ? <Button label={t.dashboardOpenCart} onPress={() => onCart(cart.id)} /> : <Text secondary>{t.dashboardCartUnavailable}</Text>}</Stack> : <Notice title={t.dashboardNoCart} />}</Surface>
    <Text kind="subtitle" strong>{t.dashboardRecent}</Text><Text secondary>{t.dashboardRecentWindow}</Text>
  </Stack>} ListEmptyComponent={<Notice title={t.dashboardRecentEmpty} />} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{item.orderNumber.trim() ? item.orderNumber : t.order}</Text><Text>{t.dashboardSupplier}: {item.supplier.displayName.trim() ? item.supplier.displayName : t.detailsUnknown}</Text>
    <Text>{t.status}: {statusLabel(item.status, locale)}</Text><Text>{t.createdAt}: {formatTimestamp(item.createdAt, locale) ?? t.dateUnknown}</Text>
    <Button label={t.open} accessibilityLabel={`${t.dashboardOpenOrder}: ${item.orderNumber.trim() ? item.orderNumber : t.order}`} onPress={() => onOrder(item.id)} />
  </Surface>} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
