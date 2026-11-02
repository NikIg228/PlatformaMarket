import type { OrderHistory } from "./order-history-read";
import { OrderHistoryRead, orderHistoryCopy } from "./OrderHistoryRead";
import { FlatList, StyleSheet } from "react-native";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { formatMinor, formatTimestamp, type Locale } from "./format-wire";
import { claimStatusLabel, copy, deliveryMethodLabel, documentKindLabel, paymentLabel, paymentSummaryLabel, returnKindLabel, returnStatusLabel, shipmentStatusLabel, statusLabel } from "./i18n";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

export type WorkflowPanel = "items" | "shipments" | "documents" | "returns" | "transfers" | "history";
export function OrderWorkflowRead({ orderDocumentArchiveControls, paymentReductionControls, bulkGoodsReturnControls, bulkReceiptControls, shipmentDetailsControls, manualPaymentControls, checkoutControls, discrepancyControls, invoiceControls, transferControls, returnControls, history, workflow, unsupported, locale, panel, onPanelChange, retry, commentControls, cancellationControls, receiptControls, goodsReturnControls }: { orderDocumentArchiveControls?:React.ReactNode; paymentReductionControls?:React.ReactNode; bulkGoodsReturnControls?:React.ReactNode; bulkReceiptControls?:React.ReactNode; shipmentDetailsControls?: (shipment:NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number])=>React.ReactNode; discrepancyControls?: React.ReactNode; manualPaymentControls?: React.ReactNode; checkoutControls?: React.ReactNode; invoiceControls?: React.ReactNode; transferControls?: (claim:OrderWorkflowResponse["claims"][number],index:number)=>React.ReactNode; returnControls?: (record: NonNullable<OrderWorkflowResponse["returns"]>[number]) => React.ReactNode; history?: OrderHistory; goodsReturnControls?: (item: OrderWorkflowResponse["order"]["items"][number]) => React.ReactNode; receiptControls?: (shipment: NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number], item: NonNullable<OrderWorkflowResponse["order"]["shipments"]>[number]["items"][number]) => React.ReactNode; cancellationControls?: React.ReactNode; commentControls?: React.ReactNode; workflow: OrderWorkflowResponse; unsupported: boolean; locale: Locale; panel: WorkflowPanel; onPanelChange: (panel: WorkflowPanel) => void; retry: () => void }) {
  const t = copy[locale]; const order = workflow.order;
  const date = (value: string | null | undefined) => formatTimestamp(value, locale) ?? t.dateUnknown;
  const money = (amount: string | null | undefined, currency: string) => formatMinor(amount ?? null, currency, locale) ?? t.amountUnknown;
  const panels: readonly (readonly [WorkflowPanel, string])[] = [["items", t.composition], ["shipments", t.shipments], ["documents", t.documents], ["returns", t.returns], ["transfers", t.transfers], ...(history ? [["history", orderHistoryCopy[locale].title] as const] : [])];
  const header = <Stack>
    {unsupported && <Notice title={t.unknownStatus} body={t.contractBody} action={<Button label={t.retry} onPress={retry} />} />}
    <Surface><Text kind="subtitle" strong>{order.orderNumber}</Text>
      <Text>{t.supplier}: {order.supplier?.displayName.trim() ? order.supplier.displayName : t.partyUnknown}</Text>
      <Text>{t.buyer}: {order.buyer?.displayName.trim() ? order.buyer.displayName : t.partyUnknown}</Text>
      <Text>{t.createdAt}: {date(order.createdAt)}</Text>
      <Text>{t.status}: {statusLabel(workflow.status, locale)}</Text><Text>{t.payment}: {paymentLabel(workflow.paymentStatus, locale)}</Text>
      <Text>{t.amount}: {formatMinor(order.subtotalAmountMinor, order.currency, locale) ?? t.priceUnknown}</Text>
    </Surface>
    {workflow.paymentSummary ? <Surface><Text kind="subtitle" strong>{t.paymentSummary}</Text>
      <Text>{paymentSummaryLabel(workflow.paymentSummary.status, locale)}</Text>
      <Text>{t.receivedAmount}: {formatMinor(workflow.paymentSummary.confirmedAmountMinor, order.currency, locale) ?? t.priceUnknown}</Text>
      <Text>{t.remainingAmount}: {formatMinor(workflow.paymentSummary.remainingAmountMinor, order.currency, locale) ?? t.priceUnknown}</Text>
      <Text>{t.overpaidAmount}: {formatMinor(workflow.paymentSummary.overpaidAmountMinor, order.currency, locale) ?? t.priceUnknown}</Text>
    </Surface> : <Notice title={t.paymentSummaryUnknown} />}
    <Stack row>{panels.map(([key, label]) => <Button key={key} label={label} tone="tab" selected={panel === key} onPress={() => onPanelChange(key)} />)}</Stack>
    {checkoutControls}{paymentReductionControls}{bulkGoodsReturnControls}{bulkReceiptControls}{discrepancyControls}{commentControls}{cancellationControls}
    {panel === "shipments" && <Text secondary>{t.shipmentsBody}</Text>}
    {panel === "documents" && <><Text secondary>{t.documentsBody}</Text>{invoiceControls}{orderDocumentArchiveControls}</>}
    {panel === "returns" && <Text secondary>{t.returnsBody}</Text>}
    {panel === "transfers" && <><Text secondary>{manualPaymentControls ? (locale === "ru" ? "Заявленный перевод не равен подтверждённому поступлению. Поставщик проверяет поступление денег отдельно." : "Хабарланған аударым расталған түсімге тең емес. Жеткізуші ақшаның түсуін бөлек тексереді.") : t.transfersBody}</Text>{manualPaymentControls}</>}
    {panel === "history" && <Text secondary>{orderHistoryCopy[locale].body}</Text>}
  </Stack>;
  if (panel === "history") return <OrderHistoryRead history={history ?? { state: "unavailable" }} locale={locale} header={header} />;
  // Each section has one virtualized list, and the header/actions scroll with its records.
  if (panel === "shipments") return <FlatList key={panel} data={order.shipments ?? []} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={<Notice title={order.shipments === undefined ? t.shipmentsUnknown : t.shipmentsEmpty} />} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{t.shipment}: {item.shipmentNumber}</Text>
    <Text>{t.shipmentStatus}: {shipmentStatusLabel(item.status, locale)}</Text><Text>{deliveryMethodLabel(item.method, locale)}</Text>
    <Text>{t.carrier}: {item.carrierName?.trim() ? item.carrierName : t.detailsUnknown}</Text><Text>{t.tracking}: {item.trackingNumber?.trim() ? item.trackingNumber : t.detailsUnknown}</Text>
    <Text>{t.deliveryStart}: {date(item.deliveryWindowStart)}</Text><Text>{t.deliveryEnd}: {date(item.deliveryWindowEnd)}</Text>
    <Text>{t.dispatchedAt}: {date(item.dispatchedAt)}</Text><Text>{t.deliveredAt}: {date(item.deliveredAt)}</Text>
    {shipmentDetailsControls?.(item)}
    {!item.items.length && <Text secondary>{t.shipmentItemsEmpty}</Text>}
    {item.items.map((line, index) => <Stack key={line.id}><Text strong>{t.shipmentLine} {index + 1}</Text><Text>{t.shippedQuantity}: {line.quantity}</Text><Text>{t.deliveredQuantity}: {line.deliveredQuantity}</Text>{receiptControls?.(item, line)}</Stack>)}
  </Surface>} />;
  if (panel === "documents") return <FlatList key={panel} data={order.documents ?? []} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={orderDocumentArchiveControls?undefined:<Notice title={order.documents === undefined ? t.documentsUnknown : t.documentsEmpty} />} renderItem={({ item }) => <Surface>
    <Text kind="subtitle" strong>{item.title.trim() ? item.title : documentKindLabel(item.kind, locale)}</Text>
    <Text>{documentKindLabel(item.kind, locale)}</Text><Text>{t.documentNumber}: {item.documentNumber.trim() ? item.documentNumber : t.detailsUnknown}</Text>
    <Text>{t.documentVersion}: {item.version}</Text><Text>{t.documentFormat}: {item.format}</Text><Text>{t.generatedAt}: {date(item.generatedAt)}</Text>
    <Text>{t.documentHash}: {item.checksumSha256 && /^[a-f0-9]{64}$/i.test(item.checksumSha256) ? item.checksumSha256 : t.hashUnknown}</Text>
  </Surface>} />;
  if (panel === "returns") return <FlatList key={panel} data={workflow.returns ?? []} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={<Notice title={workflow.returns === undefined ? t.returnsUnknown : t.returnsEmpty} />} renderItem={({ item, index }) => <Surface>
    {returnControls?.(item)}<Text kind="subtitle" strong>{t.returnRecord} {index + 1}</Text><Text>{returnKindLabel(item.kind, locale)}</Text><Text>{returnStatusLabel(item.status, locale)}</Text>
    <Text>{t.returnAmount}: {money(item.amountMinor, item.currency)}</Text><Text>{t.reason}: {item.reason.trim() ? item.reason : t.detailsUnknown}</Text>
    {item.decisionReason !== null && <Text>{t.decisionReason}: {item.decisionReason.trim() ? item.decisionReason : t.detailsUnknown}</Text>}
    <Text>{t.createdAt}: {date(item.createdAt)}</Text>
    {item.goodsSentAt !== null && <Text>{t.goodsSentAt}: {date(item.goodsSentAt)}</Text>}
    {item.goodsReceivedAt !== null && <Text>{t.goodsReceivedAt}: {date(item.goodsReceivedAt)}</Text>}
    <Text>{t.refundSentAt}: {date(item.refundSentAt)}</Text><Text>{t.refundReceivedAt}: {date(item.refundReceivedAt)}</Text>
    {item.items.map((line, index) => <Stack key={line.orderItemId}><Text strong>{t.returnLine} {index + 1}</Text><Text>{t.quantity}: {line.quantity}</Text><Text>{t.condition}: {line.condition}</Text></Stack>)}
  </Surface>} />;
  if (panel === "transfers") return <FlatList keyboardShouldPersistTaps="handled" key={panel} data={workflow.claims} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={<Notice title={t.transfersEmpty} />} renderItem={({ item, index }) => <Surface>
    <Text kind="subtitle" strong>{t.transferRecord} {index + 1}</Text><Text>{t.claimStatus}: {claimStatusLabel(item.status, locale)}</Text>
    <Text>{t.reportedAmount}: {money(item.amountMinor, item.currency)}</Text><Text>{t.transferReceivedAmount}: {money(item.receivedAmountMinor, item.currency)}</Text>
    <Text>{t.paidAt}: {date(item.paidAt)}</Text><Text>{t.confirmedAt}: {date(item.confirmedAt)}</Text>
    {!!item.comment.trim() && <Text>{t.comment}: {item.comment}</Text>}{transferControls?.(item,index)}
  </Surface>} />;
  return <FlatList key={panel} data={order.items} keyExtractor={item => item.id} contentContainerStyle={styles.list} ListHeaderComponent={header} ListEmptyComponent={<Notice title={t.orderItemsUnknown} />} renderItem={({ item, index }) => {
    const name = item.offer?.productVariant.product.canonicalName;
    return <Surface><Text kind="caption" secondary>{t.orderItem} {index + 1}</Text><Text kind="subtitle" strong>{name?.trim() ? name : t.itemUnknown}</Text>
      <Text>{t.quantity}: {item.quantity}</Text><Text>{t.acceptedQuantity}: {item.acceptedQuantity ?? t.acceptedUnknown}</Text>
      {item.decisionReason !== null && <Text>{t.decisionReason}: {item.decisionReason.trim() ? item.decisionReason : t.detailsUnknown}</Text>}
      <Text>{t.normalized}: {formatMinor(item.unitPriceMinor, item.currency, locale) ?? t.priceUnknown}</Text><Text>{t.lineAmount}: {formatMinor(item.totalPriceMinor, item.currency, locale) ?? t.priceUnknown}</Text>{goodsReturnControls?.(item)}
    </Surface>;
  }} />;
}
const styles = StyleSheet.create({ list: { gap: theme.space.page, paddingBottom: theme.space.section } });
