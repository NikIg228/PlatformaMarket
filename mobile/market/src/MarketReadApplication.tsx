import { NativeShipmentBulkReceiptUi } from "./NativeShipmentBulkReceiptUi";
import { NativeShipmentFulfillmentUi } from "./NativeShipmentFulfillmentUi";
import { NativeOrderDiscrepanciesUi } from "./NativeOrderDiscrepanciesUi";
import { NativeSupportReopenUi } from "./NativeSupportReopenUi";
import type { NativeSupportReopen } from "./native-support-reopen";
import { NativeOrderCheckoutUi } from "./NativeOrderCheckoutUi";
import { CatalogReferenceFiltersUi } from "./CatalogReferenceFiltersUi";
import type { CatalogCommercialValues, CatalogReferenceRow } from "./catalog-commercial-filters";
import { CatalogCommercialFiltersUi, catalogCommercialSummary } from "./CatalogCommercialFiltersUi";
import { ManualTransferUi } from "./ManualTransferUi";
import { OrderInvoicesUi } from "./OrderInvoicesUi";
import type { BuyerReviewUpdates } from "./buyer-review-update";
import { BuyerReviewLauncher, BuyerReviewCreateUi } from "./BuyerReviewCreateUi";
import type { BuyerReviewCreateCommands } from "./buyer-review-create";
import { OfferConversationInboxUi, offerInboxCopy } from "./OfferConversationInboxUi";
import type { OfferInboxPage, OfferInboxRow } from "./offer-conversation-inbox";
import type { OfferConversationEscalate } from "./offer-conversation-escalate";
import type { OfferConversationSupportLinks, OfferSupportOrigin } from "./offer-conversation-support-link";
import { offerSupportCopy } from "./OfferConversationSupportLinkUi";
import type { OfferConversationReadMarker } from "./offer-conversation-read-marker";
import type { OfferConversationResolve } from "./offer-conversation-resolve";
import type { OfferConversationMessages } from "./offer-conversation-messages";
import { OfferConversationRead, OfferConversationLauncher, offerConversationCopy } from "./OfferConversationRead";
import type { OfferConversationSelection, OfferConversationWindow } from "./offer-conversation-read";
import type { OfferConversationDrafts } from "./offer-conversation-draft";
import { OrderConversationInboxUi, conversationInboxCopy } from "./OrderConversationInboxUi";
import type { ConversationInboxPage, ConversationInboxRow } from "./order-conversation-inbox";
import type { OrderConversationEscalate } from "./order-conversation-escalate";
import type { ConversationSupportLinks, ConversationSupportOrigin } from "./conversation-support-link";
import { conversationSupportCopy } from "./ConversationSupportLinkUi";
import type { OrderConversationResolve } from "./order-conversation-resolve";
import type { OrderConversationStart } from "./order-conversation-start";
import type { ConversationReadMarker } from "./order-conversation-read-marker";
import type { OrderConversationSend } from "./order-conversation-send";
import type { OrderConversationDrafts } from "./order-conversation-draft";
import { OrderConversationLauncher, OrderConversationRead, orderConversationCopy } from "./OrderConversationRead";
import type { OrderConversationSelection, OrderConversationWindow } from "./order-conversation-read";
import { MoneyReturnLauncher, MoneyReturnForm, MoneyReturnPanel, MoneyReturnReview, useMoneyReturnState } from "./MoneyReturnCommandUi";
import type { MoneyReturnCommands } from "./money-return-command";
import { TransferSupportLauncher, transferSupportCopy } from "./TransferSupportLinkUi";
import type { TransferSupportLinks, TransferSupportSelection, TransferSupportOrigin } from "./transfer-support-link";
import { PaymentDisputeLauncher, PaymentDisputeForm, PaymentDisputePanel, PaymentDisputeReview, useDisputeState } from "./PaymentDisputeCommandUi";
import type { PaymentDisputeCommands } from "./payment-dispute-command";
import { CompositionLauncher, CompositionPanel, CompositionReview, useCompositionState } from "./OrderCompositionCommandUi";
import type { OrderCompositionCommands } from "./order-composition-command";
import type { OrderCommentEditCommands } from "./order-comment-edit-command";
import { OrderCommentEditForm, OrderCommentEditLauncher, OrderCommentEditReview, OrderCommentEditStatuses, useOrderCommentEditState } from "./OrderCommentEditCommandUi";
import type { OrderCommentCreateCommands } from "./order-comment-create-command";
import { OrderCommentCreateEntry, OrderCommentCreateForm, OrderCommentCreatePanel, OrderCommentCreateReview, useOrderCommentCreateState } from "./OrderCommentCreateCommandUi";
import type { OrderReorderCommands } from "./order-reorder-command";
import { OrderReorderCartNotice, OrderReorderLauncher, OrderReorderPanel, OrderReorderReview, useOrderReorderState } from "./OrderReorderCommandUi";
import type { SavedListRemoveCommands } from "./saved-list-remove-command";
import { SavedListRemoveAction, SavedListRemovePanel, SavedListRemoveReview, useSavedListRemoveState } from "./SavedListRemoveCommandUi";
import type { SavedListCreateCommands } from "./saved-list-create-command";
import { SavedListCreateEntry, SavedListCreateForm, SavedListCreatePanel, SavedListCreateReview, useSavedListCreateState } from "./SavedListCreateCommandUi";
import type { SavedListItemCommands } from "./saved-list-item-command";
import { SavedListSaveDestination, SavedListSaveOfferAction, SavedListSavePanel, SavedListSaveReview, savedListSaveHints, useSavedListItemState } from "./SavedListItemCommandUi";
import type { RefundReceiveCommands } from "./refund-receive-command";
import { RefundReceiveLauncher, RefundReceivePanel, RefundReceiveReview, useRefundReceiveState } from "./RefundReceiveCommandUi";
import type { ReturnSendCommands } from "./return-send-command";
import { ReturnSendLauncher, ReturnSendPanel, ReturnSendReview, useReturnSendState } from "./ReturnSendCommandUi";
import type { GoodsReturnCommands } from "./goods-return-command";
import { GoodsReturnCommandPanel, useGoodsReturnCommandState } from "./GoodsReturnCommandUi";
import type { ShipmentReceiptCommands } from "./shipment-receipt-command";
import { ReceiptCommandPanel, useReceiptCommandState } from "./ShipmentReceiptCommandUi";
import type { OrderCancellationCommands } from "./order-cancellation-command";
import { CancellationCommandPanel, useCancellationCommandState } from "./OrderCancellationCommandUi";
import { CartCheckoutPanel, useCartCheckoutState } from "./CartCheckoutUi";
import type { CartCheckout } from "./cart-checkout-fixture";
import { CartRepricePanel, useCartRepriceState } from "./CartRepriceUi";
import type { CartReprice } from "./cart-reprice-fixture";
import { CartValidationPanel, useCartValidationState } from "./CartValidationUi";
import type { CartValidation } from "./cart-validation-fixture";
import { CartAddCommandPanel, CartAddFromListAction, cartAddQuantityErrorFor, useCartAddCommandState } from "./CartAddCommandUi";
import type { CartAddCommands } from "./cart-add-command-fixture";
import { CartWorkspaceCommandPanel, useCartWorkspaceCommandState } from "./CartWorkspaceCommandUi";
import type { CartWorkspaceCommands } from "./cart-workspace-command-fixture";
import { recoveredCartTarget } from "./recovered-cart-link";
import type { CartQuantityCommands } from "./cart-command-fixture";
import { CartAttemptReadNotice, CartQuantityCommandPanel, cartCommandCopy, useCartCommandState } from "./CartCommandUi";
import type { SupportReplyCommands } from "./support-reply-command-fixture";
import type { SupportCreateCommand } from "./support-command-fixture";
import { ComparisonAttributesRead } from "./ComparisonAttributesRead";
import { CatalogListRead, ComparisonListRead, catalogNextOffset, catalogReadCopy } from "./CatalogRead";
import { searchCatalogSchema } from "../../../packages/schemas/src/index";
import type { CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
import { canAdvanceCursor } from "./cursor-navigation";
import { OrderListRead } from "./OrderListRead";
import type { WorkspaceOrderPage, WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { OrderStatusFilters, orderStatusCopy, orderStatusFilterLabel } from "./OrderStatusFilters";
import { workspaceOrderStatusSchema } from "../../../packages/schemas/src/workspace-reads";
import { projectOrderHistory } from "./order-history-read";
import { NativeOrderDocumentArchiveUi } from "./NativeOrderDocumentArchiveUi";
import { NativeManualRefundProofMetadataUi } from "./NativeManualRefundProofMetadataUi";
import { NativePaymentReductionProposeUi } from "./NativePaymentReductionProposeUi";
import { NativePaymentReductionUi } from "./NativePaymentReductionUi";
import { NativeGoodsReturnBulkUi } from "./NativeGoodsReturnBulkUi";
import { GoodsReturnLauncher, GoodsReturnDraftForm, goodsReturnCopy } from "./GoodsReturnDraftUi";
import type { GoodsReturnDrafts, GoodsReturnTarget } from "./goods-return-draft";
import { ReceiptDraftLauncher, ShipmentReceiptDraftForm, receiptDraftCopy } from "./ShipmentReceiptDraftUi";
import type { ShipmentReceiptDrafts, ReceiptTarget } from "./shipment-receipt-draft";
import { OrderCancellationLauncher, OrderCancellationDraftForm, cancellationCopy } from "./OrderCancellationDraftUi";
import type { OrderCancellationDrafts, CancellationTarget } from "./order-cancellation-draft";
import { ArchiveParticipantMetadata, ArchiveParticipantLauncher, archiveParticipantCopy } from "./ArchiveParticipantMetadata";
import { ArchiveSignatureMetadata, ArchiveSignatureLauncher, archiveSignatureCopy } from "./ArchiveSignatureMetadata";
import { ArchiveVersionHistory, ArchiveHistoryLauncher, archiveHistoryCopy } from "./ArchiveVersionHistory";
import type { ArchiveHistorySelection } from "./archive-version-history";
import { OrderCommentsRead, OrderCommentsLauncher, orderCommentsCopy } from "./OrderCommentsRead";
import type { OrderCommentSelection } from "./order-comments-fixture-read";
import { DeliveryCityRead, cityCopy } from "./DeliveryCityRead";
import { citySnapshot, type PublicCity } from "./public-cities-fixture-read";
import { PublishedReviewsRead, ReviewLaunchers, reviewCopy } from "./PublishedReviewsRead";
import type { ReviewSelection } from "./published-reviews-fixture-read";
import { ArchiveDocumentLinks, archiveLinksCopy } from "./ArchiveDocumentLinks";
import type { ArchiveBaseSelection } from "./document-archive-links";
import { ArchiveDocumentRead, ArchiveFilters, DocumentArchiveRead } from "./DocumentArchiveRead";
import { archiveCopy } from "./document-archive-i18n";
import { archiveFilterDraft, parseArchiveFilterDraft, archiveFiltersUnchanged } from "./archive-filter-draft";
import { parseArchiveInput, type ArchiveInput, type ArchiveFilterFields } from "./document-archive-fixture-read";
import { CheckoutIntentFixtureLink, PaymentIntentRead } from "./PaymentIntentRead";
import { checkoutIntentFixturePointer } from "./payment-intent-fixture-read";
import { BuyerDashboardRead } from "./BuyerDashboardRead";
import { LocalListResume, LocalListOfferAction, LocalListItemEditor, LocalListOverview } from "./LocalListDraftUi";
import type { LocalListDraft, LocalListTarget } from "./local-list-draft";
import { SavedListsRead, SavedListItemsRead } from "./SavedListsRead";
import { SupportReplyLauncher, SupportReplyDraftForm } from "./SupportReplyDraftUi";
import type { SupportReplyDrafts, ReplyDraftTarget } from "./support-reply-draft";
import { SupportDraftLauncher, SupportTicketDraftForm } from "./SupportTicketDraftUi";
import type { SupportTicketDraft } from "./support-ticket-draft";
import { CartQuantityEditor, QuantityDraftUnavailable } from "./CartQuantityDraftUi";
import type { CartResponse, CheckoutResponse } from "../../../packages/schemas/src/core-api";
import type { CartQuantityDrafts } from "./cart-quantity-draft";
import { OrganizationRead } from "./OrganizationRead";
import { CartWorkspaceRead, CartDetailRead, SavedCheckoutRead } from "./CartRead";
import { CatalogFiltersRead } from "./CatalogFiltersRead";
import { supportMessageQuerySchema, supportTicketQuerySchema, type SupportTicketDetail, type SupportTicketSummary } from "../../../packages/schemas/src/support-workflow";
import { SupportListRead, SupportTicketRead } from "./SupportRead";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BackHandler, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { selectComparedOffer } from "../../../contracts/mobile-read/read-adapter";
import type { WorkspaceOrderQuery } from "../../../packages/schemas/src/workspace-reads";
import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import { createReadController, type MarketSession, type MobileReadQuery, type ReadController, type MobileReadState } from "./read-controller";
import { formatMinor, formatTimestamp, type Locale } from "./format-wire";
import { copy, orderGroupLabel, orderGroups, paymentLabel, statusLabel, supportStatuses, supportStatusLabel } from "./i18n";
import { Button, Loading, Notice, Search, Stack, Surface, Text } from "./ui/controls";
import { OrderWorkflowRead, type WorkflowPanel } from "./OrderWorkflowRead";
import { OfferDeliveryRead } from "./OfferDeliveryRead";
import { palette, theme } from "./ui/theme";

type CatalogRoute = { kind: "catalog"; q: string; offset: number; categoryId?: string; supplierOrganizationId?: string; commercial?: CatalogCommercialValues };
type OrderRoute = { kind: "workflow"; orderId: string; panel?: WorkflowPanel } | { kind: "dashboard-order"; orderId: string; panel?: WorkflowPanel };
type OrdersRoute = { kind: "orders"; cursor?: string; q?: string; group?: WorkspaceOrderQuery["group"]; status?: WorkspaceOrderQuery["status"] };
type ReadRoute =
  | {kind:"offer-conversation-inbox";offset:number}
  | {kind:"offer-conversation";target:OfferConversationSelection}
  | {kind:"order-conversation-inbox";offset:number}
  | { kind: "order-status-filter"; anchor: OrdersRoute }
  | { kind: "goods-return-draft"; anchor: OrderRoute; target: GoodsReturnTarget }
  | { kind: "shipment-receipt-draft"; anchor: OrderRoute; target: ReceiptTarget }
  | { kind: "order-cancel-draft"; anchor: OrderRoute; target: CancellationTarget }
  | { kind: "archive-participants"; target: ArchiveHistorySelection }
  | { kind: "archive-signatures"; target: ArchiveHistorySelection }
  | { kind: "archive-history"; target: ArchiveHistorySelection }
  | {kind:"order-conversation";target:OrderConversationSelection}
  | { kind: "order-comments"; target: OrderCommentSelection }
  | { kind: "delivery-city"; anchor: CatalogRoute }
  | { kind: "published-reviews"; target: ReviewSelection }
  | { kind: "archive-related"; target: ArchiveBaseSelection }
  | { kind: "document-archive"; input: ArchiveInput }
  | { kind: "archive-filters"; input: ArchiveInput }
  | { kind: "archive-document"; documentId: string }
  | { kind: "payment-intent"; paymentIntentId: string; checkoutId: string; cartId: string }
  | { kind: "buyer-dashboard" }
  | { kind: "dashboard-order"; orderId: string; panel?: WorkflowPanel }
  | { kind: "saved-lists" }
  | { kind: "saved-list"; listId: string }
  | CatalogRoute
  | (Omit<CatalogRoute,"kind"> & { kind: "catalog-filters" })
  | { kind: "comparison"; productId: string; variantId: string }
  | { kind: "offer"; productId: string; variantId: string; offerId: string }
  | OrdersRoute
  | { kind: "organization" }
  | { kind: "cart"; cursor?: string }
  | { kind: "cart-quantity"; cartId: string; itemId: string; expectedVersion: number; cursor?: string }
  | { kind: "cart-detail"; cartId: string }
  | { kind: "checkout"; checkoutId: string; cartId: string }
  | { kind: "workflow"; orderId: string; panel?: WorkflowPanel }
  | { kind: "support"; offset: number; q: string; status?: SupportTicketSummary["status"]; sort: "queue" | "recent" }
  | { kind: "support-draft"; offset: number; q: string; status?: SupportTicketSummary["status"]; sort: "queue" | "recent" }
  | { kind: "support-ticket"; ticketId: string; beforeMessageId?: string; transferOrigin?:TransferSupportOrigin;conversationOrigin?:ConversationSupportOrigin;offerConversationOrigin?:OfferSupportOrigin }
  | { kind: "support-reply"; ticketId: string; beforeMessageId?: string; draftTarget: ReplyDraftTarget; transferOrigin?:TransferSupportOrigin;conversationOrigin?:ConversationSupportOrigin;offerConversationOrigin?:OfferSupportOrigin };
type Route = ReadRoute | { kind: "local-list"; anchor: ReadRoute } | { kind: "local-list-item"; anchor: ReadRoute; target: LocalListTarget };
const catalogRoute: Route = { kind: "catalog", q: "", offset: 0 };
type Section = "document-archive" | "buyer-dashboard" | "saved-lists" | "catalog" | "orders" | "cart" | "support" | "organization";
type Navigation = { section: Section; "document-archive": Route[]; "buyer-dashboard": Route[]; "saved-lists": Route[]; catalog: Route[]; orders: Route[]; cart: Route[]; support: Route[]; organization: Route[] };

export function MarketReadApplication({ session, locale, onSessionRequired }: { session: MarketSession; locale: Locale; onSessionRequired?: () => void }) {
  const { client } = session;
  const { product, environment, userId, organizationId, generation } = session.scope;
  const controller = useMemo(() => createReadController({ client, scope: { product, environment, userId, organizationId, generation } }), [client, product, environment, userId, organizationId, generation]);
  useEffect(() => () => controller.dispose(), [controller]);
  // A different client or scope also resets navigation/drafts before any old record can render.
  return <Workspace key={controller.identity} controller={controller} organizationName={session.organizationName} userId={userId} locale={locale} onSessionRequired={onSessionRequired} />;
}

function Workspace({ controller, organizationName, userId, locale, onSessionRequired }: { controller: ReadController; organizationName: string; userId: string; locale: Locale; onSessionRequired?: () => void }) {
  useSyncExternalStore(controller.manualTransfer.subscribe, controller.manualTransfer.getSnapshot, controller.manualTransfer.getSnapshot);
  useSyncExternalStore(controller.buyerReviewCreate.subscribe, controller.buyerReviewCreate.getSnapshot, controller.buyerReviewCreate.getSnapshot);
  const t = copy[locale];
  const [navigation, setNavigation] = useState<Navigation>(() => ({ section: "catalog", "document-archive": [{ kind: "document-archive", input: {} }], "buyer-dashboard": [{ kind: "buyer-dashboard" }], "saved-lists": [{ kind: "saved-lists" }], catalog: [catalogRoute], orders: [{ kind: "orders" }], cart: [{ kind: "cart" }], support: [{ kind: "support", offset: 0, q: "", sort: "recent" }], organization: [{ kind: "organization" }] }));
  const a = archiveCopy[locale], c = cityCopy[locale];
  const [appliedCity, setAppliedCity] = useState<PublicCity | null>(null);
  const [appliedInCity, setAppliedInCity] = useState(false);
  const [cityDraftId, setCityDraftId] = useState<string | null>(null);
  const [cityDraftInCity, setCityDraftInCity] = useState(false);
  const [citySearchDraft, setCitySearchDraft] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [archiveSearchDraft, setArchiveSearchDraft] = useState("");
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilterFields>({});
  const [savedListSearch, setSavedListSearch] = useState("");
  const [savedListFilter, setSavedListFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [orderDraft, setOrderDraft] = useState("");
  const [supportDraft, setSupportDraft] = useState("");
  const history = navigation[navigation.section];
  const route = history[history.length - 1]!;
  const updateHistory = useCallback((update: (history: Route[]) => Route[]) => {
    setNavigation((previous) => ({ ...previous, [previous.section]: update(previous[previous.section]) }));
  }, []);
  const push = useCallback((next: Route) => updateHistory((previous) => [...previous, next]), [updateHistory]);
  const replace = useCallback((next: Route) => updateHistory(previous => [...previous.slice(0, -1), next]), [updateHistory]);
  const back = useCallback(() => {
    const current = controller.getSnapshot();
    if (route.kind === "delivery-city" && appliedCity && "read" in current.state && current.state.read.kind === "public-cities") {
      const found = current.state.read.value.find(city => city.id === appliedCity.id && city.nameRu.trim());
      if (!found) { setAppliedCity(null); setAppliedInCity(false); setNavigation(previous => ({ ...previous, catalog: [{ ...route.anchor, offset: 0 }] })); return; }
      setAppliedCity(citySnapshot(found));
    }
    updateHistory(previous => previous.length > 1 ? previous.slice(0, -1) : previous);
  }, [controller, route, appliedCity, updateHistory]);
  const openSection = useCallback((section: Section) => {
    setNavigation((previous) => {
      const saved = previous[section];
      // A tab opens its last list page; Back still walks earlier pages in that tab.
      let listIndex = saved.length - 1;
      while (listIndex > 0 && saved[listIndex]!.kind !== section && !(section === "orders" && saved[listIndex]!.kind === "order-conversation-inbox") && !(section === "catalog" && saved[listIndex]!.kind === "offer-conversation-inbox")) listIndex--;
      return { ...previous, section, [section]: saved.slice(0, listIndex + 1) };
    });
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const current = controller.getSnapshot().state;
      const cartReviewVisible = "read" in current ? current.read.kind === "workspace-carts" : current.phase === "error" || current.phase === "retry-limited";
      if (route.kind === "cart" && cartReviewVisible) {
        const checkout = controller.cartCheckout;
        // Use the same visible review priority and original cart ID as CartWorkspaceRead.
        const checkoutReview = checkout.isAvailable() ? Object.entries(checkout.getSnapshot()).find(([, state]) => state.phase === "prepared" || state.phase === "key-error")?.[0] : undefined;
        if (checkoutReview) {
          if (checkout.cancelPreparation(checkoutReview)) return true;
        } else {
          const reprice = controller.cartReprice;
          if (reprice.isAvailable() && reprice.getSnapshot().phase === "prepared") {
            if (reprice.cancelPreparation()) return true;
          } else {
            const workspace = controller.cartWorkspaceCommands;
            if (workspace.isAvailable() && workspace.getSnapshot().phase === "prepared") {
              workspace.returnToReview();
              if (workspace.getSnapshot().phase === "review") return true;
            } else {
              const addition = controller.cartAddCommands;
              if (addition.isAvailable() && addition.getSnapshot().phase === "prepared") {
                addition.returnToReview();
                if (addition.getSnapshot().phase === "review") return true;
              }
            }
          }
        }
      }
      if (route.kind === "cart-quantity" && cartReviewVisible) {
        const command = controller.cartQuantityCommands, state = command.stateFor(route.cartId);
        if (state.itemId === route.itemId) {
          if (state.phase === "confirm-remove") {
            command.cancelRemove(route.cartId, route.itemId);
            if (command.stateFor(route.cartId).phase === "idle") return true;
          } else if (state.phase === "prepared") {
            command.returnToReview(route.cartId, route.itemId);
            if (command.stateFor(route.cartId).phase === "review") return true;
          }
        }
      }
      const recoverableReadFailure = current.phase === "error" || current.phase === "retry-limited";
      if (route.kind === "saved-lists" || route.kind === "saved-list") {
        const remove = controller.savedListRemoveCommands, item = controller.savedListItemCommands, create = controller.savedListCreateCommands;
        const page = "read" in current && current.read.kind === "saved-lists" ? current.read.value : undefined;
        // Fresh full-screen reviews keep their existing priority below. These are
        // the local controls still visible in the stale/error status panels.
        const stalePanelsVisible = recoverableReadFailure || !!page && !remove.canReview(page) && !item.canReview(page) && !create.canReview(page) && !create.isEditing();
        if (stalePanelsVisible) {
          if (remove.isAvailable() && remove.getSnapshot().phase === "prepared") {
            if (remove.cancelPreparation()) return true;
          } else if (item.isAvailable() && item.getSnapshot().phase === "prepared") {
            if (item.cancelPreparation()) return true;
          } else if (create.isAvailable() && create.getSnapshot().phase === "prepared" && create.editPreparation()) return true;
        }
      }
      if (route.kind === "order-comments") {
        const edit = controller.orderCommentEditCommands, create = controller.orderCommentCreateCommands, id = route.target.orderId;
        const window = "read" in current && current.read.kind === "order-comments" && current.read.value.context.orderId === id ? current.read.value : undefined;
        const stalePanelsVisible = recoverableReadFailure || !!window && !edit.editingId(window) && !edit.canReview(window) && !create.isEditing(id) && !create.canReview(window);
        if (stalePanelsVisible) {
          const prepared = edit.isAvailable() && !edit.authorityIssue() && !edit.isOrderDenied(id) ? Object.entries(edit.getSnapshot()).find(([, state]) => state.orderId === id && state.phase === "prepared" && state.review) : undefined;
          if (prepared) {
            if (edit.editPreparation(prepared[0], prepared[1].review!)) return true;
          } else {
            const state = create.stateFor(id);
            if (create.isAvailable() && !create.authorityIssue() && state.phase === "prepared" && state.review && create.editPreparation(id, state.review)) return true;
          }
        }
      }
      if (route.kind === "workflow" || route.kind === "dashboard-order") {
        const id = route.orderId, composition = controller.orderCompositionCommands, money = controller.moneyReturnCommands, dispute = controller.paymentDisputeCommands;
        const reorder = controller.orderReorderCommands, refund = controller.refundReceiveCommands, returned = controller.returnSendCommands;
        const workflow = "read" in current && current.read.kind === "workflow" && current.read.value.orderId === id ? current.read.value : undefined;
        const freshControlVisible = workflow && (composition.canReview(workflow) || money.canReview(workflow) || money.isEditing(workflow) || dispute.canReview(workflow) || dispute.isEditing(workflow) || reorder.canReview(workflow) || refund.canReview(workflow) || returned.canReview(workflow));
        if (recoverableReadFailure || workflow && !freshControlVisible) {
          if (composition.isAvailable() && !composition.authorityIssue() && !composition.isOrderDenied(id) && composition.stateFor(id).phase === "prepared") {
            if (composition.cancelPreparation(id)) return true;
          } else {
            const moneyState = money.stateFor(id), disputeState = dispute.stateFor(id);
            if (money.isAvailable() && !money.authorityIssue() && !money.isOrderDenied(id) && moneyState.phase === "prepared" && moneyState.review) {
              if (money.editPreparation(id, moneyState.review)) return true;
            } else if (dispute.isAvailable() && !dispute.authorityIssue() && !dispute.isOrderDenied(id) && disputeState.phase === "prepared" && disputeState.review) {
              if (dispute.editPreparation(id, disputeState.review)) return true;
            } else if (reorder.isAvailable() && reorder.stateFor(id).phase === "prepared") {
              if (reorder.cancelPreparation(id)) return true;
            } else if (refund.shouldShow(id, workflow) && ["prepared", "key-error"].includes(refund.stateFor(id).phase)) {
              if (refund.cancel(id)) return true;
            } else if (returned.shouldShow(id, workflow) && ["prepared", "key-error"].includes(returned.stateFor(id).phase) && returned.cancel(id)) return true;
          }
        }
      }
      if ("read" in current) {
        const read = current.read;
        if (route.kind === "order-conversation" && read.kind === "order-conversation" && route.target.orderId === read.value.context.orderId) {
          const window = read.value, start = controller.orderConversationStart, first = start.stateFor(window.context.orderId);
          if (first.phase === "prepared" && first.review && start.edit(first.review)) return true;
          if (start.isEditing(window) && first.editToken && start.pause(window.context.orderId, first.editToken)) return true;
          if (window.conversation) {
            const send = controller.orderConversationSend, state = send.stateFor(window.conversation.id);
            if (state.phase === "prepared" && state.review && send.edit(state.review)) return true;
            const row = controller.orderConversationDrafts.entryFor(window);
            if (row?.started && row.phase === "editing" && controller.orderConversationDrafts.pause(row.target)) return true;
            const resolve = controller.orderConversationResolve, close = resolve.stateFor(window.conversation.id);
            if (close.phase === "prepared" && close.review && resolve.cancel(close.review)) return true;
          }
          const escalate = controller.orderConversationEscalate, escalation = escalate.stateFor(window.context.orderId);
          if (escalation.phase === "prepared" && escalation.review && escalate.edit(escalation.review)) return true;
          if (escalate.isEditing(window) && escalation.editToken && escalate.pause(window.context.orderId, escalation.editToken)) return true;
        }
        if (route.kind === "offer-conversation" && read.kind === "offer-conversation" && route.target.offerId === read.value.context.offerId) {
          const window = read.value, messages = controller.offerConversationMessages, state = messages.stateFor(window.context.offerId);
          if (state.phase === "prepared" && state.review && messages.edit(state.review)) return true;
          const drafts = controller.offerConversationDrafts, row = drafts.entryFor(window);
          if (row && drafts.isEditing(window) && drafts.pause(row.target)) return true;
          if (window.conversation) {
            const resolve = controller.offerConversationResolve, close = resolve.stateFor(window.conversation.id);
            if (close.phase === "prepared" && close.review && resolve.cancel(close.review)) return true;
          }
          const escalate = controller.offerConversationEscalate, escalation = escalate.stateFor(window.context.offerId);
          if (escalation.phase === "prepared" && escalation.review && escalate.edit(escalation.review)) return true;
          if (escalate.isEditing(window) && escalation.editToken && escalate.pause(window.context.offerId, escalation.editToken)) return true;
        }
        if ((route.kind === "saved-lists" || route.kind === "saved-list") && read.kind === "saved-lists") {
          const remove = controller.savedListRemoveCommands, item = controller.savedListItemCommands;
          // Match the visible review priority; never change a hidden draft.
          if (remove.canReview(read.value)) {
            if (remove.cancelPreparation()) return true;
          } else if (item.canReview(read.value)) {
            if (item.cancelPreparation()) return true;
          } else {
            const create = controller.savedListCreateCommands;
            if (create.canReview(read.value) && create.editPreparation()) return true;
            if (create.isEditing() && create.pause()) return true;
          }
        }
        if ((route.kind === "workflow" || route.kind === "dashboard-order") && read.kind === "workflow" && route.orderId === read.value.orderId) {
          const workflow = read.value, id = workflow.orderId, composition = controller.orderCompositionCommands;
          if (composition.canReview(workflow)) {
            if (composition.cancelPreparation(id)) return true;
          } else {
            const money = controller.moneyReturnCommands, moneyState = money.stateFor(id);
            if (money.canReview(workflow)) {
              if (moneyState.review && money.editPreparation(id, moneyState.review)) return true;
            } else if (money.isEditing(workflow)) {
              if (moneyState.editToken && money.pause(id, moneyState.editToken)) return true;
            } else {
              const dispute = controller.paymentDisputeCommands, state = dispute.stateFor(id);
              if (dispute.canReview(workflow)) {
                if (state.review && dispute.editPreparation(id, state.review)) return true;
              } else if (dispute.isEditing(workflow)) {
                if (state.editToken && dispute.pause(id, state.editToken)) return true;
              } else if (controller.orderReorderCommands.canReview(workflow)) {
                if (controller.orderReorderCommands.cancelPreparation(id)) return true;
              } else if (controller.refundReceiveCommands.canReview(workflow)) {
                if (controller.refundReceiveCommands.cancel(id)) return true;
              } else if (controller.returnSendCommands.canReview(workflow) && controller.returnSendCommands.cancel(id)) return true;
            }
          }
        }
        if (route.kind === "order-comments" && read.kind === "order-comments" && route.target.orderId === read.value.context.orderId) {
          const edit = controller.orderCommentEditCommands, editingId = edit.editingId(read.value);
          if (editingId) {
            const token = edit.stateFor(editingId).editToken;
            if (token && edit.pause(editingId, token)) return true;
          }
          const reviewId = edit.canReview(read.value);
          if (reviewId) {
            const review = edit.stateFor(reviewId).review;
            if (review && edit.editPreparation(reviewId, review)) return true;
          }
          const create = controller.orderCommentCreateCommands, id = read.value.context.orderId, state = create.stateFor(id);
          if (create.isEditing(id) && state.formKey && create.pause(id, state.formKey)) return true;
          if (create.canReview(read.value) && state.review && create.editPreparation(id, state.review)) return true;
        }
      }
      if (history.length < 2) return false;
      back(); return true;
    });
    return () => subscription.remove();
  }, [back, history.length, controller, route]);

  const anchoredRoute = route.kind === "local-list" || route.kind === "local-list-item" ? route.anchor : route;
  const readRoute = anchoredRoute.kind === "order-status-filter" || anchoredRoute.kind === "order-cancel-draft" || anchoredRoute.kind === "shipment-receipt-draft" || anchoredRoute.kind === "goods-return-draft" ? anchoredRoute.anchor : anchoredRoute;
  const mode = readRoute.kind === "archive-filters" ? "document-archive" : readRoute.kind === "saved-list" ? "saved-lists" : readRoute.kind === "support-reply" ? "support-ticket" : readRoute.kind === "support-draft" ? "support" : readRoute.kind === "cart-quantity" ? "cart" : readRoute.kind === "offer" ? "comparison" : readRoute.kind === "catalog-filters" ? "catalog" : readRoute.kind;
  const catalogActive = readRoute.kind === "catalog" || readRoute.kind === "catalog-filters";
  const catalogCityId = catalogActive && appliedInCity ? appliedCity?.id : undefined;
  const comparisonCityId = mode === "comparison" ? appliedCity?.id : undefined;
  const productId = "productId" in readRoute ? readRoute.productId : "";
  const variantId = "variantId" in readRoute ? readRoute.variantId : "";
  const orderId = readRoute.kind === "workflow" || readRoute.kind === "dashboard-order" ? readRoute.orderId : "";
  const q = catalogActive ? readRoute.q : "";
  const offset = catalogActive ? readRoute.offset : 0;
  const categoryId = catalogActive ? readRoute.categoryId : undefined;
  const supplierOrganizationId = catalogActive ? readRoute.supplierOrganizationId : undefined;
  const commercialKey = JSON.stringify(catalogActive ? readRoute.commercial ?? {} : {});
  const requestFilterOptions = readRoute.kind === "catalog-filters" && controller.catalogCommercial.supported();
  const cursor = readRoute.kind === "orders" ? readRoute.cursor : undefined;
  const orderQuery = readRoute.kind === "orders" ? readRoute.q : undefined;
  const orderGroup = readRoute.kind === "orders" ? readRoute.group : undefined;
  const orderStatus = readRoute.kind === "orders" ? readRoute.status : undefined;
  const supportListRoute = readRoute.kind === "support" || readRoute.kind === "support-draft";
  const supportQ = supportListRoute ? readRoute.q : "";
  const supportOffset = supportListRoute ? readRoute.offset : 0;
  const supportStatus = supportListRoute ? readRoute.status : undefined;
  const supportSort = supportListRoute ? readRoute.sort : "recent";
  const ticketId = readRoute.kind === "support-ticket" || readRoute.kind === "support-reply" ? readRoute.ticketId : "";
  const beforeMessageId = readRoute.kind === "support-ticket" || readRoute.kind === "support-reply" ? readRoute.beforeMessageId : undefined;
  const cartCursor = readRoute.kind === "cart" || readRoute.kind === "cart-quantity" ? readRoute.cursor : undefined;
  const cartId = readRoute.kind === "cart-detail" || readRoute.kind === "checkout" ? readRoute.cartId : "";
  const checkoutId = readRoute.kind === "checkout" ? readRoute.checkoutId : "";
  const paymentIntentId = readRoute.kind === "payment-intent" ? readRoute.paymentIntentId : "";
  const intentCheckoutId = readRoute.kind === "payment-intent" ? readRoute.checkoutId : "";
  const archiveInput = readRoute.kind === "document-archive" || readRoute.kind === "archive-filters" ? readRoute.input : undefined;
  const archiveQ = archiveInput?.q, archiveView = archiveInput?.view, archiveCategory = archiveInput?.category, archiveKind = archiveInput?.kind, archiveStatus = archiveInput?.status, archiveAccountingStatus = archiveInput?.accountingStatus, archiveDateFrom = archiveInput?.dateFrom, archiveDateTo = archiveInput?.dateTo, archiveCursor = archiveInput?.cursor, archiveLimit = archiveInput?.limit;
  const offerConversationTarget=readRoute.kind==="offer-conversation"?readRoute.target:undefined;
  const offerInboxOffset=readRoute.kind==="offer-conversation-inbox"?readRoute.offset:0;
  const conversationInboxOffset=readRoute.kind==="order-conversation-inbox"?readRoute.offset:0;
  const orderConversationTarget=readRoute.kind==="order-conversation"?readRoute.target:undefined;
  const orderCommentsTarget = readRoute.kind === "order-comments" ? readRoute.target : undefined;
  const reviewTarget = readRoute.kind === "published-reviews" ? readRoute.target : undefined;
  const archiveParticipantTarget = readRoute.kind === "archive-participants" ? readRoute.target : undefined;
  const archiveSignatureTarget = readRoute.kind === "archive-signatures" ? readRoute.target : undefined;
  const archiveHistoryTarget = readRoute.kind === "archive-history" ? readRoute.target : undefined;
  const archiveRelatedTarget = readRoute.kind === "archive-related" ? readRoute.target : undefined;
  const archiveDocumentId = readRoute.kind === "archive-document" ? readRoute.documentId : "";
  const offerSupportOrigin=readRoute.kind==="support-ticket"||readRoute.kind==="support-reply"?readRoute.offerConversationOrigin:undefined;
  const conversationSupportOrigin=readRoute.kind==="support-ticket"||readRoute.kind==="support-reply"?readRoute.conversationOrigin:undefined;
  const query = useMemo<MobileReadQuery>(() => {
    switch (mode) {
      case "offer-conversation-inbox":return {kind:"offer-conversation-inbox",offset:offerInboxOffset};
      case "offer-conversation":return {kind:"offer-conversation",target:offerConversationTarget!};
      case "order-conversation-inbox":return {kind:"order-conversation-inbox",offset:conversationInboxOffset};
      case "order-conversation":return {kind:"order-conversation",target:orderConversationTarget!};
      case "order-comments": return { kind: "order-comments", target: orderCommentsTarget! };
      case "delivery-city": return { kind: "public-cities" };
      case "published-reviews": return { kind: "published-reviews", target: reviewTarget! };
      case "archive-participants": return { kind: "archive-participants", target: archiveParticipantTarget! };
      case "archive-signatures": return { kind: "archive-signatures", target: archiveSignatureTarget! };
      case "archive-history": return { kind: "archive-history", target: archiveHistoryTarget! };
      case "archive-related": return { kind: "archive-related", target: archiveRelatedTarget! };
      case "document-archive": return { kind: "document-archive", input: { ...(archiveQ === undefined ? {} : { q: archiveQ }), ...(archiveView === undefined ? {} : { view: archiveView }), ...(archiveCategory === undefined ? {} : { category: archiveCategory }), ...(archiveKind === undefined ? {} : { kind: archiveKind }), ...(archiveStatus === undefined ? {} : { status: archiveStatus }), ...(archiveAccountingStatus === undefined ? {} : { accountingStatus: archiveAccountingStatus }), ...(archiveDateFrom === undefined ? {} : { dateFrom: archiveDateFrom }), ...(archiveDateTo === undefined ? {} : { dateTo: archiveDateTo }), ...(archiveCursor === undefined ? {} : { cursor: archiveCursor }), ...(archiveLimit === undefined ? {} : { limit: archiveLimit }) } };
      case "archive-document": return { kind: "archive-document", documentId: archiveDocumentId };
      case "payment-intent": return { kind: "payment-intent", paymentIntentId, checkoutId: intentCheckoutId };
      case "buyer-dashboard": return { kind: "buyer-dashboard" };
      case "dashboard-order": return { kind: "dashboard-order", orderId };
      case "saved-lists": return { kind: "saved-lists" };
      case "catalog": return { kind: "catalog", input: { q, offset, ...(JSON.parse(commercialKey) as CatalogCommercialValues), ...(requestFilterOptions ? { includeFilterOptions: "true" as const } : {}), ...(catalogCityId === undefined ? {} : { cityId: catalogCityId }), ...(categoryId === undefined ? {} : { categoryId }), ...(supplierOrganizationId === undefined ? {} : { supplierOrganizationId }) } };
      case "comparison": return { kind: "comparison", input: { productId, variantId, ...(comparisonCityId === undefined ? {} : { cityId: comparisonCityId }) } };
      case "workflow": return { kind: "workflow", orderId };
      case "orders": return { kind: "workspace-orders", input: { ...(cursor === undefined ? {} : { cursor }), ...(orderQuery === undefined ? {} : { q: orderQuery }), ...(orderGroup === undefined ? {} : { group: orderGroup }), ...(orderStatus === undefined ? {} : { status: orderStatus }) } };
      case "organization": return { kind: "organization-profile" };
      case "cart": return { kind: "workspace-carts", input: { limit: 1, ...(cartCursor === undefined ? {} : { cursor: cartCursor }) } };
      case "cart-detail": return { kind: "cart", cartId };
      case "checkout": return { kind: "checkout", checkoutId, cartId };
      case "support": return { kind: "support-tickets", input: { offset: supportOffset, q: supportQ, sort: supportSort, ...(supportStatus === undefined ? {} : { status: supportStatus }) } };
      case "support-ticket": if(offerSupportOrigin)return {kind:"offer-conversation-support-ticket",origin:offerSupportOrigin,...(beforeMessageId===undefined?{}:{beforeMessageId})}; if(conversationSupportOrigin)return {kind:"conversation-support-ticket",origin:conversationSupportOrigin,...(beforeMessageId===undefined?{}:{beforeMessageId})}; return { kind: "support-ticket", ticketId, ...(beforeMessageId === undefined ? {} : { beforeMessageId }) };
    }
  }, [commercialKey, requestFilterOptions, mode, offerInboxOffset, offerSupportOrigin, offerConversationTarget, conversationInboxOffset, conversationSupportOrigin, orderConversationTarget, orderCommentsTarget, catalogCityId, comparisonCityId, reviewTarget, archiveRelatedTarget, archiveHistoryTarget, archiveSignatureTarget, archiveParticipantTarget, archiveQ, archiveView, archiveCategory, archiveKind, archiveStatus, archiveAccountingStatus, archiveDateFrom, archiveDateTo, archiveCursor, archiveLimit, archiveDocumentId, paymentIntentId, intentCheckoutId, productId, variantId, orderId, q, offset, cursor, orderQuery, orderGroup, orderStatus, supportOffset, supportQ, supportSort, supportStatus, ticketId, beforeMessageId, categoryId, supplierOrganizationId, cartCursor, cartId, checkoutId]);
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.load(query); }, [controller, query]);
  const queryKey = JSON.stringify(query);
  // Route changes render before effects run. Never display the preceding query's data.
  const state: MobileReadState = view.queryKey === queryKey ? view.state : { phase: "loading", target: { kind: "catalog" } };
  const pending = state.phase === "loading" || state.phase === "idle";
  const retry = () => { void controller.retry(); };
  const refresh = () => {
    // The store changes synchronously, protecting a second press before React commits.
    const current = controller.getSnapshot();
    if (current.queryKey === queryKey && "read" in current.state) void controller.retry();
  };
  const openQuantityDraft = (cart: CartResponse, item: CartResponse["items"][number]) => {
    const current = controller.getSnapshot();
    if (route.kind !== "cart" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workspace-carts" || current.state.read.value.current !== cart || !cart.items.includes(item) || !controller.quantityDrafts.begin(cart, item)) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-quantity", cartId: cart.id, itemId: item.id, expectedVersion: cart.version, ...(route.cursor === undefined ? {} : { cursor: route.cursor }) }] });
  };
  const openSupportTicketDraft = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "support" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "support-tickets" || !controller.supportTicketDraft.begin()) return;
    updateHistory(previous => previous.at(-1)?.kind === "support-draft" ? previous : [...previous, { ...route, kind: "support-draft" }]);
  };
  const openSupportReply = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "support-ticket" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "support-ticket") return;
    if(route.transferOrigin&&!controller.transferSupportLinks.accepts(current.state.read.value,route.transferOrigin))return;
    if(route.offerConversationOrigin&&!controller.offerConversationSupportLinks.accepts(current.state.read.value,route.offerConversationOrigin))return;
    if(route.conversationOrigin&&!controller.conversationSupportLinks.accepts(current.state.read.value,route.conversationOrigin))return;
    const draftTarget = controller.supportReplyDrafts.begin(current.state.read.value);
    if (!draftTarget) return;
    updateHistory(previous => previous.at(-1)?.kind === "support-reply" ? previous : [...previous, { ...route, kind: "support-reply", draftTarget }]);
  };
  const editLocalListItem = (target: LocalListTarget) => {
    if (!controller.localListDraft.entryFor(target)) return;
    updateHistory(previous => { const last = previous.at(-1); return last?.kind === "local-list-item" && last.target === target ? previous : [...previous, { kind: "local-list-item", anchor: readRoute, target }]; });
  };
  const selectLocalListOffer = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "offer" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "comparison") return;
    const target = controller.localListDraft.begin(current.state.read.value, route.offerId);
    if (target) editLocalListItem(target);
  };
  const openLocalList = () => {
    const current = controller.getSnapshot();
    if (!controller.localListDraft.getSnapshot().started || current.queryKey !== queryKey || !("read" in current.state)) return;
    updateHistory(previous => previous.at(-1)?.kind === "local-list" ? previous : [...previous, { kind: "local-list", anchor: readRoute }]);
  };
  const cancelLocalList = () => {
    controller.localListDraft.cancelAll();
    updateHistory(previous => { let end = previous.length; while (end > 1 && ["local-list", "local-list-item"].includes(previous[end - 1]!.kind)) end--; return previous.slice(0, end); });
  };
  const readLocalOfferForCart = (target: LocalListTarget) => {
    const current = controller.getSnapshot();
    if (route.kind !== "local-list-item" || route.target !== target || !controller.localListDraft.entryFor(target) || current.queryKey !== queryKey || !("read" in current.state)) return;
    updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "local-list-item", target, anchor: { kind: "offer", productId: target.productId, variantId: target.variantId, offerId: target.offerId } }]);
  };
  const cartAdditionSelected = () => {
    const current = controller.getSnapshot(), selected = controller.cartAddCommands.getSnapshot();
    if (route.kind !== "local-list-item" || selected.phase !== "selected" || selected.choice?.target !== route.target || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "comparison") return;
    setNavigation(previous => {
      if (previous.section !== navigation.section || previous[previous.section].at(-1) !== route) return previous;
      const saved = previous.cart; let index = saved.length - 1;
      while (index > 0 && saved[index]!.kind !== "cart") index--;
      return { ...previous, section: "cart", cart: saved.slice(0, index + 1) };
    });
  };
  const openSavedListsForWrite = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "local-list-item" || !controller.supportsSavedListsFixtures || !controller.savedListItemCommands.isAvailable() || !controller.localListDraft.entryFor(route.target) || current.queryKey !== queryKey || !("read" in current.state)) return;
    setNavigation(previous => {
      if (previous.section !== navigation.section || previous[previous.section].at(-1) !== route) return previous;
      const history = previous["saved-lists"]; let index = history.length - 1;
      while (index >= 0 && history[index]!.kind !== "saved-lists" && history[index]!.kind !== "saved-list") index--;
      return { ...previous, section: "saved-lists", "saved-lists": index >= 0 ? history.slice(0, index + 1) : [{ kind: "saved-lists" }] };
    });
  };
  const startSavedListHeaderFromDraft = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "local-list" || !controller.supportsSavedListsFixtures || !controller.localListDraft.getSnapshot().started || current.queryKey !== queryKey || !("read" in current.state)) return;
    if (!controller.savedListCreateCommands.start(controller.localListDraft.getSnapshot().name)) return;
    setNavigation(previous => {
      if (previous.section !== navigation.section || previous[previous.section].at(-1) !== route) return previous;
      const history = previous["saved-lists"]; let index = history.length - 1;
      while (index >= 0 && history[index]!.kind !== "saved-lists" && history[index]!.kind !== "saved-list") index--;
      return { ...previous, section: "saved-lists", "saved-lists": index >= 0 ? history.slice(0, index + 1) : [{ kind: "saved-lists" }] };
    });
  };
  const openPaymentIntent = () => {
    const current = controller.getSnapshot();
    if (!controller.supportsPaymentIntentFixture || route.kind !== "checkout" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "checkout") return;
    const checkout = current.state.read.value, pointer = checkoutIntentFixturePointer(checkout, controller.buyerOrganizationId);
    if (pointer.kind !== "available") return;
    updateHistory(previous => previous.at(-1)?.kind === "payment-intent" ? previous : [...previous, { kind: "payment-intent", paymentIntentId: pointer.id, checkoutId: checkout.id, cartId: checkout.cartId }]);
  };
  const openArchiveFilters = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "document-archive" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "document-archive") return;
    setArchiveFilters(archiveFilterDraft(route.input));
    updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { ...route, kind: "archive-filters" }]);
  };
  const applyArchiveFilters = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "archive-filters" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "document-archive") return;
    const selected = parseArchiveFilterDraft(archiveFilters); if (!selected) return;
    const unchanged = archiveFiltersUnchanged(route.input, selected);
    const input = parseArchiveInput({ ...selected, ...(route.input.q === undefined ? {} : { q: route.input.q }), ...(route.input.limit === undefined ? {} : { limit: route.input.limit }) });
    if (input) setNavigation(previous => previous.section !== "document-archive" || previous["document-archive"].at(-1) !== route ? previous : ({ ...previous, "document-archive": unchanged ? previous["document-archive"].slice(0, -1) : [{ kind: "document-archive", input }] }));
  };
  const searchArchive = (q: string) => {
    if (route.kind !== "document-archive") return;
    const { cursor: _cursor, ...rest } = route.input, input = parseArchiveInput({ ...rest, q });
    if (input) setNavigation(previous => ({ ...previous, "document-archive": [{ kind: "document-archive", input }] }));
  };
  const archiveVisited = history.flatMap(item => item.kind === "document-archive" && item.input.cursor ? [item.input.cursor] : []);
  const openGoodsReturnDraft = (itemId: string) => {
    const current = controller.getSnapshot();
    if ((route.kind !== "workflow" && route.kind !== "dashboard-order") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workflow" || current.state.read.value.orderId !== route.orderId) return;
    const workflow = current.state.read.value, item = workflow.order.items.find(row => row.id === itemId); if (!item) return;
    const target = controller.goodsReturnDrafts.begin(workflow, item);
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "goods-return-draft", anchor: route, target }]);
  };
  const closeGoodsReturnDraft = () => {
    if (route.kind !== "goods-return-draft") return;
    updateHistory(previous => { const current = previous.at(-1); return current?.kind === "goods-return-draft" && current.target === route.target ? previous.slice(0, -1) : previous; });
  };
  const openReceiptDraft = (shipmentId: string, itemId: string) => {
    const current = controller.getSnapshot();
    if ((route.kind !== "workflow" && route.kind !== "dashboard-order") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workflow" || current.state.read.value.orderId !== route.orderId) return;
    const workflow = current.state.read.value, shipment = workflow.order.shipments?.find(row => row.id === shipmentId), item = shipment?.items.find(row => row.id === itemId); if (!shipment || !item) return;
    const target = controller.receiptDrafts.begin(workflow, shipment, item);
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "shipment-receipt-draft", anchor: route, target }]);
  };
  const closeReceiptDraft = () => {
    if (route.kind !== "shipment-receipt-draft") return;
    updateHistory(previous => { const current = previous.at(-1); return current?.kind === "shipment-receipt-draft" && current.target === route.target ? previous.slice(0, -1) : previous; });
  };
  const openCancellationDraft = () => {
    const current = controller.getSnapshot();
    if ((route.kind !== "workflow" && route.kind !== "dashboard-order") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workflow" || current.state.read.value.orderId !== route.orderId) return;
    const target = controller.cancellationDrafts.begin(current.state.read.value);
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "order-cancel-draft", anchor: route, target }]);
  };
  const closeCancellationDraft = () => {
    if (route.kind !== "order-cancel-draft") return;
    updateHistory(previous => { const current = previous.at(-1); return current?.kind === "order-cancel-draft" && current.target === route.target ? previous.slice(0, -1) : previous; });
  };
  const openOfferInbox=()=>{const current=controller.getSnapshot();if(route.kind!=="catalog"||!controller.supportsOfferConversationInbox()||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="catalog")return;updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation-inbox",offset:0}]);};
  const nextOfferInbox=(page:OfferInboxPage)=>{const current=controller.getSnapshot();if(route.kind!=="offer-conversation-inbox"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="offer-conversation-inbox"||current.state.read.value!==page||page.openingId||page.nextOffset===null)return;updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation-inbox",offset:page.nextOffset!}]);};
  const openOfferInboxHistory=(page:OfferInboxPage,row:OfferInboxRow)=>{const current=controller.getSnapshot();if(route.kind!=="offer-conversation-inbox"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="offer-conversation-inbox"||current.state.read.value!==page)return;const target=controller.openOfferInboxHistory(page,row);if(target)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation",target}]);};
  const openOfferInboxConversation=async(page:OfferInboxPage,row:OfferInboxRow)=>{const current=controller.getSnapshot();if(route.kind!=="offer-conversation-inbox"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="offer-conversation-inbox"||current.state.read.value!==page)return;const target=await controller.openOfferInboxConversation(page,row),latest=controller.getSnapshot();if(target&&latest.queryKey===queryKey&&"read"in latest.state&&latest.state.read.kind==="offer-conversation-inbox")updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation",target}]);};
  const openOfferConversation=()=>{const current=controller.getSnapshot();if(route.kind!=="offer"||!controller.supportsOfferConversation()||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="comparison")return;const target=controller.selectOfferConversation(route.productId,route.variantId,route.offerId);if(target)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation",target}]);};
  const openOfferSupport=(window:OfferConversationWindow)=>{const current=controller.getSnapshot();if(route.kind!=="offer-conversation"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="offer-conversation"||current.state.read.value!==window)return;const target=controller.offerConversationSupportLinks.select(window),origin=target?controller.offerConversationSupportLinks.take(target):null;if(origin)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"support-ticket",ticketId:origin.ticketId,offerConversationOrigin:origin}]);};
  const olderOfferConversation=(window:OfferConversationWindow)=>{const current=controller.getSnapshot();if(route.kind!=="offer-conversation"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="offer-conversation"||current.state.read.value!==window)return;const target=controller.olderOfferConversation(window);if(target)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"offer-conversation",target}]);};
  const openConversationInbox=()=>{const current=controller.getSnapshot();if(route.kind!=="orders"||!controller.supportsOrderConversationInbox()||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="workspace-orders")return;updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"order-conversation-inbox",offset:0}]);};
  const nextConversationInbox=(page:ConversationInboxPage)=>{const current=controller.getSnapshot();if(route.kind!=="order-conversation-inbox"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="order-conversation-inbox"||current.state.read.value!==page||page.openingId||page.nextOffset===null)return;updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"order-conversation-inbox",offset:page.nextOffset!}]);};
  const openInboxConversation=async(page:ConversationInboxPage,row:ConversationInboxRow)=>{const current=controller.getSnapshot();if(route.kind!=="order-conversation-inbox"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="order-conversation-inbox"||current.state.read.value!==page)return;const target=await controller.openInboxConversation(page,row),latest=controller.getSnapshot();if(target&&latest.queryKey===queryKey&&"read"in latest.state&&latest.state.read.kind==="order-conversation-inbox")updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"order-conversation",target}]);};
  const openConversationSupport=(window:OrderConversationWindow)=>{const current=controller.getSnapshot();if(route.kind!=="order-conversation"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="order-conversation"||current.state.read.value!==window)return;const target=controller.conversationSupportLinks.select(window),origin=target?controller.conversationSupportLinks.take(target):null;if(origin)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"support-ticket",ticketId:origin.ticketId,conversationOrigin:origin}]);};
  const openOrderConversation=()=>{const current=controller.getSnapshot();if(!controller.supportsOrderConversationFixtures||(route.kind!=="workflow"&&route.kind!=="dashboard-order")||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="workflow"||current.state.read.value.orderId!==route.orderId)return;const target=controller.selectOrderConversation();if(target)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"order-conversation",target}]);};
  const olderOrderConversation=(window:OrderConversationWindow)=>{const current=controller.getSnapshot();if(route.kind!=="order-conversation"||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="order-conversation"||current.state.read.value!==window)return;const target=controller.olderOrderConversation(window);if(target)updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"order-conversation",target}]);};
  const openOrderComments = () => {
    const current = controller.getSnapshot();
    if (!controller.supportsOrderCommentFixtures || (route.kind !== "workflow" && route.kind !== "dashboard-order") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workflow" || current.state.read.value.orderId !== route.orderId) return;
    const target = controller.selectOrderComments();
    if (target) updateHistory(previous => previous.at(-1)?.kind === "order-comments" ? previous : [...previous, { kind: "order-comments", target }]);
  };
  const openCityPicker = () => {
    const current = controller.getSnapshot();
    if (!controller.supportsPublicCityFixtures || route.kind !== "catalog" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "catalog") return;
    setCityDraftId(appliedCity?.id ?? null); setCityDraftInCity(appliedInCity); setCitySearchDraft(""); setCityFilter("");
    updateHistory(previous => previous.at(-1)?.kind === "delivery-city" ? previous : [...previous, { kind: "delivery-city", anchor: route }]);
  };
  const selectCityDraft = (id: string | null) => {
    const current = controller.getSnapshot();
    if (route.kind !== "delivery-city" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "public-cities" || (id !== null && !current.state.read.value.some(city => city.id === id && city.nameRu.trim()))) return;
    setCityDraftId(id); if (id === null) setCityDraftInCity(false);
  };
  const selectCityFilterMode = (value: boolean) => {
    const current = controller.getSnapshot();
    if (route.kind !== "delivery-city" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "public-cities" || (value && !current.state.read.value.some(city => city.id === cityDraftId && city.nameRu.trim()))) return;
    setCityDraftInCity(value);
  };
  const applyCity = () => {
    const current = controller.getSnapshot();
    if (route.kind !== "delivery-city" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "public-cities") return;
    const selected = current.state.read.value.find(city => city.id === cityDraftId && city.nameRu.trim()); if (cityDraftId !== null && !selected) return;
    const inCity = !!selected && cityDraftInCity;
    if ((selected?.id ?? null) === (appliedCity?.id ?? null) && inCity === appliedInCity) { back(); return; }
    setAppliedCity(selected ? citySnapshot(selected) : null); setAppliedInCity(inCity);
    setNavigation(previous => ({ ...previous, catalog: [{ ...route.anchor, offset: 0 }] }));
  };
  const openReviews = (offerId?: string) => {
    const current = controller.getSnapshot();
    if ((route.kind !== "comparison" && route.kind !== "offer") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "comparison" || current.state.read.value.product.id !== route.productId || current.state.read.value.selectedVariantId !== route.variantId) return;
    if (offerId !== undefined && (route.kind !== "offer" || route.offerId !== offerId || !controller.supportsSupplierReviewFixtures)) return;
    if (offerId === undefined && !controller.supportsProductReviewFixtures) return;
    const target = offerId === undefined ? controller.selectProductReviews() : controller.selectSupplierReviews(offerId);
    if (target) updateHistory(previous => previous.at(-1)?.kind === "published-reviews" ? previous : [...previous, { kind: "published-reviews", target }]);
  };
  const openArchiveParticipants = () => {
    const current = controller.getSnapshot();
    if ((route.kind !== "archive-document" && route.kind !== "archive-related") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "archive-document") return;
    const target = controller.selectArchiveParticipants();
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "archive-participants", target }]);
  };
  const openArchiveSignatures = () => {
    const current = controller.getSnapshot();
    if ((route.kind !== "archive-document" && route.kind !== "archive-related") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "archive-document") return;
    const target = controller.selectArchiveSignatures();
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "archive-signatures", target }]);
  };
  const openArchiveHistory = () => {
    const current = controller.getSnapshot();
    if ((route.kind !== "archive-document" && route.kind !== "archive-related") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "archive-document") return;
    const target = controller.selectArchiveHistory();
    if (target) updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "archive-history", target }]);
  };
  const openArchiveBase = (target: ArchiveBaseSelection) => {
    const current = controller.getSnapshot();
    if ((route.kind !== "archive-document" && route.kind !== "archive-related") || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "archive-document" || current.state.read.value.id !== target.parentDocumentId || current.state.read.value.version !== target.parentVersion || current.state.read.links.base.state !== "available" || current.state.read.links.base.target !== target) return;
    updateHistory(previous => { const last = previous.at(-1); return last?.kind === "archive-related" && last.target === target ? previous : [...previous, { kind: "archive-related", target }]; });
  };
  const openArchiveDocument = (documentId: string) => {
    const current = controller.getSnapshot();
    if (route.kind !== "document-archive" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "document-archive" || !current.state.read.value.page.items.some(item => item.id === documentId)) return;
    updateHistory(previous => previous.at(-1)?.kind === "archive-document" ? previous : [...previous, { kind: "archive-document", documentId }]);
  };
  const nextArchive = (cursor: string) => {
    const current = controller.getSnapshot();
    if (route.kind !== "document-archive" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "document-archive" || current.state.read.value.pagination !== "provided" || current.state.read.value.page.nextCursor !== cursor) return;
    updateHistory(previous => previous.some(item => item.kind === "document-archive" && item.input.cursor === cursor) ? previous : [...previous, { kind: "document-archive", input: { ...route.input, cursor } }]);
  };
  const currentCatalogPage = (page: CatalogSearchResponse) => {
    const current = controller.getSnapshot();
    return (route.kind === "catalog" || route.kind === "catalog-filters") && current.queryKey === queryKey && "read" in current.state && current.state.read.kind === "catalog" && current.state.read.value === page && page.offset === route.offset;
  };
  const searching = (value: string) => {
    if (route.kind !== "catalog" || controller.getSnapshot().queryKey !== queryKey || ["loading", "idle", "authentication-required"].includes(controller.getSnapshot().state.phase) || !searchCatalogSchema.shape.q.safeParse(value).success) return;
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [{ ...route, q: value, offset: 0 }] });
  };
  const applyCatalogFilter = (page: CatalogSearchResponse, field: "categoryId" | "supplierOrganizationId", value: string | undefined, reference?: CatalogReferenceRow) => {
    if (route.kind !== "catalog-filters" || !currentCatalogPage(page) || !["categoryId", "supplierOrganizationId"].includes(field)) return;
    if (reference !== undefined || value === undefined) {
      if (reference?.id !== value || !controller.catalogCommercial.referenceAllowed(page,field,reference,{ q: route.q, categoryId: route.categoryId, supplierOrganizationId: route.supplierOrganizationId, cityId: catalogCityId })) return;
    } else if (!(field === "categoryId" ? page.facets.categories : page.facets.suppliers).some(item => item.id === value)) return;
    setNavigation(previous => {
      if (previous.section !== "catalog" || previous.catalog.at(-1) !== route) return previous;
      return { ...previous, catalog: route[field] === value ? previous.catalog.slice(0, -1) : [{ ...route, kind: "catalog", offset: 0, [field]: value, ...(field === "categoryId" && route.commercial?.attributeFilters !== undefined ? { commercial: { ...route.commercial, attributeFilters: undefined } } : {}) }] };
    });
  };
  const applyCatalogCommercial = (page: CatalogSearchResponse, values: CatalogCommercialValues) => {
    if (route.kind !== "catalog-filters" || !currentCatalogPage(page) || !controller.catalogCommercial.take(page,values,{ q: route.q, categoryId: route.categoryId, supplierOrganizationId: route.supplierOrganizationId, cityId: catalogCityId })) return;
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [{ ...route, kind: "catalog", offset: 0, commercial: Object.keys(values).length ? values : undefined }] });
  };
  const clearCatalogFilters = (page: CatalogSearchResponse) => {
    if ((route.kind !== "catalog" && route.kind !== "catalog-filters") || !currentCatalogPage(page)) return;
    controller.catalogCommercial.clearAll();
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [{ kind: "catalog", q: route.q, offset: 0 }] });
  };
  const nextCatalogPage = (page: CatalogSearchResponse) => {
    if (route.kind !== "catalog" || !currentCatalogPage(page)) return;
    const next = catalogNextOffset(page, route.offset); if (next === null) return;
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [...previous.catalog, { ...route, offset: next }] });
  };
  const openCatalogVariant = (page: CatalogSearchResponse, productId: string, variantId: string) => {
    if (route.kind !== "catalog" || !currentCatalogPage(page) || !page.items.some(item => item.id === productId && item.variants.some(variant => variant.id === variantId))) return;
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [...previous.catalog, { kind: "comparison", productId, variantId }] });
  };
  const openComparedOffer = (comparison: OfferComparisonResponse, offerId: string) => {
    const current = controller.getSnapshot();
    if (route.kind !== "comparison" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "comparison" || current.state.read.value !== comparison) return;
    const offer = selectComparedOffer(comparison, route.variantId, offerId); if (!offer) return;
    setNavigation(previous => previous.section !== "catalog" || previous.catalog.at(-1) !== route ? previous : { ...previous, catalog: [...previous.catalog, { kind: "offer", productId: comparison.product.id, variantId: offer.variantId, offerId: offer.offerId }] });
  };
  const searchOrders = (value: string) => setNavigation(previous => ({ ...previous, orders: [{ kind: "orders", q: value, ...(orderGroup === undefined ? {} : { group: orderGroup }), ...(orderStatus === undefined ? {} : { status: orderStatus }) }] }));
  const selectOrderGroup = (group: WorkspaceOrderQuery["group"]) => {
    if (group === orderGroup || controller.getSnapshot().state.phase === "loading") return;
    setNavigation(previous => ({ ...previous, orders: [{ kind: "orders", ...(orderQuery === undefined ? {} : { q: orderQuery }), ...(group === undefined ? {} : { group }), ...(orderStatus === undefined ? {} : { status: orderStatus }) }] }));
  };
  const openOrderStatusFilter = () => {
    if (route.kind !== "orders" || pending || controller.getSnapshot().queryKey !== queryKey || !("read" in controller.getSnapshot().state)) return;
    updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { kind: "order-status-filter", anchor: route }]);
  };
  const selectOrderStatus = (status: WorkspaceOrderQuery["status"]) => {
    if ((route.kind !== "order-status-filter" && route.kind !== "orders") || (status !== undefined && !workspaceOrderStatusSchema.safeParse(status).success) || controller.getSnapshot().queryKey !== queryKey || ["loading", "idle", "authentication-required"].includes(controller.getSnapshot().state.phase)) return;
    setNavigation(previous => {
      if (previous.section !== "orders" || previous.orders.at(-1) !== route) return previous;
      const source = route.kind === "orders" ? route : route.anchor;
      if (status === source.status) return route.kind === "orders" ? previous : { ...previous, orders: previous.orders.slice(0, -1) };
      const { cursor: _cursor, status: _status, ...anchor } = source;
      return { ...previous, orders: [{ ...anchor, ...(status === undefined ? {} : { status }) }] };
    });
  };
  const orderVisitedCursors = history.filter((entry): entry is OrdersRoute => entry.kind === "orders" && (entry.q ?? "") === (orderQuery ?? "") && entry.group === orderGroup && entry.status === orderStatus).map(entry => entry.cursor);
  const currentOrderPage = (page: WorkspaceOrderPage) => {
    const current = controller.getSnapshot();
    return route.kind === "orders" && current.queryKey === queryKey && "read" in current.state && current.state.read.kind === "workspace-orders" && current.state.read.value === page;
  };
  const nextOrderPage = (page: WorkspaceOrderPage) => {
    if (route.kind !== "orders" || !currentOrderPage(page) || !canAdvanceCursor(page.nextCursor, orderVisitedCursors)) return;
    setNavigation(previous => previous.section !== "orders" || previous.orders.at(-1) !== route ? previous : { ...previous, orders: [...previous.orders, { ...route, cursor: page.nextCursor! }] });
  };
  const openOrderPageItem = (page: WorkspaceOrderPage, id: string) => {
    if (!currentOrderPage(page) || !page.items.some(item => item.id === id)) return;
    setNavigation(previous => previous.section !== "orders" || previous.orders.at(-1) !== route ? previous : { ...previous, orders: [...previous.orders, { kind: "workflow", orderId: id }] });
  };
  const cartVisitedCursors = history.filter((entry): entry is Extract<Route, { kind: "cart" }> => entry.kind === "cart").map(entry => entry.cursor);
  const currentCartPage = (page: WorkspaceCartPage) => {
    const current = controller.getSnapshot();
    return route.kind === "cart" && current.queryKey === queryKey && "read" in current.state && current.state.read.kind === "workspace-carts" && current.state.read.value === page;
  };
  const nextCartPage = (page: WorkspaceCartPage, cursor: string) => {
    if (!currentCartPage(page) || cursor !== page.nextCursor || !canAdvanceCursor(cursor, cartVisitedCursors)) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart", cursor }] });
  };
  const openCartPageItem = (page: WorkspaceCartPage, id: string) => {
    if (!currentCartPage(page) || (page.current?.id !== id && !page.items.some(item => item.id === id))) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-detail", cartId: id }] });
  };
  const openCartAttempt = (cartId: string) => {
    const current = controller.getSnapshot(), target = controller.cartQuantityCommands.attemptTarget(cartId);
    if (route.kind !== "cart" || !target || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workspace-carts") return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-quantity", ...target, ...(route.cursor === undefined ? {} : { cursor: route.cursor }) }] });
  };
  const openOriginalCart = (cartId: string) => {
    const current = controller.getSnapshot();
    if (!controller.supportsCartDetails || !controller.cartQuantityCommands.canReadOriginal(cartId) || current.queryKey !== queryKey || (route.kind !== "cart" && route.kind !== "cart-quantity")) return;
    if (route.kind === "cart" && (!("read" in current.state) || current.state.read.kind !== "workspace-carts")) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-detail", cartId }] });
  };
  const openRecoveredCart = (page: WorkspaceCartPage, source: CartResponse) => {
    if (!currentCartPage(page) || !page.items.includes(source)) return;
    const target = recoveredCartTarget(source);
    if (!target) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-detail", cartId: target }] });
  };
  const openCartCommandResult = (cart: CartResponse) => {
    const current = controller.getSnapshot();
    if (route.kind !== "cart" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workspace-carts" || controller.cartWorkspaceCommands.resultCart() !== cart) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-detail", cartId: cart.id }] });
  };
  const openRepriceResult = (cart: CartResponse) => {
    const current = controller.getSnapshot();
    if (route.kind !== "cart" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workspace-carts" || controller.cartReprice.resultCart() !== cart) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "cart-detail", cartId: cart.id }] });
  };
  const openCheckoutReceipt = (receipt: CheckoutResponse) => {
    const current = controller.getSnapshot();
    if (route.kind !== "cart" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "workspace-carts" || controller.cartCheckout.receiptFor(receipt.cartId) !== receipt) return;
    setNavigation(previous => previous.section !== "cart" || previous.cart.at(-1) !== route ? previous : { ...previous, cart: [...previous.cart, { kind: "checkout", checkoutId: receipt.id, cartId: receipt.cartId }] });
  };
  const openCartCheckout = (cart: CartResponse) => {
    const current = controller.getSnapshot();
    if (route.kind !== "cart-detail" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "cart" || current.state.read.value !== cart || !cart.checkout) return;
    const checkoutId = cart.checkout.id;
    setNavigation(previous => previous.section !== navigation.section || previous[previous.section].at(-1) !== route ? previous : { ...previous, [previous.section]: [...previous[previous.section], { kind: "checkout", checkoutId, cartId: cart.id }] });
  };
  const openCheckoutOrder = (checkout: CheckoutResponse, id: string) => {
    const current = controller.getSnapshot();
    if (route.kind !== "checkout" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "checkout" || current.state.read.value !== checkout || !checkout.supplierOrders.some(order => order.id === id)) return;
    setNavigation(previous => previous.section !== navigation.section || previous[previous.section].at(-1) !== route ? previous : { ...previous, [previous.section]: [...previous[previous.section], { kind: "workflow", orderId: id }] });
  };
  const supportVisitedBefore = history.filter((entry): entry is Extract<Route, { kind: "support-ticket" }> => entry.kind === "support-ticket" && entry.ticketId === ticketId).map(entry => entry.beforeMessageId);
  const currentSupportList = (tickets: readonly SupportTicketSummary[]) => {
    const current = controller.getSnapshot();
    return route.kind === "support" && current.queryKey === queryKey && "read" in current.state && current.state.read.kind === "support-tickets" && current.state.read.value === tickets;
  };
  const nextSupportPage = (tickets: readonly SupportTicketSummary[]) => {
    if (route.kind !== "support" || !currentSupportList(tickets) || tickets.length !== 50 || !supportTicketQuerySchema.safeParse({ ...route, offset: route.offset + 50 }).success) return;
    setNavigation(previous => previous.section !== "support" || previous.support.at(-1) !== route ? previous : { ...previous, support: [...previous.support, { ...route, offset: route.offset + 50 }] });
  };
  const openSupportListItem = (tickets: readonly SupportTicketSummary[], id: string) => {
    if (!currentSupportList(tickets) || !tickets.some(ticket => ticket.id === id)) return;
    setNavigation(previous => previous.section !== "support" || previous.support.at(-1) !== route ? previous : { ...previous, support: [...previous.support, { kind: "support-ticket", ticketId: id }] });
  };
  const openTransferSupport = (target:TransferSupportSelection) => {
    const current=controller.getSnapshot();
    if((route.kind!=="workflow"&&route.kind!=="dashboard-order")||current.queryKey!==queryKey||!("read"in current.state)||current.state.read.kind!=="workflow")return;
    const origin=controller.transferSupportLinks.take(target);if(!origin)return;
    updateHistory(previous=>previous.at(-1)!==route?previous:[...previous,{kind:"support-ticket",ticketId:origin.ticketId,transferOrigin:origin}]);
  };
  const olderSupportPage = (ticket: SupportTicketDetail, before: string) => {
    const current = controller.getSnapshot();
    if (route.kind !== "support-ticket" || current.queryKey !== queryKey || !("read" in current.state) || current.state.read.kind !== "support-ticket" || current.state.read.value !== ticket || !ticket.hasOlder || before !== ticket.messages[0]?.id || !supportMessageQuerySchema.safeParse({ beforeMessageId: before }).success || !canAdvanceCursor(before, supportVisitedBefore)) return;
    if(route.transferOrigin&&!controller.transferSupportLinks.accepts(ticket,route.transferOrigin))return;
    if(route.offerConversationOrigin&&!controller.offerConversationSupportLinks.accepts(ticket,route.offerConversationOrigin))return;
    if(route.conversationOrigin&&!controller.conversationSupportLinks.accepts(ticket,route.conversationOrigin))return;
    updateHistory(previous => previous.at(-1) !== route ? previous : [...previous, { ...route, beforeMessageId: before }]);
  };
  const searchSupport = (value: string) => setNavigation(previous => ({ ...previous, support: [{ kind: "support", offset: 0, q: value, sort: supportSort, ...(supportStatus === undefined ? {} : { status: supportStatus }) }] }));
  const changeSupport = (status: SupportTicketSummary["status"] | undefined, sort: "queue" | "recent") => {
    if (controller.getSnapshot().state.phase === "loading" || (status === supportStatus && sort === supportSort)) return;
    setNavigation(previous => ({ ...previous, support: [{ kind: "support", offset: 0, q: supportQ, sort, ...(status === undefined ? {} : { status }) }] }));
  };
  const title = route.kind === "offer-conversation-inbox" ? offerInboxCopy[locale].title : route.kind === "offer-conversation" ? offerConversationCopy[locale].title : route.kind === "order-conversation-inbox" ? conversationInboxCopy[locale].title : route.kind === "goods-return-draft" ? goodsReturnCopy[locale].title : route.kind === "shipment-receipt-draft" ? receiptDraftCopy[locale].title : route.kind === "order-cancel-draft" ? cancellationCopy[locale].title : route.kind === "archive-participants" ? archiveParticipantCopy[locale].title : route.kind === "archive-signatures" ? archiveSignatureCopy[locale].title : route.kind === "archive-history" ? archiveHistoryCopy[locale].title : route.kind === "order-conversation" ? orderConversationCopy[locale].title : route.kind === "order-comments" ? orderCommentsCopy[locale].title : route.kind === "delivery-city" ? c.title : route.kind === "published-reviews" ? (route.target.kind === "product" ? reviewCopy[locale].product : reviewCopy[locale].supplier) : route.kind === "document-archive" ? a.registry : route.kind === "archive-filters" ? a.filters : (route.kind === "archive-document" || route.kind === "archive-related") ? a.metadata : route.kind === "payment-intent" ? t.intentTitle : route.kind === "buyer-dashboard" ? t.buyerDashboard : route.kind === "dashboard-order" ? t.order : route.kind === "local-list" || route.kind === "local-list-item" ? t.localListTitle : route.kind === "saved-list" || route.kind === "saved-lists" ? t.savedLists : route.kind === "support-reply" ? t.supportReplyTitle : route.kind === "support-draft" ? t.supportLocalDraft : route.kind === "cart-quantity" ? (controller.cartQuantityCommands.isAvailable() ? cartCommandCopy[locale].editor : t.draftQuantityTitle) : route.kind === "organization" ? t.organization : route.kind === "catalog-filters" ? t.filters : route.kind === "catalog" ? t.catalog : route.kind === "orders" ? t.orders : route.kind === "workflow" ? t.order : route.kind === "cart" ? t.cart : route.kind === "cart-detail" ? t.cartSnapshot : route.kind === "checkout" ? t.savedCheckout : route.kind === "support" ? t.support : route.kind === "support-ticket" ? t.supportTicket : t.offer;

  return <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
    <View style={styles.header}>
      <Text kind="caption" secondary>{organizationName}</Text>
      <Stack row>{controller.supportsDocumentArchiveFixtures && <Button label={a.registry} tone="tab" selected={navigation.section === "document-archive"} onPress={() => openSection("document-archive")} />}{controller.supportsBuyerDashboardFixtures && <Button label={t.buyerDashboard} tone="tab" selected={navigation.section === "buyer-dashboard"} onPress={() => openSection("buyer-dashboard")} />}<Button label={t.catalog} tone="tab" selected={navigation.section === "catalog"} onPress={() => openSection("catalog")} /><Button label={t.orders} tone="tab" selected={navigation.section === "orders"} onPress={() => openSection("orders")} />{controller.supportsSavedListsFixtures && <Button label={t.savedLists} tone="tab" selected={navigation.section === "saved-lists"} onPress={() => openSection("saved-lists")} />}{controller.supportsCarts && <Button label={t.cart} tone="tab" selected={navigation.section === "cart"} onPress={() => openSection("cart")} />}{controller.supportsSupport && <Button label={t.support} tone="tab" selected={navigation.section === "support"} onPress={() => openSection("support")} />}{controller.supportsOrganization && <Button label={t.organization} tone="tab" selected={navigation.section === "organization"} onPress={() => openSection("organization")} />}</Stack>
      {controller.supportsPublicCityFixtures && (catalogActive || mode === "comparison" || mode === "delivery-city") && <Text secondary>{c.title}: {appliedCity?.nameRu || c.none}{appliedInCity ? ` · ${c.inCity}` : ""}</Text>}
      <Stack row>{route.kind==="catalog"&&controller.supportsOfferConversationInbox()&&"read"in state&&state.read.kind==="catalog"&&<Button label={offerInboxCopy[locale].open} onPress={openOfferInbox}/>}{route.kind === "catalog" && controller.supportsPublicCityFixtures && "read" in state && state.read.kind === "catalog" && <Button label={c.open} onPress={openCityPicker} />}{route.kind === "document-archive" && "read" in state && state.read.kind === "document-archive" && <Button label={a.filters} onPress={openArchiveFilters} />}{history.length > 1 && <Button label={t.back} onPress={back} />}<Text kind="title">{route.kind === "order-status-filter" ? orderStatusCopy[locale].title : title}</Text>{(pending || state.phase === "ready" || state.phase === "empty") && <Button label={t.refresh} disabled={pending} onPress={refresh} />}{route.kind === "catalog" && "read" in state && state.read.kind === "catalog" && state.read.value.offset === route.offset && <Button label={t.filters} onPress={() => updateHistory(previous => previous.at(-1) !== route || previous.at(-1)?.kind === "catalog-filters" ? previous : [...previous, { ...route, kind: "catalog-filters" }])} />}</Stack>
      {route.kind !== "local-list" && route.kind !== "local-list-item" && "read" in state && <LocalListResume store={controller.localListDraft} locale={locale} onOpen={openLocalList} />}
      {route.kind === "document-archive" && <Search value={archiveSearchDraft} appliedValue={archiveQ ?? ""} onChange={setArchiveSearchDraft} onSearch={searchArchive} label={a.search} maxLength={120} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} />}
      {route.kind === "delivery-city" && <Search value={citySearchDraft} appliedValue={cityFilter} onChange={setCitySearchDraft} onSearch={setCityFilter} label={c.search} maxLength={240} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} />}
      {route.kind === "catalog" && <Search value={draft} appliedValue={q} onChange={setDraft} onSearch={searching} label={t.search} maxLength={240} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} />}
      {route.kind === "saved-lists" && <Search value={savedListSearch} appliedValue={savedListFilter} onChange={setSavedListSearch} onSearch={setSavedListFilter} label={t.savedListsSearch} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} />}
      {route.kind === "support" && <Search value={supportDraft} appliedValue={supportQ} onChange={setSupportDraft} onSearch={searchSupport} label={t.searchSupport} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} maxLength={200} />}
      {route.kind === "orders" && <>
        <Search value={orderDraft} appliedValue={orderQuery ?? ""} onChange={setOrderDraft} onSearch={searchOrders} label={t.searchOrders} submitLabel={t.find} clearLabel={t.clear} appliedLabel={t.searchApplied} draftLabel={t.searchDraft} pending={pending} maxLength={160} />
        <Button label={`${orderStatusCopy[locale].title}: ${orderStatusFilterLabel(orderStatus, locale)}`} disabled={pending || !("read" in state)} onPress={openOrderStatusFilter} />
        {orderStatus !== undefined && <Button label={orderStatusCopy[locale].clear} disabled={pending || state.phase === "authentication-required"} onPress={() => selectOrderStatus(undefined)} />}
        <Stack row>{orderGroups.map(group => <Button key={group ?? "all"} tone="tab" selected={group === orderGroup} label={orderGroupLabel(group, locale)} disabled={pending} onPress={() => selectOrderGroup(group)} />)}</Stack>
      </>}
    </View>
    <View style={styles.content}>
      {route.kind === "order-status-filter" && "read" in state ? <OrderStatusFilters disabled={pending} status={route.anchor.status} locale={locale} onSelect={selectOrderStatus} /> : pending ? <Loading label={t.loading} /> : <ReadBody catalogCommercial={controller.catalogCommercial} catalogContextCityId={catalogCityId} applyCatalogCommercial={applyCatalogCommercial} catalogMedia={controller.catalogMedia} organizationOnboarding={controller.organizationOnboarding} organizationProfile={controller.organizationProfile} attachmentImages={controller.attachmentImages} manualTransfer={controller.manualTransfer} orderDocumentArchive={controller.orderDocumentArchive} refundProofMetadata={controller.refundProofMetadata} paymentReductionProposals={controller.paymentReductionProposals} paymentReductions={controller.paymentReductions} shipmentFulfillment={controller.shipmentFulfillment} orderDiscrepancies={controller.orderDiscrepancies} orderDiscrepancyCreate={controller.orderDiscrepancyCreate} orderDiscrepancyDraftActions={controller.orderDiscrepancyDraftActions} orderCheckout={controller.orderCheckout} orderInvoices={controller.orderInvoices} buyerReviewUpdate={controller.buyerReviewUpdate} buyerReviewCreate={controller.buyerReviewCreate} openOfferInboxHistory={openOfferInboxHistory} nextOfferInbox={nextOfferInbox} openOfferInboxConversation={openOfferInboxConversation} offerConversationEscalate={controller.offerConversationEscalate} offerSupportLinks={controller.offerConversationSupportLinks} canOfferSupport={controller.supportsOfferSupportRead} openOfferSupport={openOfferSupport} offerConversationReadMarker={controller.offerConversationReadMarker} offerConversationResolve={controller.offerConversationResolve} offerConversationMessages={controller.offerConversationMessages} offerConversationDrafts={controller.offerConversationDrafts} canOfferConversation={controller.supportsOfferConversation()} openOfferConversation={openOfferConversation} olderOfferConversation={olderOfferConversation} canConversationInbox={controller.supportsOrderConversationInbox()} openConversationInbox={openConversationInbox} nextConversationInbox={nextConversationInbox} openInboxConversation={openInboxConversation} orderConversationEscalate={controller.orderConversationEscalate} conversationSupportLinks={controller.conversationSupportLinks} canConversationSupport={controller.supportsConversationSupportRead} openConversationSupport={openConversationSupport} orderConversationResolve={controller.orderConversationResolve} orderConversationStart={controller.orderConversationStart} orderConversationReadMarker={controller.orderConversationReadMarker} orderConversationSend={controller.orderConversationSend} orderConversationDrafts={controller.orderConversationDrafts} canOrderConversation={controller.supportsOrderConversationFixtures} openOrderConversation={openOrderConversation} olderOrderConversation={olderOrderConversation} moneyReturnCommands={controller.moneyReturnCommands} transferSupportLinks={controller.transferSupportLinks} openTransferSupport={openTransferSupport} paymentDisputeCommands={controller.paymentDisputeCommands} orderCompositionCommands={controller.orderCompositionCommands} orderCommentEditCommands={controller.orderCommentEditCommands} orderCommentCreateCommands={controller.orderCommentCreateCommands} orderReorderCommands={controller.orderReorderCommands} savedListRemoveCommands={controller.savedListRemoveCommands} savedListCreateCommands={controller.savedListCreateCommands} startSavedListHeaderFromDraft={startSavedListHeaderFromDraft} savedListItemCommands={controller.savedListItemCommands} openSavedListsForWrite={openSavedListsForWrite} refundReceiveCommands={controller.refundReceiveCommands} returnSendCommands={controller.returnSendCommands} goodsReturnCommands={controller.goodsReturnCommands} receiptCommands={controller.receiptCommands} cancellationCommands={controller.cancellationCommands} cartCheckout={controller.cartCheckout} openCheckoutReceipt={openCheckoutReceipt} cartReprice={controller.cartReprice} openRepriceResult={openRepriceResult} cartValidation={controller.cartValidation} openCartAttempt={openCartAttempt} openOriginalCart={openOriginalCart} cartAddCommands={controller.cartAddCommands} readLocalOfferForCart={readLocalOfferForCart} cartAdditionSelected={cartAdditionSelected} cartWorkspaceCommands={controller.cartWorkspaceCommands} cartQuantityCommands={controller.cartQuantityCommands} supportReopen={controller.supportReopen} supportReplyCommands={controller.supportReplyCommands} supportCreateCommand={controller.supportCreateCommand} canArchiveChildMetadata={controller.supportsArchiveChildMetadata} canExtendedArchive={controller.supportsExtendedArchiveMetadata || controller.supportsArchiveBaseMetadata} nextCatalogPage={nextCatalogPage} openCatalogVariant={openCatalogVariant} openComparedOffer={openComparedOffer} supportVisitedBefore={supportVisitedBefore} nextSupportPage={nextSupportPage} openSupportListItem={openSupportListItem} olderSupportPage={olderSupportPage} cartVisitedCursors={cartVisitedCursors} nextCartPage={nextCartPage} openCartPageItem={openCartPageItem} openRecoveredCart={openRecoveredCart} openCartCommandResult={openCartCommandResult} openCartCheckout={openCartCheckout} openCheckoutOrder={openCheckoutOrder} orderVisitedCursors={orderVisitedCursors} nextOrderPage={nextOrderPage} openOrderPageItem={openOrderPageItem} goodsReturnDrafts={controller.goodsReturnDrafts} openGoodsReturnDraft={openGoodsReturnDraft} closeGoodsReturnDraft={closeGoodsReturnDraft} receiptDrafts={controller.receiptDrafts} openReceiptDraft={openReceiptDraft} closeReceiptDraft={closeReceiptDraft} cancellationDrafts={controller.cancellationDrafts} openCancellationDraft={openCancellationDraft} closeCancellationDraft={closeCancellationDraft} openArchiveParticipants={openArchiveParticipants} openArchiveSignatures={openArchiveSignatures} openArchiveHistory={openArchiveHistory} canOrderComments={controller.supportsOrderCommentFixtures} openOrderComments={openOrderComments} cityDraftId={cityDraftId} cityDraftInCity={cityDraftInCity} cityFilter={cityFilter} onCitySelect={selectCityDraft} onCityFilterMode={selectCityFilterMode} applyCity={applyCity} canProductReviews={controller.supportsProductReviewFixtures} canSupplierReviews={controller.supportsSupplierReviewFixtures} openReviews={openReviews} openArchiveBase={openArchiveBase} openArchiveDocument={openArchiveDocument} archiveFilters={archiveFilters} onArchiveFilterChange={setArchiveFilters} applyArchiveFilters={applyArchiveFilters} archiveVisited={archiveVisited} nextArchive={nextArchive} state={state} route={route} locale={locale} userId={userId} buyerOrganizationId={controller.buyerOrganizationId} canIntentFixture={controller.supportsPaymentIntentFixture} onIntent={openPaymentIntent} localListDraft={controller.localListDraft} onLocalListSelect={selectLocalListOffer} onLocalListOverview={openLocalList} onLocalListEdit={editLocalListItem} onLocalListCancel={cancelLocalList} savedListFilter={savedListFilter} supportReplyDrafts={controller.supportReplyDrafts} onReply={openSupportReply} supportTicketDraft={controller.supportTicketDraft} quantityDrafts={controller.quantityDrafts} onDraft={openQuantityDraft} back={back} canSavedLists={controller.supportsSavedListsFixtures} canCartDetail={controller.supportsCartDetails} canCheckoutRead={controller.supportsCheckoutRead} applyCatalogFilter={applyCatalogFilter} clearCatalogFilters={clearCatalogFilters} supportControls={<Stack><SupportDraftLauncher store={controller.supportTicketDraft} locale={locale} onOpen={openSupportTicketDraft} /><Stack row>{supportStatuses.map(status => <Button key={status ?? "all"} tone="tab" selected={status === supportStatus} label={supportStatusLabel(status, locale)} onPress={() => changeSupport(status, supportSort)} />)}</Stack><Stack row>{(["recent", "queue"] as const).map(sort => <Button key={sort} tone="tab" selected={sort === supportSort} label={sort === "recent" ? t.supportRecent : t.supportQueue} onPress={() => changeSupport(supportStatus, sort)} />)}</Stack></Stack>} push={push} replace={replace} retry={retry} canGoBack={history.length > 1} onSessionRequired={onSessionRequired} />}
    </View>
  </SafeAreaView>;
}

