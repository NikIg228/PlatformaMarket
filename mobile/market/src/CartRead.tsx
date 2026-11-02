import { CartCheckoutPanel, CartCheckoutReview, useCartCheckoutState } from "./CartCheckoutUi";
import type { CartCheckout } from "./cart-checkout-fixture";
import { CartRepriceReview, CartRepricePanel, useCartRepriceState } from "./CartRepriceUi";
import type { CartReprice } from "./cart-reprice-fixture";
import { CartValidationItemFacts, CartValidationPanel, useCartValidationState } from "./CartValidationUi";
import type { CartValidation } from "./cart-validation-fixture";
import { CartQuantityCommandStatuses } from "./CartCommandUi";
import type { CartQuantityCommands } from "./cart-command-fixture";
import { CartAddCommandPanel } from "./CartAddCommandUi";
import type { CartAddCommands } from "./cart-add-command-fixture";
import { CartRecoveryAction, CartWorkspaceCommandPanel } from "./CartWorkspaceCommandUi";
import type { CartWorkspaceCommands } from "./cart-workspace-command-fixture";
import { canAdvanceCursor } from "./cursor-navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { QuantityDraftRow, QuantityDraftSummary } from "./CartQuantityDraftUi";
import type { CartQuantityDrafts } from "./cart-quantity-draft";
import { FlatList, StyleSheet } from "react-native";
import type { CartResponse, CheckoutResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { formatMinor, formatTimestamp, type Locale } from "./format-wire";
import { cartReadStatusLabel, checkoutReadStatusLabel, copy, paymentLabel, statusLabel } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";
import { recoveredCartCopy, recoveredCartTarget } from "./recovered-cart-link";
export const nativeCartWorkspaceBody={ru:"Проверьте изменения перед отправкой. Перед оформлением отдельно проверьте условия корзины.",kk:"Жіберу алдында өзгерістерді тексеріңіз. Рәсімдеу алдында себет шарттарын бөлек тексеріңіз."} as const;
function CartItemRead({ item, index, locale, draftControl, validationControl }: { validationControl?: ReactNode; item: CartResponse["items"][number]; index: number; locale: Locale; draftControl?: React.ReactNode }) {
  const t = copy[locale], name = item.offer?.productVariant?.product.canonicalName;
  return <Surface><Text kind="caption" secondary>{t.cartItem} {index + 1}</Text><Text kind="subtitle" strong>{name?.trim() ? name : t.itemUnknown}</Text>
    {draftControl}
    <Text>{t.quantity}: {item.quantity}</Text><Text>{t.normalized}: {formatMinor(item.unitPriceMinor, item.currency, locale) ?? t.priceUnknown}</Text><Text>{t.lineAmount}: {formatMinor(item.totalPriceMinor, item.currency, locale) ?? t.priceUnknown}</Text>{validationControl}
  </Surface>;
}
export function CartWorkspaceRead({ beforeControls, page, locale, cursor, visitedCursors = [], onCart, onRecoveredCart, workspaceCommands, cartAddCommands, onCommandResult, onNext, retry, quantityDrafts, onDraft, quantityCommands, onAttempt, onOriginalCart, cartValidation, cartReprice, onRepriceResult, cartCheckout, onCheckoutReceipt }: { beforeControls?: ReactNode; cartCheckout?: CartCheckout; onCheckoutReceipt?: (receipt: CheckoutResponse) => void; cartReprice?: CartReprice; onRepriceResult?: (cart: CartResponse) => void; cartValidation?: CartValidation; quantityCommands?: CartQuantityCommands; onAttempt?: (cartId: string) => void; onOriginalCart?: (cartId: string) => void; page: WorkspaceCartPage; locale: Locale; cursor?: string; visitedCursors?: readonly (string | undefined)[]; retry: () => void; quantityDrafts: CartQuantityDrafts; onDraft: (cart: CartResponse, item: CartResponse["items"][number]) => void; onCart?: (cartId: string) => void; onRecoveredCart?: (source: CartResponse) => void; workspaceCommands?: CartWorkspaceCommands; cartAddCommands?: CartAddCommands; onCommandResult?: (cart: CartResponse) => void; onNext: (cursor: string) => void }) {
  const t = copy[locale], current = page.current;
  const nativeCommands=quantityCommands?.runtime==="native-session"||workspaceCommands?.runtime==="native-session"||cartAddCommands?.runtime==="native-session"||cartValidation?.runtime==="native-session"||cartReprice?.runtime==="native-session"||cartCheckout?.runtime==="native-session";
  useSyncExternalStore(quantityDrafts.subscribe, quantityDrafts.getSnapshot, quantityDrafts.getSnapshot);
  useCartCheckoutState(cartCheckout);
  useCartRepriceState(cartReprice); useCartValidationState(cartValidation);
  const validationResult = cartValidation?.resultFor(page), validationByItem = new Map(validationResult?.items.map((item, index) => [item.cartItemId, { item, index }]));
  const checkoutReview = cartCheckout?.isAvailable() ? Object.entries(cartCheckout.getSnapshot()).find(([,state]) => ["prepared", "key-error"].includes(state.phase))?.[0] : undefined;
  if (cartCheckout && checkoutReview) return <CartCheckoutReview model={cartCheckout} cartId={checkoutReview} locale={locale} />;
  if (cartReprice?.isAvailable() && cartReprice.getSnapshot().phase === "prepared") return <CartRepriceReview model={cartReprice} locale={locale} />;
  return <FlatList data={current?.items ?? []} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    {beforeControls}<Notice title={current ? t.currentCart : t.noCurrentCart} body={nativeCommands?nativeCartWorkspaceBody[locale]:t.cartReadOnly} />
    <QuantityDraftSummary store={quantityDrafts} locale={locale} nativeCommands={nativeCommands} />
    {quantityCommands && <CartQuantityCommandStatuses command={quantityCommands} locale={locale} onAttempt={onAttempt} onOriginalCart={onOriginalCart} />}
    {workspaceCommands && <CartWorkspaceCommandPanel command={workspaceCommands} page={page} locale={locale} onResult={onCommandResult} onCurrent={onCart} currencyHint={cartAddCommands?.selectedCurrency()} />}
    {cartAddCommands && <CartAddCommandPanel command={cartAddCommands} page={page} locale={locale} onCart={onCart} />}
    {cartValidation && !cartCheckout?.blocksOtherMutations() && !cartReprice?.blocksOtherMutations() && <CartValidationPanel showItems={false} model={cartValidation} page={page} locale={locale} />}
    {cartCheckout && <CartCheckoutPanel model={cartCheckout} page={page} locale={locale} onReceipt={onCheckoutReceipt} />}
    {cartReprice && <CartRepricePanel model={cartReprice} page={page} locale={locale} onResult={onRepriceResult} />}
    {current && <><Text>{t.snapshotVersion}: {current.version}</Text>{onCart && <Button label={t.cartDetails} onPress={() => onCart(current.id)} />}</>}
  </Stack>} ListEmptyComponent={current ? <Notice title={t.emptyCart} /> : undefined} renderItem={({ item, index }) => <CartItemRead validationControl={validationByItem.has(item.id) ? <CartValidationItemFacts item={validationByItem.get(item.id)!.item} index={validationByItem.get(item.id)!.index} locale={locale} /> : undefined} item={item} index={index} locale={locale} draftControl={current && <QuantityDraftRow store={quantityDrafts} cart={current} item={item} index={index} locale={locale} onOpen={() => onDraft(current, item)} />} />} ListFooterComponent={<Stack>
    <Text kind="subtitle" strong>{t.failedCarts}</Text><Text secondary>{t.failedCartsBody}</Text>
    {!page.items.length && <Notice title={t.failedCartsEmpty} />}
    {page.items.map((cart, index) => <Surface key={cart.id}><Text kind="subtitle" strong>{t.savedCart} {index + 1}</Text>
      <Text>{t.createdAt}: {formatTimestamp(cart.createdAt, locale) ?? t.dateUnknown}</Text><Text>{t.cartState}: {cartReadStatusLabel(cart.status, locale)}</Text>
      <Text>{t.savedCartVersion}: {cart.version}</Text><Text>{t.checkoutState}: {cart.checkout ? checkoutReadStatusLabel(cart.checkout.status ?? "", locale) : t.checkoutUnavailable}</Text>
      {recoveredCartTarget(cart) ? <Notice title={recoveredCartCopy[locale].title} body={recoveredCartCopy[locale].body} action={onRecoveredCart && <Button label={recoveredCartCopy[locale].open} accessibilityLabel={`${recoveredCartCopy[locale].open}: ${t.savedCart} ${index + 1}`} onPress={() => onRecoveredCart(cart)} />} /> : cart.recoveredCartId ? <Notice kind="error" title={recoveredCartCopy[locale].invalid} /> : null}
      {workspaceCommands && <CartRecoveryAction command={workspaceCommands} page={page} source={cart} index={index} locale={locale} />}
      {onCart && <Button label={t.open} accessibilityLabel={`${t.open}: ${t.savedCart} ${index + 1}`} onPress={() => onCart(cart.id)} />}
    </Surface>)}
    {page.nextCursor !== null && (!canAdvanceCursor(page.nextCursor, [...visitedCursors, cursor]) ? <Notice kind="error" title={t.cartPagePartial} body={t.cartPageRecovery} action={<Button label={t.retry} onPress={retry} />} /> : <Button label={t.next} onPress={() => onNext(page.nextCursor!)} />)}
  </Stack>} />;
}
export function CartDetailRead({ cart, locale, onCheckout, attemptNotice }: { attemptNotice?: ReactNode; cart: CartResponse; locale: Locale; onCheckout?: (checkoutId: string, cartId: string) => void }) {
  const t = copy[locale];
  return <FlatList data={cart.items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    <Notice title={t.cartSnapshot} body={t.cartSnapshotBody} />{attemptNotice}
    <Text>{t.cartState}: {cartReadStatusLabel(cart.status, locale)}</Text><Text>{t.snapshotVersion}: {cart.version}</Text><Text>{t.createdAt}: {formatTimestamp(cart.createdAt, locale) ?? t.dateUnknown}</Text>
    {cart.checkout ? <Stack><Text>{t.checkoutState}: {checkoutReadStatusLabel(cart.checkout.status ?? "", locale)}</Text>{onCheckout && <Button label={t.openSavedCheckout} onPress={() => onCheckout(cart.checkout!.id, cart.id)} />}</Stack> : <Notice title={t.checkoutUnavailable} />}
  </Stack>} ListEmptyComponent={<Notice title={t.snapshotItemsEmpty} />} renderItem={({ item, index }) => <CartItemRead item={item} index={index} locale={locale} />} />;
}
type CheckoutContentProps = { checkout: CheckoutResponse; locale: Locale; onOrder?: (orderId: string) => void; intentControls?: ReactNode };
function CheckoutContents({ checkout, locale, onOrder, intentControls }: CheckoutContentProps) {
  const t = copy[locale];
  return <FlatList data={checkout.supplierOrders} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    <Notice title={t.savedCheckout} body={t.checkoutSnapshotBody} /><Text>{t.checkoutState}: {checkoutReadStatusLabel(checkout.status, locale)}</Text>
    <Text>{t.createdAt}: {formatTimestamp(checkout.createdAt, locale) ?? t.dateUnknown}</Text><Text>{t.recordUpdated}: {formatTimestamp(checkout.updatedAt, locale) ?? t.dateUnknown}</Text>
    {intentControls}
    <Text>{t.checkoutSnapshotAmount}: {formatMinor(checkout.totalAmountMinor, checkout.currency, locale) ?? t.amountUnknown}</Text><Text>{t.savedCartItemCount}: {checkout.cart.items.length}</Text>
  </Stack>} ListEmptyComponent={<Notice title={t.checkoutOrdersEmpty} />} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{item.orderNumber}</Text><Text>{t.supplier}: {item.supplier?.displayName.trim() ? item.supplier.displayName : t.partyUnknown}</Text>
    <Text>{t.status}: {statusLabel(item.status, locale)}</Text><Text>{t.payment}: {paymentLabel(item.paymentStatus, locale)}</Text><Text>{t.amount}: {formatMinor(item.subtotalAmountMinor, item.currency, locale) ?? t.amountUnknown}</Text>
    {onOrder && <Button label={t.open} accessibilityLabel={`${t.open}: ${item.orderNumber}`} onPress={() => onOrder(item.id)} />}
  </Surface>} />;
}
export function SavedCheckoutRead(props: Omit<CheckoutContentProps,"onOrder"> & { onOrder: (orderId: string) => void }) { return <CheckoutContents {...props} />; }
export function CheckoutSummaryRead(props: Omit<CheckoutContentProps,"onOrder">) { return <CheckoutContents {...props} />; }
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