function ReadBody({ catalogCommercial, catalogContextCityId, applyCatalogCommercial, catalogMedia, organizationOnboarding, organizationProfile, attachmentImages, manualTransfer, orderDocumentArchive, refundProofMetadata, paymentReductionProposals, paymentReductions, shipmentFulfillment, orderDiscrepancies, orderDiscrepancyCreate, orderDiscrepancyDraftActions, orderCheckout, orderInvoices, buyerReviewUpdate, buyerReviewCreate, openOfferInboxHistory, nextOfferInbox, openOfferInboxConversation, offerConversationEscalate, offerSupportLinks, canOfferSupport, openOfferSupport, offerConversationReadMarker, offerConversationResolve, offerConversationMessages, offerConversationDrafts, canOfferConversation, openOfferConversation, olderOfferConversation, canConversationInbox, openConversationInbox, nextConversationInbox, openInboxConversation, orderConversationEscalate, conversationSupportLinks, canConversationSupport, openConversationSupport, orderConversationResolve, orderConversationStart, orderConversationReadMarker, orderConversationSend, orderConversationDrafts, canOrderConversation, openOrderConversation, olderOrderConversation, moneyReturnCommands, transferSupportLinks, openTransferSupport, paymentDisputeCommands, orderCompositionCommands, orderCommentEditCommands, orderCommentCreateCommands, orderReorderCommands, savedListRemoveCommands, savedListCreateCommands, startSavedListHeaderFromDraft, savedListItemCommands, openSavedListsForWrite, refundReceiveCommands, returnSendCommands, goodsReturnCommands, receiptCommands, cancellationCommands, cartCheckout, openCheckoutReceipt, cartReprice, openRepriceResult, cartValidation, openCartAttempt, openOriginalCart, cartAddCommands, readLocalOfferForCart, cartAdditionSelected, cartWorkspaceCommands, cartQuantityCommands, supportReopen, supportReplyCommands, supportCreateCommand, canArchiveChildMetadata, canExtendedArchive, nextCatalogPage, openCatalogVariant, openComparedOffer, supportVisitedBefore, nextSupportPage, openSupportListItem, olderSupportPage, cartVisitedCursors, nextCartPage, openCartPageItem, openRecoveredCart, openCartCommandResult, openCartCheckout, openCheckoutOrder, orderVisitedCursors, nextOrderPage, openOrderPageItem, goodsReturnDrafts, openGoodsReturnDraft, closeGoodsReturnDraft, receiptDrafts, openReceiptDraft, closeReceiptDraft, cancellationDrafts, openCancellationDraft, closeCancellationDraft, openArchiveParticipants, openArchiveSignatures, openArchiveHistory, canOrderComments, openOrderComments, cityDraftId, cityDraftInCity, cityFilter, onCitySelect, onCityFilterMode, applyCity, canProductReviews, canSupplierReviews, openReviews, openArchiveBase, openArchiveDocument, archiveFilters, onArchiveFilterChange, applyArchiveFilters, archiveVisited, nextArchive, state, route, locale, userId, buyerOrganizationId, canIntentFixture, onIntent, localListDraft, onLocalListSelect, onLocalListOverview, onLocalListEdit, onLocalListCancel, savedListFilter, supportReplyDrafts, onReply, supportTicketDraft, quantityDrafts, onDraft, back, canSavedLists, canCartDetail, canCheckoutRead, supportControls, applyCatalogFilter, clearCatalogFilters, push, replace, retry, canGoBack, onSessionRequired }: { catalogCommercial: ReadController["catalogCommercial"]; catalogContextCityId?: string; applyCatalogCommercial: (page: CatalogSearchResponse, values: CatalogCommercialValues) => void; catalogMedia: ReadController["catalogMedia"]; organizationOnboarding: ReadController["organizationOnboarding"]; organizationProfile: ReadController["organizationProfile"]; attachmentImages: ReadController["attachmentImages"]; manualTransfer: ReadController["manualTransfer"]; orderDocumentArchive: ReadController["orderDocumentArchive"]; refundProofMetadata: ReadController["refundProofMetadata"]; paymentReductionProposals: ReadController["paymentReductionProposals"]; paymentReductions: ReadController["paymentReductions"]; shipmentFulfillment: ReadController["shipmentFulfillment"]; orderDiscrepancies: ReadController["orderDiscrepancies"]; orderDiscrepancyCreate: ReadController["orderDiscrepancyCreate"]; orderDiscrepancyDraftActions: ReadController["orderDiscrepancyDraftActions"]; orderCheckout: ReadController["orderCheckout"]; orderInvoices: ReadController["orderInvoices"]; buyerReviewUpdate: BuyerReviewUpdates; buyerReviewCreate: BuyerReviewCreateCommands; openOfferInboxHistory:(page:OfferInboxPage,row:OfferInboxRow)=>void;nextOfferInbox:(page:OfferInboxPage)=>void;openOfferInboxConversation:(page:OfferInboxPage,row:OfferInboxRow)=>void;offerConversationEscalate:OfferConversationEscalate;offerSupportLinks:OfferConversationSupportLinks;canOfferSupport:boolean;openOfferSupport:(window:OfferConversationWindow)=>void;offerConversationReadMarker:OfferConversationReadMarker;offerConversationResolve:OfferConversationResolve;offerConversationMessages:OfferConversationMessages;offerConversationDrafts:OfferConversationDrafts;canOfferConversation:boolean;openOfferConversation:()=>void;olderOfferConversation:(window:OfferConversationWindow)=>void;canConversationInbox:boolean;openConversationInbox:()=>void;nextConversationInbox:(page:ConversationInboxPage)=>void;openInboxConversation:(page:ConversationInboxPage,row:ConversationInboxRow)=>void;orderConversationEscalate:OrderConversationEscalate;conversationSupportLinks:ConversationSupportLinks;canConversationSupport:boolean;openConversationSupport:(window:OrderConversationWindow)=>void;orderConversationResolve:OrderConversationResolve; orderConversationStart:OrderConversationStart; orderConversationReadMarker:ConversationReadMarker; orderConversationSend:OrderConversationSend; orderConversationDrafts:OrderConversationDrafts; canOrderConversation:boolean; openOrderConversation:()=>void; olderOrderConversation:(window:OrderConversationWindow)=>void; moneyReturnCommands:MoneyReturnCommands; transferSupportLinks:TransferSupportLinks; openTransferSupport:(target:TransferSupportSelection)=>void; paymentDisputeCommands: PaymentDisputeCommands; orderCompositionCommands: OrderCompositionCommands; orderCommentEditCommands: OrderCommentEditCommands; orderCommentCreateCommands: OrderCommentCreateCommands; orderReorderCommands: OrderReorderCommands; savedListRemoveCommands: SavedListRemoveCommands; savedListCreateCommands: SavedListCreateCommands; startSavedListHeaderFromDraft:()=>void; savedListItemCommands: SavedListItemCommands; openSavedListsForWrite:()=>void; refundReceiveCommands: RefundReceiveCommands; returnSendCommands: ReturnSendCommands; goodsReturnCommands: GoodsReturnCommands; receiptCommands: ShipmentReceiptCommands; cancellationCommands: OrderCancellationCommands; cartCheckout: CartCheckout; openCheckoutReceipt: (receipt: CheckoutResponse) => void; cartReprice: CartReprice; openRepriceResult: (cart: CartResponse) => void; cartValidation: CartValidation; openCartAttempt: (cartId: string) => void; openOriginalCart: (cartId: string) => void; cartAddCommands: CartAddCommands; readLocalOfferForCart: (target: LocalListTarget) => void; cartAdditionSelected: () => void; cartWorkspaceCommands: CartWorkspaceCommands; cartQuantityCommands: CartQuantityCommands; supportReopen: NativeSupportReopen; supportReplyCommands: SupportReplyCommands; supportCreateCommand: SupportCreateCommand; canArchiveChildMetadata: boolean; canExtendedArchive: boolean; nextCatalogPage: (page: CatalogSearchResponse) => void; openCatalogVariant: (page: CatalogSearchResponse, productId: string, variantId: string) => void; openComparedOffer: (comparison: OfferComparisonResponse, offerId: string) => void; supportVisitedBefore: readonly (string | undefined)[]; nextSupportPage: (tickets: readonly SupportTicketSummary[]) => void; openSupportListItem: (tickets: readonly SupportTicketSummary[], id: string) => void; olderSupportPage: (ticket: SupportTicketDetail, before: string) => void; cartVisitedCursors: readonly (string | undefined)[]; nextCartPage: (page: WorkspaceCartPage, cursor: string) => void; openCartPageItem: (page: WorkspaceCartPage, id: string) => void; openRecoveredCart: (page: WorkspaceCartPage, source: CartResponse) => void; openCartCommandResult: (cart: CartResponse) => void; openCartCheckout: (cart: CartResponse) => void; openCheckoutOrder: (checkout: CheckoutResponse, id: string) => void; orderVisitedCursors: readonly (string | undefined)[]; nextOrderPage: (page: WorkspaceOrderPage) => void; openOrderPageItem: (page: WorkspaceOrderPage, id: string) => void; goodsReturnDrafts: GoodsReturnDrafts; openGoodsReturnDraft: (itemId: string) => void; closeGoodsReturnDraft: () => void; receiptDrafts: ShipmentReceiptDrafts; openReceiptDraft: (shipmentId: string, itemId: string) => void; closeReceiptDraft: () => void; cancellationDrafts: OrderCancellationDrafts; openCancellationDraft: () => void; closeCancellationDraft: () => void; openArchiveParticipants: () => void; openArchiveSignatures: () => void; openArchiveHistory: () => void; canOrderComments: boolean; openOrderComments: () => void; cityDraftId: string | null; cityDraftInCity: boolean; cityFilter: string; onCitySelect: (id: string | null) => void; onCityFilterMode: (value: boolean) => void; applyCity: () => void; canProductReviews: boolean; canSupplierReviews: boolean; openReviews: (offerId?: string) => void; openArchiveBase: (target: ArchiveBaseSelection) => void; openArchiveDocument: (id: string) => void; archiveFilters: ArchiveFilterFields; onArchiveFilterChange: (value: ArchiveFilterFields) => void; applyArchiveFilters: () => void; archiveVisited: readonly string[]; nextArchive: (cursor: string) => void; state: MobileReadState; route: Route; locale: Locale; userId: string; buyerOrganizationId: string; canIntentFixture: boolean; onIntent: () => void; localListDraft: LocalListDraft; onLocalListSelect: () => void; onLocalListOverview: () => void; onLocalListEdit: (target: LocalListTarget) => void; onLocalListCancel: () => void; savedListFilter: string; supportReplyDrafts: SupportReplyDrafts; onReply: () => void; supportTicketDraft: SupportTicketDraft; quantityDrafts: CartQuantityDrafts; onDraft: (cart: CartResponse, item: CartResponse["items"][number]) => void; back: () => void; canSavedLists: boolean; canCartDetail: boolean; canCheckoutRead: boolean; supportControls: React.ReactNode; applyCatalogFilter: (page: CatalogSearchResponse, field: "categoryId" | "supplierOrganizationId", value: string | undefined, reference?: CatalogReferenceRow) => void; clearCatalogFilters: (page: CatalogSearchResponse) => void; push: (route: Route) => void; replace: (route: Route) => void; retry: () => void; canGoBack: boolean; onSessionRequired?: () => void }) {
  useCancellationCommandState(cancellationCommands);
  useReceiptCommandState(receiptCommands);
  useGoodsReturnCommandState(goodsReturnCommands);
  useReturnSendState(returnSendCommands);
  useRefundReceiveState(refundReceiveCommands);
  useSavedListItemState(savedListItemCommands);
  useSavedListCreateState(savedListCreateCommands);
  useSavedListRemoveState(savedListRemoveCommands);
  useOrderReorderState(orderReorderCommands);
  useOrderCommentCreateState(orderCommentCreateCommands);
  useMoneyReturnState(moneyReturnCommands);
  useDisputeState(paymentDisputeCommands);
  useCompositionState(orderCompositionCommands);
  useOrderCommentEditState(orderCommentEditCommands);
  useCartCheckoutState(cartCheckout);
  useCartRepriceState(cartReprice);
  useCartValidationState(cartValidation);
  useCartCommandState(cartQuantityCommands);
  useCartWorkspaceCommandState(cartWorkspaceCommands);
  useCartAddCommandState(cartAddCommands);
  const t = copy[locale];
  if (!("read" in state)) {
    const [title, body] = state.phase === "relation-unverified" ? [archiveLinksCopy[locale].changed, archiveLinksCopy[locale].changedBody] : state.phase === "visibility-unverified" ? [archiveCopy[locale].visibility, archiveCopy[locale].visibilityBody] : state.phase === "denied" ? [t.denied, t.deniedBody]
      : state.phase === "unavailable" ? [t.unavailable, route.kind === "payment-intent" ? t.intentPreviousCheckout : route.kind === "support-ticket" && route.beforeMessageId !== undefined ? t.supportPreviousPage : route.kind === "cart-detail" || route.kind === "checkout" ? t.cartPreviousPage : canGoBack ? t.unavailableBody : t.unavailableRootBody]
      : state.phase === "authentication-required" ? [t.auth, t.authBody]
      : state.phase === "retry-limited" ? [t.throttled, t.throttledBody]
      : state.phase === "contract-error" ? [t.contract, t.contractBody] : [t.error, t.errorBody];
    const action = state.phase === "authentication-required" && onSessionRequired
      ? <Button label={t.signIn} onPress={onSessionRequired} />
      : state.phase === "unavailable" && canGoBack ? undefined : <Button label={t.retry} onPress={retry} />;
    return <Stack><Notice kind="error" title={title} body={body} action={action} />{route.kind==="order-comments"&&<><OrderCommentEditStatuses model={orderCommentEditCommands} orderId={route.target.orderId} locale={locale}/><OrderCommentCreatePanel model={orderCommentCreateCommands} orderId={route.target.orderId} locale={locale}/></>}{(route.kind === "saved-lists" || route.kind === "saved-list")&&<><SavedListRemovePanel model={savedListRemoveCommands} locale={locale}/><SavedListCreatePanel model={savedListCreateCommands} locale={locale}/><SavedListSavePanel model={savedListItemCommands} locale={locale}/></>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <MoneyReturnPanel model={moneyReturnCommands} orderId={route.orderId} locale={locale}/>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <PaymentDisputePanel model={paymentDisputeCommands} orderId={route.orderId} locale={locale}/>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <CompositionPanel model={orderCompositionCommands} orderId={route.orderId} locale={locale}/>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <OrderReorderPanel model={orderReorderCommands} orderId={route.orderId} locale={locale} onCart={canCartDetail?cartId=>push({kind:"cart-detail",cartId}):undefined}/>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <RefundReceivePanel command={refundReceiveCommands} orderId={route.orderId} locale={locale}/>}{(route.kind === "workflow" || route.kind === "dashboard-order") && <ReturnSendPanel command={returnSendCommands} orderId={route.orderId} locale={locale}/>}{(route.kind === "goods-return-draft" || route.kind === "workflow" || route.kind === "dashboard-order") && <GoodsReturnCommandPanel command={goodsReturnCommands} orderId={route.kind === "goods-return-draft" ? route.target.orderId : route.orderId} locale={locale} />}{(route.kind === "shipment-receipt-draft" || route.kind === "workflow" || route.kind === "dashboard-order") && <ReceiptCommandPanel command={receiptCommands} orderId={route.kind === "shipment-receipt-draft" ? route.target.orderId : route.orderId} locale={locale} />}{(route.kind === "order-cancel-draft" || route.kind === "workflow" || route.kind === "dashboard-order") && <CancellationCommandPanel command={cancellationCommands} orderId={route.kind === "order-cancel-draft" ? route.target.orderId : route.orderId} locale={locale} />}{route.kind === "cart-quantity" && <CartQuantityCommandPanel onOriginalCart={canCartDetail ? () => openOriginalCart(route.kind === "cart-quantity" ? route.cartId : "") : undefined} command={cartQuantityCommands} cartId={route.cartId} itemId={route.itemId} locale={locale} onInvalid={() => {}} onBack={back} />}{route.kind === "cart" && <><OrderReorderCartNotice model={orderReorderCommands} locale={locale} onOrder={orderId=>push({kind:"workflow",orderId})}/><CartCheckoutPanel model={cartCheckout} locale={locale} onReceipt={canCheckoutRead ? openCheckoutReceipt : undefined} /><CartRepricePanel model={cartReprice} locale={locale} />{!cartCheckout.blocksOtherMutations() && !cartReprice.blocksOtherMutations() && <CartValidationPanel model={cartValidation} locale={locale} />}<CartWorkspaceCommandPanel command={cartWorkspaceCommands} locale={locale} currencyHint={cartAddCommands.selectedCurrency()} /><CartAddCommandPanel command={cartAddCommands} locale={locale} /></>}</Stack>;
  }
  const { read } = state;
  if(read.kind==="offer-conversation")return <OfferConversationRead attachmentImages={attachmentImages} escalate={offerConversationEscalate} canSupport={canOfferSupport} onSupport={openOfferSupport} readMarker={offerConversationReadMarker} resolve={offerConversationResolve} messages={offerConversationMessages} value={read.value} locale={locale} userId={userId} drafts={offerConversationDrafts} onOlder={()=>olderOfferConversation(read.value)}/>;
  if(read.kind==="offer-conversation-inbox")return <OfferConversationInboxUi onHistory={openOfferInboxHistory} page={read.value} locale={locale} onNext={nextOfferInbox} onOpen={openOfferInboxConversation}/>;
  if(read.kind==="order-conversation-inbox")return <OrderConversationInboxUi page={read.value} locale={locale} onNext={nextConversationInbox} onOpen={openInboxConversation}/>;
  if(read.kind==="order-conversation")return <OrderConversationRead attachmentImages={attachmentImages} escalate={orderConversationEscalate} canSupport={canConversationSupport} onSupport={openConversationSupport} resolve={orderConversationResolve} start={orderConversationStart} readMarker={orderConversationReadMarker} send={orderConversationSend} drafts={orderConversationDrafts} value={read.value} locale={locale} userId={userId} onOlder={()=>olderOrderConversation(read.value)}/>;
  if(read.kind === "workflow" && orderCompositionCommands.canReview(read.value)) return <CompositionReview model={orderCompositionCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "workflow" && moneyReturnCommands.canReview(read.value)) return <MoneyReturnReview model={moneyReturnCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "workflow" && moneyReturnCommands.isEditing(read.value)) return <MoneyReturnForm model={moneyReturnCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "workflow" && paymentDisputeCommands.canReview(read.value)) return <PaymentDisputeReview model={paymentDisputeCommands} workflow={read.value} locale={locale}/>;
  if (read.kind === "workflow" && buyerReviewCreate.isOpen(read.value.orderId)) return <BuyerReviewCreateUi updates={buyerReviewUpdate} model={buyerReviewCreate} workflow={read.value} locale={locale} />;
  if(read.kind === "workflow" && paymentDisputeCommands.isEditing(read.value)) return <PaymentDisputeForm model={paymentDisputeCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "workflow" && orderReorderCommands.canReview(read.value)) return <OrderReorderReview model={orderReorderCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "saved-lists" && savedListRemoveCommands.canReview(read.value)) return <SavedListRemoveReview model={savedListRemoveCommands} page={read.value} locale={locale}/>;
  if(read.kind === "saved-lists" && savedListItemCommands.canReview(read.value)) return <SavedListSaveReview model={savedListItemCommands} page={read.value} locale={locale}/>;
  if(read.kind === "saved-lists" && savedListCreateCommands.canReview(read.value)) return <SavedListCreateReview model={savedListCreateCommands} page={read.value} locale={locale}/>;
  if(read.kind === "saved-lists" && savedListCreateCommands.isEditing()) return <SavedListCreateForm model={savedListCreateCommands} page={read.value} locale={locale}/>;
  if(read.kind === "workflow" && refundReceiveCommands.canReview(read.value)) return <RefundReceiveReview command={refundReceiveCommands} workflow={read.value} locale={locale}/>;
  if(read.kind === "workflow" && returnSendCommands.canReview(read.value)) return <ReturnSendReview command={returnSendCommands} workflow={read.value} locale={locale}/>;
  if (route.kind === "local-list-item") return <LocalListItemEditor saveActionHint={() => savedListSaveHints(savedListItemCommands, localListDraft, route.target, locale)} saveAction={focus => <SavedListSaveOfferAction model={savedListItemCommands} draft={localListDraft} target={route.target} comparison={read.kind === "comparison" ? read.value : undefined} locale={locale} onSelected={openSavedListsForWrite} onReadSource={() => readLocalOfferForCart(route.target)} onInvalid={focus}/>} store={localListDraft} target={route.target} locale={locale} onBack={back} onOverview={onLocalListOverview} onCancelAll={onLocalListCancel} quantityActionHint={() => cartAddQuantityErrorFor(cartAddCommands, localListDraft, route.target, locale)} quantityAction={focus => <CartAddFromListAction command={cartAddCommands} list={localListDraft} target={route.target} comparison={read.kind === "comparison" ? read.value : undefined} locale={locale} onSelected={cartAdditionSelected} onQuantityError={focus} onReadSource={() => readLocalOfferForCart(route.target)} />} />;
  if (route.kind === "local-list") return <LocalListOverview createAction={<SavedListCreateEntry model={savedListCreateCommands} locale={locale} onFromDraft={startSavedListHeaderFromDraft}/>} store={localListDraft} locale={locale} onBack={back} onEdit={onLocalListEdit} onCancelAll={onLocalListCancel} />;
  if (route.kind === "goods-return-draft" && read.kind === "workflow") return <GoodsReturnDraftForm command={goodsReturnCommands} store={goodsReturnDrafts} workflow={read.value} target={route.target} locale={locale} onBack={closeGoodsReturnDraft} />;
  if (route.kind === "shipment-receipt-draft" && read.kind === "workflow") return <ShipmentReceiptDraftForm command={receiptCommands} store={receiptDrafts} workflow={read.value} target={route.target} locale={locale} onBack={closeReceiptDraft} />;
  if (route.kind === "order-cancel-draft" && read.kind === "workflow") return <OrderCancellationDraftForm command={cancellationCommands} store={cancellationDrafts} workflow={read.value} target={route.target} locale={locale} onBack={closeCancellationDraft} />;
  if (read.kind === "archive-participants") return <ArchiveParticipantMetadata value={read.value} locale={locale} onBack={back} />;
  if (read.kind === "archive-signatures") return <ArchiveSignatureMetadata value={read.value} locale={locale} onBack={back} />;
  if (read.kind === "archive-history") return <ArchiveVersionHistory value={read.value} locale={locale} onBack={back} />;
  if (read.kind === "order-comments") {
    const editReview=orderCommentEditCommands.canReview(read.value),editingId=orderCommentEditCommands.editingId(read.value);
    if(editReview)return <OrderCommentEditReview model={orderCommentEditCommands} id={editReview} locale={locale}/>;
    if(editingId)return <OrderCommentEditForm model={orderCommentEditCommands} id={editingId} locale={locale}/>;
    if(orderCommentCreateCommands.canReview(read.value))return <OrderCommentCreateReview model={orderCommentCreateCommands} window={read.value} locale={locale}/>;
    if(orderCommentCreateCommands.isEditing(read.value.context.orderId))return <OrderCommentCreateForm model={orderCommentCreateCommands} window={read.value} locale={locale}/>;
    return <OrderCommentsRead nativeCommands={orderCommentCreateCommands.runtime==="native-session"||orderCommentEditCommands.runtime==="native-session"} editAvailable={orderCommentEditCommands.isAvailable()} controls={(row,index)=><OrderCommentEditLauncher model={orderCommentEditCommands} window={read.value} row={row} index={index} locale={locale}/>} createAvailable={orderCommentCreateCommands.isAvailable()} header={<Stack><OrderCommentEditStatuses model={orderCommentEditCommands} orderId={read.value.context.orderId} locale={locale}/><OrderCommentCreateEntry model={orderCommentCreateCommands} window={read.value} locale={locale}/><OrderCommentCreatePanel model={orderCommentCreateCommands} orderId={read.value.context.orderId} locale={locale}/></Stack>} value={read.value} locale={locale} onBack={back} />;
  }
  if (read.kind === "public-cities") return <DeliveryCityRead cities={read.value} selectedId={cityDraftId} inCity={cityDraftInCity} filter={cityFilter} locale={locale} onSelect={onCitySelect} onFilterMode={onCityFilterMode} onApply={applyCity} />;
  if (read.kind === "published-reviews") return <PublishedReviewsRead value={read.value} locale={locale} onBack={back} />;
  if (read.kind === "archive-document") return <ArchiveDocumentRead document={read.value} locale={locale} onBack={back} backLabel={route.kind === "archive-related" ? archiveLinksCopy[locale].backToParent : undefined} links={(canArchiveChildMetadata || canExtendedArchive) ? <Stack>{canArchiveChildMetadata && <><ArchiveHistoryLauncher locale={locale} onOpen={openArchiveHistory} /><ArchiveSignatureLauncher locale={locale} onOpen={openArchiveSignatures} /><ArchiveParticipantLauncher locale={locale} onOpen={openArchiveParticipants} /></>}{canExtendedArchive && <ArchiveDocumentLinks links={read.links} locale={locale} onOpen={openArchiveBase} />}</Stack> : undefined} />;
  if (read.kind === "document-archive") return route.kind === "archive-filters" ? <ArchiveFilters value={archiveFilters} locale={locale} onChange={onArchiveFilterChange} onApply={applyArchiveFilters} /> : <DocumentArchiveRead value={read.value} locale={locale} visitedCursors={archiveVisited} onOpen={openArchiveDocument} onNext={nextArchive} retry={retry} />;
  if (read.kind === "payment-intent") return <PaymentIntentRead intent={read.value} locale={locale} onBack={back} />;
  if (read.kind === "buyer-dashboard") return <BuyerDashboardRead dashboard={read.value} locale={locale} onCart={canCartDetail ? cartId => push({ kind: "cart-detail", cartId }) : undefined} onOrder={orderId => push({ kind: "dashboard-order", orderId })} onLists={canSavedLists ? () => push({ kind: "saved-lists" }) : undefined} />;
  if (read.kind === "saved-lists") {
    const selectedList = route.kind === "saved-list" ? read.value.find(list => list.id === route.listId) : undefined;
    const header = <Stack><SavedListCreateEntry model={savedListCreateCommands} locale={locale}/><SavedListRemovePanel model={savedListRemoveCommands} locale={locale}/><SavedListCreatePanel model={savedListCreateCommands} locale={locale}/><SavedListSavePanel model={savedListItemCommands} locale={locale}/></Stack>;
    return route.kind === "saved-list" ? <SavedListItemsRead nativeCommands={savedListCreateCommands.runtime==="native-session"||savedListItemCommands.runtime==="native-session"||savedListRemoveCommands.runtime==="native-session"} controls={item=>selectedList&&<SavedListRemoveAction model={savedListRemoveCommands} page={read.value} list={selectedList} item={item} locale={locale}/>} header={<Stack>{header}{selectedList&&<SavedListSaveDestination model={savedListItemCommands} page={read.value} list={selectedList} locale={locale}/>}</Stack>} list={selectedList} locale={locale} onBack={back}/> : <SavedListsRead nativeCommands={savedListCreateCommands.runtime==="native-session"||savedListItemCommands.runtime==="native-session"||savedListRemoveCommands.runtime==="native-session"} header={header} controls={list=><SavedListSaveDestination model={savedListItemCommands} page={read.value} list={list} locale={locale}/>} lists={read.value} search={savedListFilter} locale={locale} onOpen={listId=>push({kind:"saved-list",listId})}/>;
  }
  if (read.kind === "organization-profile") return <OrganizationRead profile={read.value} locale={locale} model={organizationProfile} onboarding={organizationOnboarding} />;
  if (read.kind === "support-tickets" && route.kind === "support-draft") return <SupportTicketDraftForm command={supportCreateCommand} store={supportTicketDraft} locale={locale} onBack={back} />;
  if (read.kind === "support-tickets" && route.kind === "support") return <SupportListRead tickets={read.value} offset={route.offset} locale={locale} controls={supportControls} onOpen={ticketId => openSupportListItem(read.value, ticketId)} onNext={() => nextSupportPage(read.value)} />;
  if(read.kind==="support-ticket"&&(route.kind==="support-ticket"||route.kind==="support-reply")&&route.offerConversationOrigin&&!offerSupportLinks.accepts(read.value,route.offerConversationOrigin))return <Notice kind="error" title={offerSupportCopy[locale].invalid} body={offerSupportCopy[locale].invalidBody} action={<Button label={t.retry} onPress={retry}/>}/>;
  if(read.kind==="support-ticket"&&(route.kind==="support-ticket"||route.kind==="support-reply")&&route.conversationOrigin&&!conversationSupportLinks.accepts(read.value,route.conversationOrigin))return <Notice kind="error" title={conversationSupportCopy[locale].invalid} body={conversationSupportCopy[locale].invalidBody} action={<Button label={t.retry} onPress={retry}/>}/>;
  if(read.kind==="support-ticket"&&(route.kind==="support-ticket"||route.kind==="support-reply")&&route.transferOrigin&&!transferSupportLinks.accepts(read.value,route.transferOrigin))return <Notice kind="error" title={transferSupportCopy[locale].invalid} body={transferSupportCopy[locale].invalidBody} action={<Button label={t.retry} onPress={retry}/>}/>;
  if (read.kind === "support-ticket" && route.kind === "support-reply") return <SupportReplyDraftForm command={supportReplyCommands} store={supportReplyDrafts} ticket={read.value} target={route.draftTarget} locale={locale} onBack={back} />;
  if (read.kind === "support-ticket" && route.kind === "support-ticket") return <SupportTicketRead attachmentImages={attachmentImages} visitedBefore={supportVisitedBefore} ticket={read.value} beforeMessageId={route.beforeMessageId} userId={userId} locale={locale} onOlder={beforeMessageId => olderSupportPage(read.value, beforeMessageId)} retry={retry} replyControls={<NativeSupportReopenUi model={supportReopen} ticket={read.value} locale={locale} onReadTicket={()=>{if(route.beforeMessageId)replace({...route,beforeMessageId:undefined});else retry();}} otherReply={{command:supportReplyCommands,onOpen:onReply,onBack:back}} otherControls={<SupportReplyLauncher store={supportReplyDrafts} ticket={read.value} locale={locale} onOpen={onReply} />} />} />;
  if (read.kind === "workspace-carts" && route.kind === "cart-quantity") {
    const cart = read.value.current, item = cart?.items.find(item => item.id === route.itemId), reviewed = cartQuantityCommands.editingCart(route.cartId, route.itemId);
    if (!cart || !item || cart.id !== route.cartId || (cart.version !== route.expectedVersion && reviewed !== cart) || !quantityDrafts.canEdit(cart, item)) return <Stack><QuantityDraftUnavailable locale={locale} onBack={back} /><CartQuantityCommandPanel onOriginalCart={canCartDetail ? () => openOriginalCart(route.kind === "cart-quantity" ? route.cartId : "") : undefined} command={cartQuantityCommands} cartId={route.cartId} itemId={route.itemId} locale={locale} onInvalid={() => {}} onBack={back} /></Stack>;
    return <CartQuantityEditor onOriginalCart={canCartDetail ? () => openOriginalCart(route.cartId) : undefined} command={cartQuantityCommands} store={quantityDrafts} cart={cart} item={item} locale={locale} onBack={back} />;
  }
  if (read.kind === "workspace-carts") return <CartWorkspaceRead beforeControls={<OrderReorderCartNotice model={orderReorderCommands} locale={locale} onOrder={orderId=>push({kind:"workflow",orderId})}/>} cartCheckout={cartCheckout} onCheckoutReceipt={canCheckoutRead ? openCheckoutReceipt : undefined} cartReprice={cartReprice} onRepriceResult={canCartDetail ? openRepriceResult : undefined} cartValidation={cartValidation} quantityCommands={cartQuantityCommands} onAttempt={openCartAttempt} onOriginalCart={canCartDetail ? openOriginalCart : undefined} visitedCursors={cartVisitedCursors} page={read.value} locale={locale} workspaceCommands={cartWorkspaceCommands} cartAddCommands={cartAddCommands} onCommandResult={canCartDetail ? openCartCommandResult : undefined} quantityDrafts={quantityDrafts} onDraft={onDraft} cursor={route.kind === "cart" ? route.cursor : undefined} retry={retry} onCart={canCartDetail ? cartId => openCartPageItem(read.value, cartId) : undefined} onRecoveredCart={canCartDetail ? source => openRecoveredCart(read.value, source) : undefined} onNext={cursor => nextCartPage(read.value, cursor)} />;
  if (read.kind === "cart") return <CartDetailRead attemptNotice={<CartAttemptReadNotice command={cartQuantityCommands} cartId={read.value.id} locale={locale} />} cart={read.value} locale={locale} onCheckout={canCheckoutRead ? () => openCartCheckout(read.value) : undefined} />;
  if (read.kind === "checkout") return <SavedCheckoutRead checkout={read.value} locale={locale} intentControls={canIntentFixture ? <CheckoutIntentFixtureLink checkout={read.value} buyerOrganizationId={buyerOrganizationId} locale={locale} onOpen={onIntent} /> : undefined} onOrder={orderId => openCheckoutOrder(read.value, orderId)} />;
  if (read.kind === "catalog") {
    if (route.kind === "catalog-filters" && read.value.offset !== route.offset) return <Notice title={catalogReadCopy[locale].changed} body={catalogReadCopy[locale].changedBody} />;
    if (route.kind === "catalog-filters") return <CatalogFiltersRead categoryLabel={catalogCommercial.referenceLabel("categoryId",route.categoryId)} supplierLabel={catalogCommercial.referenceLabel("supplierOrganizationId",route.supplierOrganizationId)} useReferenceChoices={catalogCommercial.supported() && read.value.filterOptions !== undefined} reference={catalogCommercial.supported() ? <CatalogReferenceFiltersUi model={catalogCommercial} page={read.value} context={{ q: route.q, categoryId: route.categoryId, supplierOrganizationId: route.supplierOrganizationId, cityId: catalogContextCityId }} applied={route.commercial} locale={locale} onSelect={(field,row) => applyCatalogFilter(read.value,field,row?.id,row)} /> : undefined} advanced={catalogCommercial.supported() ? <CatalogCommercialFiltersUi model={catalogCommercial} page={read.value} context={{ q: route.q, categoryId: route.categoryId, supplierOrganizationId: route.supplierOrganizationId, cityId: catalogContextCityId }} applied={route.commercial} locale={locale} onApply={values => applyCatalogCommercial(read.value,values)} /> : undefined} facets={read.value.facets} categoryId={route.categoryId} supplierOrganizationId={route.supplierOrganizationId} q={route.q} locale={locale} onSelect={(field, value) => applyCatalogFilter(read.value, field, value)} onClear={() => clearCatalogFilters(read.value)} />;
    return <CatalogListRead categoryLabel={route.kind === "catalog" ? catalogCommercial.referenceLabel("categoryId",route.categoryId) : undefined} supplierLabel={route.kind === "catalog" ? catalogCommercial.referenceLabel("supplierOrganizationId",route.supplierOrganizationId) : undefined} commercialSummary={route.kind === "catalog" && route.commercial && Object.values(route.commercial).some(value => value !== undefined) ? <Stack>{catalogCommercialSummary(catalogCommercial,route.commercial,locale).map((label,index) => <Text key={index}>{label}</Text>)}</Stack> : undefined} media={catalogMedia} onRefresh={retry} page={read.value} offset={route.kind === "catalog" ? route.offset : 0} categoryId={route.kind === "catalog" ? route.categoryId : undefined} supplierOrganizationId={route.kind === "catalog" ? route.supplierOrganizationId : undefined} locale={locale} onClear={() => clearCatalogFilters(read.value)} onNext={() => nextCatalogPage(read.value)} onVariant={(productId, variantId) => openCatalogVariant(read.value, productId, variantId)} />;
  }
  if (read.kind === "comparison") {
    if (route.kind === "offer") {
      const offer = selectComparedOffer(read.value, route.variantId, route.offerId);
      if (!offer) return <Notice title={t.unavailable} body={t.unavailableBody} />;
      return <OfferDetails conversationControls={<OfferConversationLauncher enabled={canOfferConversation&&offer.supplier.organizationId!==buyerOrganizationId&&read.value.selectedVariantId===route.variantId} locale={locale} onOpen={openOfferConversation}/>} comparison={read.value} offer={offer} locale={locale} attributes={<ComparisonAttributesRead comparison={read.value} productId={route.productId} variantId={route.variantId} locale={locale} />} reviewControls={<ReviewLaunchers comparison={read.value} offerId={offer.offerId} organizationId={buyerOrganizationId} canProduct={canProductReviews} canSupplier={canSupplierReviews} locale={locale} onProduct={() => openReviews()} onSupplier={openReviews} />} draftControls={<LocalListOfferAction store={localListDraft} comparison={read.value} offerId={offer.offerId} locale={locale} onOpen={onLocalListSelect} />} />;
    }
    return <ComparisonListRead comparison={read.value} locale={locale} attributes={<ComparisonAttributesRead comparison={read.value} productId={route.kind === "comparison" ? route.productId : ""} variantId={route.kind === "comparison" ? route.variantId : ""} locale={locale} />} controls={<ReviewLaunchers comparison={read.value} organizationId={buyerOrganizationId} canProduct={canProductReviews} canSupplier={false} locale={locale} onProduct={() => openReviews()} onSupplier={openReviews} />} onOffer={offerId => openComparedOffer(read.value, offerId)} />;
  }
  if (read.kind === "workspace-orders") {
    return <OrderListRead controls={canConversationInbox?<Button label={conversationInboxCopy[locale].open} onPress={openConversationInbox}/>:undefined} page={read.value} locale={locale} cursor={route.kind === "orders" ? route.cursor : undefined} statusFiltered={route.kind === "orders" && route.status !== undefined} visited={orderVisitedCursors} onNext={nextOrderPage} onOpen={openOrderPageItem} />;
  }
  if (read.kind === "workflow") {
    return <OrderWorkflowRead orderDocumentArchiveControls={orderDocumentArchive.supports(read.value)?<NativeOrderDocumentArchiveUi model={orderDocumentArchive} workflow={read.value} locale={locale} onReadOrder={retry}/>:undefined} paymentReductionControls={<Stack><NativePaymentReductionProposeUi model={paymentReductionProposals} workflow={read.value} locale={locale} onReadOrder={retry}/><NativePaymentReductionUi model={paymentReductions} workflow={read.value} locale={locale} onReadOrder={retry}/></Stack>} bulkGoodsReturnControls={<NativeGoodsReturnBulkUi command={goodsReturnCommands} store={goodsReturnDrafts} workflow={read.value} locale={locale} onReadOrder={retry}/>} bulkReceiptControls={receiptCommands&&<NativeShipmentBulkReceiptUi command={receiptCommands} store={receiptDrafts} workflow={read.value} locale={locale} onReadOrder={retry}/>} shipmentDetailsControls={shipment=><NativeShipmentFulfillmentUi model={shipmentFulfillment} workflow={read.value} shipment={shipment} locale={locale} onReadOrder={retry}/>} discrepancyControls={<NativeOrderDiscrepanciesUi draftActions={orderDiscrepancyDraftActions} createModel={orderDiscrepancyCreate} model={orderDiscrepancies} workflow={read.value} locale={locale} onReadOrder={retry}/>} checkoutControls={<NativeOrderCheckoutUi model={orderCheckout} workflow={read.value} locale={locale} />} manualPaymentControls={<ManualTransferUi model={manualTransfer} workflow={read.value} locale={locale} />} invoiceControls={<OrderInvoicesUi model={orderInvoices} workflow={read.value} locale={locale} onRefreshOrder={retry} />} transferControls={(claim,index)=><Stack><TransferSupportLauncher model={transferSupportLinks} workflow={read.value} claim={claim} index={index} locale={locale} onOpen={openTransferSupport}/><PaymentDisputeLauncher model={paymentDisputeCommands} workflow={read.value} claim={claim} index={index} locale={locale}/></Stack>} returnControls={record => <Stack><NativeManualRefundProofMetadataUi model={refundProofMetadata} workflow={read.value} record={record} index={(read.value.returns??[]).indexOf(record)} locale={locale} onReadOrder={retry} onOpenArchive={target=>{if(route.kind!=="workflow"&&route.kind!=="dashboard-order")return;replace({...route,panel:"documents"});void orderDocumentArchive.openLinked(target);}}/><RefundReceiveLauncher command={refundReceiveCommands} workflow={read.value} record={record} locale={locale}/><ReturnSendLauncher command={returnSendCommands} workflow={read.value} record={record} locale={locale}/></Stack>} history={projectOrderHistory(read.value, buyerOrganizationId, route.kind === "workflow" || route.kind === "dashboard-order" ? route.orderId : "")} goodsReturnControls={item => <GoodsReturnLauncher store={goodsReturnDrafts} workflow={read.value} item={item} locale={locale} onOpen={() => openGoodsReturnDraft(item.id)} />} receiptControls={(shipment, item) => <ReceiptDraftLauncher store={receiptDrafts} workflow={read.value} shipment={shipment} item={item} locale={locale} onOpen={() => openReceiptDraft(shipment.id, item.id)} />} cancellationControls={<Stack><MoneyReturnLauncher model={moneyReturnCommands} workflow={read.value} kind="CANCELLATION" locale={locale}/><MoneyReturnLauncher model={moneyReturnCommands} workflow={read.value} kind="OVERPAYMENT" locale={locale}/><MoneyReturnPanel model={moneyReturnCommands} orderId={read.value.orderId} locale={locale}/><PaymentDisputePanel model={paymentDisputeCommands} orderId={read.value.orderId} locale={locale}/><CompositionLauncher model={orderCompositionCommands} workflow={read.value} locale={locale}/><CompositionPanel model={orderCompositionCommands} orderId={read.value.orderId} locale={locale}/><OrderReorderLauncher model={orderReorderCommands} workflow={read.value} locale={locale}/><OrderReorderPanel model={orderReorderCommands} orderId={read.value.orderId} locale={locale} onCart={canCartDetail?cartId=>push({kind:"cart-detail",cartId}):undefined}/><RefundReceivePanel command={refundReceiveCommands} orderId={read.value.orderId} workflow={read.value} locale={locale}/><ReturnSendPanel command={returnSendCommands} orderId={read.value.orderId} workflow={read.value} locale={locale}/><GoodsReturnCommandPanel command={goodsReturnCommands} orderId={read.value.orderId} workflow={read.value} locale={locale} /><ReceiptCommandPanel command={receiptCommands} orderId={read.value.orderId} workflow={read.value} locale={locale} /><CancellationCommandPanel command={cancellationCommands} orderId={read.value.orderId} workflow={read.value} locale={locale} /><OrderCancellationLauncher store={cancellationDrafts} workflow={read.value} locale={locale} onOpen={openCancellationDraft} /></Stack>} commentControls={<Stack><BuyerReviewLauncher model={buyerReviewCreate} updates={buyerReviewUpdate} workflow={read.value} locale={locale}/>{canOrderConversation&&<OrderConversationLauncher workflow={read.value} organizationId={buyerOrganizationId} locale={locale} onOpen={openOrderConversation}/>}{canOrderComments&&<OrderCommentsLauncher workflow={read.value} organizationId={buyerOrganizationId} locale={locale} onOpen={openOrderComments}/>}</Stack>} workflow={read.value} unsupported={state.phase === "unsupported"} locale={locale} panel={route.kind === "workflow" || route.kind === "dashboard-order" ? route.panel ?? "items" : "items"} onPanelChange={panel => { if (route.kind === "workflow" || route.kind === "dashboard-order") replace({ ...route, panel }); }} retry={retry} />;
  }
  return <Notice title={t.unavailable} body={t.unavailableBody} />;
}

function OfferDetails({ conversationControls, comparison, offer, locale, draftControls, reviewControls, attributes }: { conversationControls?:React.ReactNode; attributes?: React.ReactNode; reviewControls?: React.ReactNode; comparison: OfferComparisonResponse; offer: OfferComparisonResponse["offers"][number]; locale: Locale; draftControls?: React.ReactNode }) {
  const t = copy[locale];
  const variant = comparison.variants.find((variant) => variant.id === offer.variantId);
  return <FlatList data={offer.availability} keyExtractor={(warehouse) => `${warehouse.warehouseId}:${warehouse.cityId}`} contentContainerStyle={styles.list} ListHeaderComponent={<Stack>
    <Surface>
      <Text kind="subtitle" strong>{comparison.product.name}</Text>
      {variant && <Text>{t.variant}: {variant.label}</Text>}
      <Text>{offer.supplier.name}</Text>
      <Text kind="caption" secondary>{t.price}</Text>
      <Text strong>{formatMinor(offer.price.amountMinor, offer.price.currency, locale) ?? t.priceUnknown}</Text>
      <Text>{t.normalized}: {formatMinor(offer.price.normalizedPriceMinor, offer.price.currency, locale) ?? t.priceUnknown} / {offer.price.normalizedUnit || t.unitUnknown}</Text>
      <Text>{t.packaging}: {offer.packaging.name}</Text>
      <Text>{t.packQuantity}: {offer.packaging.quantityInBaseUnit}</Text>
      <Text secondary>{offer.packaging.unit || t.unitUnknown}</Text>
      <Text>{t.minimum}: {offer.minimumOrderQuantity}</Text>
      <Text>{t.orderIncrement}: {offer.orderIncrement}</Text>
    </Surface>
    {attributes}
    {conversationControls}
    {draftControls}
    {reviewControls}
    {offer.markers.requiresConfirmation && <Notice title={t.confirmation} />}
  </Stack>} ListFooterComponent={<OfferDeliveryRead options={offer.delivery} locale={locale} />} ListEmptyComponent={<Notice title={t.stockUnknown} />} renderItem={({ item }) => {
    const expires = formatTimestamp(item.freshnessExpiresAt, locale);
    return <Surface><Text strong>{item.warehouse}</Text><Text>{t.stock}: {item.quantityAvailable}</Text>
      <Text secondary>{t.stockUpdated}: {formatTimestamp(item.updatedAt, locale) ?? t.dateUnknown}</Text>
      <Text secondary>{expires === null ? t.freshnessUnknown : `${t.freshnessExpires}: ${expires}`}</Text>
    </Surface>;
  }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette["surface.canvas"] },
  header: { padding: theme.space.page, gap: theme.space.medium },
  content: { flex: 1, paddingHorizontal: theme.space.page },
  list: { gap: theme.space.page, paddingBottom: theme.space.section },
});
