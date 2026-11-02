import type { NativeOrderDocumentAccountingClient } from "./native-order-document-accounting";
import { createNativeShipmentFulfillmentReads } from "./native-shipment-fulfillment-reads";
import { createNativeOrderDiscrepancyDraftActions } from "./native-order-discrepancy-draft-actions";
import { createNativeOrderDiscrepancyCreate } from "./native-order-discrepancy-create-model";
import type { NativeDiscrepancyCreateClient } from "./native-order-discrepancy-create";
import { createNativeOrderDiscrepancies } from "./native-order-discrepancies";
import type { NativeOrderDiscrepancyClient } from "./native-order-discrepancy-reads";
import { createNativeSupportReopen } from "./native-support-reopen";
import { createNativeOrderCheckout } from "./native-order-checkout";
import { nativePaymentIntentReadsAvailable, type NativePaymentIntentClient } from "./native-payment-intent-reads";
import { createCatalogCommercialFilters, type NativeCatalogCommercialClient } from "./catalog-commercial-filters";
import { createCatalogMediaPreview } from "./catalog-media-preview";
import type { NativeCatalogMediaClient } from "./native-catalog-media";
import type { NativePersonalProfileClient } from "./native-personal-profile";
import type { NativeOwnSessionsClient } from "./native-own-sessions";
import { createOrganizationOnboardingRead } from "./organization-onboarding-read";
import { createOrganizationProfileEdit } from "./organization-profile-edit";
import type { NativeOrganizationProfileClient } from "./native-organization-profile";
import type { NativeMfaClient } from "./native-mfa";
import { createAttachmentImages, type AttachmentParent } from "./attachment-images";
import type { NativeAttachmentImageClient } from "./native-attachment-images";
import { createManualTransferCommands } from "./manual-transfer";
import type { NativeManualTransferClient } from "./native-manual-transfer";
import { createOrderInvoiceReads, type NativeOrderInvoiceClient } from "./order-invoices";
import type { NativeBuyerWorkflowClient } from "./native-buyer-workflow-commands";
import type { NativeSupportClient } from "./native-support-commands";
import type { NativeCartClient } from "./native-cart-commands";
import type { NativeSavedListClient } from "./native-saved-list-commands";
import type { NativeConversationActionClient } from "./native-conversation-actions";
import type { NativeConversationMessageClient } from "./native-conversation-messages";
import { nativeOrderCommentAvailable, type NativeOrderCommentClient } from "./native-order-comment-commands";
import type { NativeConversationReadClient } from "./native-conversation-reads";
import { createBuyerReviewUpdates } from "./buyer-review-update";
import { createBuyerReviewCommands, type BuyerReviewClient } from "./buyer-review-create";
import { createOfferConversationInbox, type OfferInboxFixtureClient, type OfferInboxState, type OfferInboxPage, type OfferInboxRow } from "./offer-conversation-inbox";
import { createOfferConversationEscalate, type OfferEscalateFixtureClient } from "./offer-conversation-escalate";
import { createOfferConversationSupportLinks, type OfferSupportOrigin } from "./offer-conversation-support-link";
import { createOfferConversationSupportRead, type OfferConversationSupportQuery } from "./offer-conversation-support-read";
import { createOfferConversationResolve, type OfferResolveFixtureClient } from "./offer-conversation-resolve";
import { createOfferConversationReadMarker, type OfferReadMarkerFixtureClient } from "./offer-conversation-read-marker";
import { createOfferConversationMessages, type OfferMessagesFixtureClient } from "./offer-conversation-messages";
import { createOfferConversationRead, type OfferConversationFixtureClient, type OfferConversationReadState, type OfferConversationSelection, type OfferConversationWindow } from "./offer-conversation-read";
import { createOfferConversationDrafts } from "./offer-conversation-draft";
import { createOrderConversationInbox, type ConversationInboxFixtureClient, type ConversationInboxState, type ConversationInboxPage, type ConversationInboxRow } from "./order-conversation-inbox";
import { createOrderConversationEscalate, type ConversationEscalateFixtureClient } from "./order-conversation-escalate";
import { createConversationSupportReplyGuard } from "./conversation-support-reply-guard";
import { createConversationSupportLinks, type ConversationSupportOrigin } from "./conversation-support-link";
import { createConversationSupportRead, type ConversationSupportQuery } from "./conversation-support-read";
import { createOrderConversationResolve, type ConversationResolveFixtureClient } from "./order-conversation-resolve";
import { createOrderConversationStart, type ConversationStartFixtureClient } from "./order-conversation-start";
import { createConversationWriteContext } from "./conversation-write-context";
import { createConversationReadMarker, type ConversationReadMarkerFixtureClient } from "./order-conversation-read-marker";
import { createOrderConversationSend, type ConversationSendFixtureClient } from "./order-conversation-send";
import { createOrderConversationDrafts } from "./order-conversation-draft";
import { createOrderConversationRead, type OrderConversationFixtureClient, type OrderConversationReadState, type OrderConversationSelection, type OrderConversationWindow } from "./order-conversation-read";
import { createMoneyReturnCommands } from "./money-return-command";
import { createTransferSupportLinks } from "./transfer-support-link";
import { createNativeOrderDocumentArchive,type NativeOrderDocumentArchiveClient } from "./native-order-document-archive";
import { createNativeManualRefundProofMetadata } from "./native-manual-refund-proof-metadata";
import { createNativePaymentReductionProposals } from "./native-payment-reduction-propose";
import { createNativePaymentReductionDecisions } from "./native-payment-reduction-decision";
import { createPaymentDisputeCommands } from "./payment-dispute-command";
import { createOrderCompositionCommands } from "./order-composition-command";
import { createOrderCommentEditCommands, type OrderCommentEditFixtureClient } from "./order-comment-edit-command";
import { createOrderCommentCreateCommands, type OrderCommentCreateFixtureClient } from "./order-comment-create-command";
import { createOrderCommentCommandContext, authorizedOrderCommentMutation } from "./order-comment-command-context";
import { createOrderReorderCommands } from "./order-reorder-command";
import { createSavedListRemoveCommands, type SavedListRemoveFixtureClient } from "./saved-list-remove-command";
import { createSavedListCreateCommands, type SavedListCreateFixtureClient } from "./saved-list-create-command";
import { createSavedListCommandContext } from "./saved-list-command-context";
import { createSavedListItemCommands, type SavedListItemFixtureClient } from "./saved-list-item-command";
import { createRefundReceiveCommands } from "./refund-receive-command";
import { createReturnSendCommands } from "./return-send-command";
import { createGoodsReturnCommands } from "./goods-return-command";
import { createShipmentReceiptCommands } from "./shipment-receipt-command";
import { createOrderCancellationCommands } from "./order-cancellation-command";
import { createBuyerWorkflowKeys, type BuyerWorkflowFixtureClient } from "./order-workflow-command-fixture";
import { createCartCheckout } from "./cart-checkout-fixture";
import { createCartReprice } from "./cart-reprice-fixture";
import { createCartValidation } from "./cart-validation-fixture";
import { createCartAddCommands } from "./cart-add-command-fixture";
import { createCartWorkspaceCommands } from "./cart-workspace-command-fixture";
import { createCartQuantityCommands, type CartCommandFixtureClient } from "./cart-command-fixture";
import { createSupportReplyCommands } from "./support-reply-command-fixture";
import { createSupportCreateCommand, type SupportCommandFixtureClient } from "./support-command-fixture";
import { createGoodsReturnDrafts } from "./goods-return-draft";
import { createShipmentReceiptDrafts } from "./shipment-receipt-draft";
import { createOrderCancellationDrafts } from "./order-cancellation-draft";
import { createOrderCommentsFixtureRead, type OrderCommentsFixtureClient, type OrderCommentsFixtureState, type OrderCommentSelection } from "./order-comments-fixture-read";
import { createPublicCitiesFixtureRead, type PublicCitiesFixtureClient, type PublicCitiesFixtureState } from "./public-cities-fixture-read";
import { createPublishedReviewFixtureRead, type PublishedReviewFixtureClient, type PublishedReviewFixtureState, type ReviewSelection } from "./published-reviews-fixture-read";
import { createDocumentArchiveFixtureRead, type DocumentArchiveFixtureClient, type DocumentArchiveFixtureState, type ArchiveFixtureQuery } from "./document-archive-fixture-read";
import { createPaymentIntentFixtureRead, type PaymentIntentFixtureClient, type PaymentIntentFixtureState } from "./payment-intent-fixture-read";
import { createBuyerDashboardFixtureRead, type BuyerDashboardFixtureClient, type BuyerDashboardFixtureState } from "./buyer-dashboard-fixture-read";
import { createLocalListDraft } from "./local-list-draft";
import { createSavedListsFixtureRead, type SavedListsFixtureClient, type SavedListsFixtureState } from "./saved-lists-fixture-read";
import { createSupportReplyDrafts } from "./support-reply-draft";
import { createSupportTicketDraft } from "./support-ticket-draft";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import { type MobileReadClient as CoreReadClient, type MobileReadQuery as CoreReadQuery } from "../../../contracts/mobile-read/read-queries";
import { createScopedCoreReadQueries as createMobileReadQueries } from "./scoped-core-read-queries";
import type { MobileReadState as CoreReadState, ReadScope } from "../../../contracts/mobile-read/read-adapter";

export type { ReadScope };
export type MobileReadClient = NativeOrderDocumentAccountingClient & NativeOrderDocumentArchiveClient & NativeDiscrepancyCreateClient & NativeOrderDiscrepancyClient & NativePaymentIntentClient & NativeCatalogCommercialClient & NativeCatalogMediaClient & NativePersonalProfileClient & NativeOwnSessionsClient & NativeOrganizationProfileClient & NativeMfaClient & NativeAttachmentImageClient & NativeManualTransferClient & NativeOrderInvoiceClient & NativeBuyerWorkflowClient & NativeSupportClient & NativeCartClient & NativeSavedListClient & NativeConversationActionClient & NativeConversationMessageClient & NativeOrderCommentClient & NativeConversationReadClient & BuyerReviewClient & CoreReadClient & OfferInboxFixtureClient & OfferEscalateFixtureClient & OfferResolveFixtureClient & OfferReadMarkerFixtureClient & OfferMessagesFixtureClient & OfferConversationFixtureClient & ConversationInboxFixtureClient & ConversationEscalateFixtureClient & ConversationResolveFixtureClient & ConversationStartFixtureClient & ConversationReadMarkerFixtureClient & ConversationSendFixtureClient & OrderConversationFixtureClient & OrderCommentEditFixtureClient & OrderCommentCreateFixtureClient & SavedListRemoveFixtureClient & SavedListCreateFixtureClient & SavedListItemFixtureClient & BuyerWorkflowFixtureClient & CartCommandFixtureClient & SupportCommandFixtureClient & SavedListsFixtureClient & BuyerDashboardFixtureClient & PaymentIntentFixtureClient & DocumentArchiveFixtureClient & PublishedReviewFixtureClient & PublicCitiesFixtureClient & OrderCommentsFixtureClient;
export type MobileReadQuery = {kind:"offer-conversation-inbox";offset:number} | {kind:"offer-conversation";target:OfferConversationSelection} | {kind:"order-conversation-inbox";offset:number} | OfferConversationSupportQuery | ConversationSupportQuery | {kind:"order-conversation";target:OrderConversationSelection} | { kind: "order-comments"; target: OrderCommentSelection } | { kind: "public-cities" } | { kind: "published-reviews"; target: ReviewSelection } | CoreReadQuery | ArchiveFixtureQuery | { kind: "saved-lists" } | { kind: "buyer-dashboard" } | { kind: "dashboard-order"; orderId: string } | { kind: "payment-intent"; paymentIntentId: string; checkoutId: string };
export type MobileReadState = OfferInboxState | OfferConversationReadState | ConversationInboxState | CoreReadState | OrderConversationReadState | SavedListsFixtureState | BuyerDashboardFixtureState | PaymentIntentFixtureState | DocumentArchiveFixtureState | PublishedReviewFixtureState | PublicCitiesFixtureState | OrderCommentsFixtureState;
export type MarketSession = { scope: ReadScope; client: MobileReadClient; organizationName: string };
export type ReadView = { state: MobileReadState; queryKey: string | null };

let nextIdentity = 0;
/** Existing typed read consumer plus an explicit local fixture-only saved-list branch; no new HTTP/session layer. */
export function createReadController(session: Pick<MarketSession, "scope" | "client">) {
  const queries = createMobileReadQueries(session.scope, session.client);
  const reorderWorkspaceQueries = createMobileReadQueries(session.scope, session.client);
  const savedLists = createSavedListsFixtureRead(session.scope, session.client.savedListsFixture);
  const buyerDashboard = createBuyerDashboardFixtureRead(session.scope, session.client.buyerDashboardFixture);
  const offerConversation=createOfferConversationRead(session.scope,session.client.offerConversationFixture,session.client.nativeConversationReads);
  const offerConversationInbox=createOfferConversationInbox(session.scope,session.client.offerConversationInboxFixture,productId=>session.client.compareOffers({buyerOrganizationId:session.scope.organizationId,productId,quantity:1}),(raw,binding)=>offerConversation.selectKnown(raw,binding),(raw,binding)=>offerConversation.selectSummary(raw,binding),session.client.nativeConversationReads);
  let offerMessageLocked=(_offerId:string)=>false;
  const offerConversationDrafts=createOfferConversationDrafts(session.scope,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},id=>offerMessageLocked(id));
  const orderConversation = createOrderConversationRead(session.scope,session.client);
  const orderConversationInbox=createOrderConversationInbox(session.scope,session.client.orderConversationInboxFixture,id=>session.client.getOrderWorkflow(id),(raw,binding)=>orderConversation.selectKnown(raw,binding),session.client.nativeConversationReads);
  const conversationSupportLinks=createConversationSupportLinks(session.scope,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},typeof session.client.supportTicket==="function");
  const conversationSupportRead=createConversationSupportRead(session.scope,session.client,conversationSupportLinks);
  const offerConversationSupportLinks=createOfferConversationSupportLinks(session.scope,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},typeof session.client.supportTicket==="function");
  const offerConversationSupportRead=createOfferConversationSupportRead(session.scope,session.client,offerConversationSupportLinks);
  const conversationWriteContext=createConversationWriteContext(session.scope);
  let offerEscalateLocked=(_offerId:string)=>false;
  let offerResolveLocked=(_offerId:string)=>false;
  const offerConversationMessages=createOfferConversationMessages(session.scope,session.client.offerConversationMessagesFixture,offerConversationDrafts,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="offer-conversation")return null;const work=offerConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},{native:session.client.nativeConversationMessages,context:conversationWriteContext,otherWriteLocked:id=>offerResolveLocked(id)||offerEscalateLocked(id),supportsRead:offerConversation.supportsRead(),isContextActive:review=>!closed&&queryKind==="offer-conversation"&&offerConversation.hasCurrentContext(review.offerId,review.productId,review.variantId,review.buyerOrganizationId,review.supplierOrganizationId,review.conversationId),onAuthenticationIssue:()=>{if(!closed&&queryKind==="offer-conversation"){offerConversation.failAccess("authentication-required");publish();}}});
  offerMessageLocked=id=>offerConversationMessages.blocksDraft(id);
  const offerConversationResolve=createOfferConversationResolve(session.scope,session.client.offerConversationResolveFixture,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="offer-conversation")return null;const work=offerConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},window=>offerConversationMessages.blocksOwnWrite(window.context.offerId)||offerEscalateLocked(window.context.offerId),offerConversation.supportsRead(),review=>!closed&&queryKind==="offer-conversation"&&offerConversation.hasCurrentContext(review.offerId,review.productId,review.variantId,review.buyerOrganizationId,review.supplierOrganizationId,review.conversationId),()=>{if(!closed&&queryKind==="offer-conversation"){offerConversation.failAccess("authentication-required");publish();}},conversationWriteContext,session.client.nativeConversationActions);
  offerResolveLocked=id=>offerConversationResolve.blocksOffer(id);
  const offerConversationEscalate=createOfferConversationEscalate(session.scope,session.client.offerConversationEscalateFixture,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="offer-conversation")return null;const work=offerConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},window=>offerConversationMessages.blocksOwnWrite(window.context.offerId)||offerConversationResolve.blocksOffer(window.context.offerId),offerConversation.supportsRead(),review=>!closed&&queryKind==="offer-conversation"&&offerConversation.hasCurrentContext(review.offerId,review.productId,review.variantId,review.buyerOrganizationId,review.supplierOrganizationId,review.conversationId),()=>{if(!closed&&queryKind==="offer-conversation"){offerConversation.failAccess("authentication-required");publish();}},conversationWriteContext,session.client.nativeConversationActions);
  offerEscalateLocked=id=>offerConversationEscalate.blocksOffer(id);
  const offerConversationReadMarker=createOfferConversationReadMarker(session.scope,session.client.offerConversationReadMarkerFixture,()=>{const state=currentState();return !closed&&queryKind==="offer-conversation"&&"read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="offer-conversation")return null;const work=offerConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="offer-conversation"?state.read.value:null;},phase=>{if(!closed&&queryKind==="offer-conversation"){offerConversation.failAccess(phase);publish();}},offerConversation.supportsRead(),review=>!closed&&queryKind==="offer-conversation"&&offerConversation.hasCurrentContext(review.offerId,review.productId,review.variantId,review.buyerOrganizationId,review.supplierOrganizationId,review.conversationId),session.client.nativeConversationActions);
  let conversationEscalateOrderLocked=(_orderId:string)=>false;
  let conversationResolveOrderLocked=(_orderId:string)=>false;
  let conversationStartOrderLocked=(_orderId:string)=>false;
  let conversationDraftLocked=(_id:string)=>false;
  const orderConversationDrafts = createOrderConversationDrafts(session.scope,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},id=>conversationDraftLocked(id));
  const orderConversationSend=createOrderConversationSend(session.scope,session.client.orderConversationSendFixture,orderConversationDrafts,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="order-conversation")return null;const work=orderConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},orderConversation.supportsRead(),(orderId,id)=>!closed&&queryKind==="order-conversation"&&orderConversation.hasCurrentContext(orderId,id),()=>{if(!closed&&queryKind==="order-conversation"){orderConversation.failAccess("authentication-required");publish();}},conversationWriteContext,orderId=>conversationEscalateOrderLocked(orderId)||conversationStartOrderLocked(orderId)||conversationResolveOrderLocked(orderId),session.client.nativeConversationMessages);
  conversationDraftLocked=id=>orderConversationSend.blocksDraft(id);
  const orderConversationStart=createOrderConversationStart(session.scope,session.client.orderConversationStartFixture,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="order-conversation")return null;const work=orderConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},window=>conversationEscalateOrderLocked(window.context.orderId)||conversationResolveOrderLocked(window.context.orderId)||!!window.conversation&&orderConversationSend.blocksOwnWrite(window.conversation.id),orderConversation.supportsRead(),review=>!closed&&queryKind==="order-conversation"&&orderConversation.hasCurrentOrderContext(review.orderId,review.buyerOrganizationId,review.supplierOrganizationId),()=>{if(!closed&&queryKind==="order-conversation"){orderConversation.failAccess("authentication-required");publish();}},conversationWriteContext,session.client.nativeConversationMessages);
  conversationStartOrderLocked=orderId=>orderConversationStart.blocksExistingSend(orderId);
  const orderConversationResolve=createOrderConversationResolve(session.scope,session.client.orderConversationResolveFixture,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="order-conversation")return null;const work=orderConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},window=>conversationEscalateOrderLocked(window.context.orderId)||orderConversationStart.blocksExistingSend(window.context.orderId)||!!window.conversation&&orderConversationSend.blocksOwnWrite(window.conversation.id),orderConversation.supportsRead(),review=>!closed&&queryKind==="order-conversation"&&orderConversation.hasCurrentContext(review.orderId,review.conversationId),()=>{if(!closed&&queryKind==="order-conversation"){orderConversation.failAccess("authentication-required");publish();}},conversationWriteContext,session.client.nativeConversationActions);
  conversationResolveOrderLocked=orderId=>orderConversationResolve.blocksOrder(orderId);
  const orderConversationEscalate=createOrderConversationEscalate(session.scope,session.client.orderConversationEscalateFixture,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="order-conversation")return null;const work=orderConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},window=>orderConversationResolve.blocksOrder(window.context.orderId)||orderConversationStart.blocksExistingSend(window.context.orderId)||!!window.conversation&&orderConversationSend.blocksOwnWrite(window.conversation.id),orderConversation.supportsRead(),review=>!closed&&queryKind==="order-conversation"&&orderConversation.hasCurrentContext(review.orderId,review.conversationId),()=>{if(!closed&&queryKind==="order-conversation"){orderConversation.failAccess("authentication-required");publish();}},conversationWriteContext,session.client.nativeConversationActions);
  conversationEscalateOrderLocked=orderId=>orderConversationEscalate.blocksOrder(orderId);
  const orderConversationReadMarker=createConversationReadMarker(session.scope,session.client.orderConversationReadMarkerFixture,()=>{const state=currentState();return !closed&&queryKind==="order-conversation"&&"read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},async()=>{if(closed||queryKind!=="order-conversation")return null;const work=orderConversation.refresh();publish();await work;publish();const state=currentState();return "read"in state&&state.read.kind==="order-conversation"?state.read.value:null;},phase=>{if(!closed&&queryKind==="order-conversation"){orderConversation.failAccess(phase);publish();}},orderConversation.supportsRead(),(orderId,id)=>!closed&&queryKind==="order-conversation"&&orderConversation.hasCurrentContext(orderId,id),session.client.nativeConversationActions);
  const orderComments = createOrderCommentsFixtureRead(session.scope, session.client.orderCommentsFixture,()=>(session.client.nativeOrderCommentCommands?nativeOrderCommentAvailable(session.client.nativeOrderCommentCommands,session.scope):authorizedOrderCommentMutation(session.scope,session.client.orderCommentEditCommandFixture?.authorization)&&typeof session.client.orderCommentEditCommandFixture?.updateOrderComment==="function")&&orderCommentCommandContext.isActive()&&!orderCommentCommandContext.authorityIssue()&&!orderCommentCommandContext.isOrderDenied(queryCommentOrderId??""));
  const orderCommentCommandContext = createOrderCommentCommandContext(session.scope);
  const orderCommentCreateCommands = createOrderCommentCreateCommands(session.scope,session.client.orderCommentCreateCommandFixture,
    orderId => { const state = currentState(); return !closed && queryKind === "order-comments" && "read" in state && state.read.kind === "order-comments" && state.read.value.context.orderId === orderId ? state.read.value : null; },
    async orderId => { if (queryCommentOrderId !== orderId || queryKind !== "order-comments") return undefined; const work = orderComments.refresh(); publish(); await work; publish(); const state = currentState(); return "read" in state && state.read.kind === "order-comments" && state.read.value.context.orderId === orderId ? state.read.value : undefined; },
    orderId => !closed && queryKind === "order-comments" && queryCommentOrderId === orderId,()=>false,typeof session.client.orderCommentsFixture === "function",orderCommentCommandContext,session.client.nativeOrderCommentCommands);
  const orderCommentEditCommands = createOrderCommentEditCommands(session.scope,session.client.orderCommentEditCommandFixture,
    orderId => { const state = currentState(); return !closed && queryKind === "order-comments" && "read" in state && state.read.kind === "order-comments" && state.read.value.context.orderId === orderId ? state.read.value : null; },
    async orderId => { if (queryCommentOrderId !== orderId || queryKind !== "order-comments") return undefined; const work = orderComments.refresh(); publish(); await work; publish(); const state = currentState(); return "read" in state && state.read.kind === "order-comments" && state.read.value.context.orderId === orderId ? state.read.value : undefined; },
    orderId => !closed && queryKind === "order-comments" && queryCommentOrderId === orderId,
    (window,row)=>orderComments.editableSource(window,row),typeof session.client.orderCommentsFixture === "function",orderCommentCommandContext,session.client.nativeOrderCommentCommands);
  const publicCities = createPublicCitiesFixtureRead(session.scope, session.client.publicCitiesFixture);
  const publishedReviews = createPublishedReviewFixtureRead(session.scope, session.client);
  const documentArchive = createDocumentArchiveFixtureRead(session.scope, session.client);
  const paymentIntent = createPaymentIntentFixtureRead(session.scope, session.client.paymentIntentFixture, session.client.nativePaymentIntentReads);
  const buyerOrganizationId = session.scope.organizationId;
  const buyerScopeError: MobileReadState = Object.freeze({ phase: "contract-error" });
  const buyerReviewCreate = createBuyerReviewCommands(session.scope, session.client.buyerReviewCommandPort, orderId => {
    const state = currentState();
    return !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null;
  }, id => buyerReviewUpdate.blocksTargetSwitch(id));
  const buyerReviewUpdate = createBuyerReviewUpdates(session.scope, session.client.buyerReviewCommandPort, orderId => {
    const state = currentState();
    return !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null;
  });
  const orderCheckout = createNativeOrderCheckout(session.scope, session.client.nativePaymentIntentReads, orderId => {
    const state=currentState();return !closed&&(queryKind==="workflow"||queryKind==="dashboard-order")&&queryWorkflowOrderId===orderId&&"read"in state&&state.read.kind==="workflow"&&state.read.value.orderId===orderId?state.read.value:null;
  });
  const orderDiscrepancies = createNativeOrderDiscrepancies(session.scope,session.client.nativeOrderDiscrepancyReads,orderId=>{const state=currentState();return !closed&&(queryKind==="workflow"||queryKind==="dashboard-order")&&queryWorkflowOrderId===orderId&&"read"in state&&state.read.kind==="workflow"&&state.read.value.orderId===orderId?state.read.value:null;});
  const shipmentFulfillment = createNativeShipmentFulfillmentReads(session.scope,orderId=>{const state=currentState();return !closed&&(queryKind==="workflow"||queryKind==="dashboard-order")&&queryWorkflowOrderId===orderId&&"read"in state&&state.read.kind==="workflow"&&state.read.value.orderId===orderId?state.read.value:null;});
  const orderDiscrepancyCreate = createNativeOrderDiscrepancyCreate(session.scope,session.client.nativeDiscrepancyCreate,orderDiscrepancies,orderId=>{const state=currentState();return !closed&&(queryKind==="workflow"||queryKind==="dashboard-order")&&queryWorkflowOrderId===orderId&&"read"in state&&state.read.kind==="workflow"&&state.read.value.orderId===orderId?state.read.value:null;});
  const orderDiscrepancyDraftActions = createNativeOrderDiscrepancyDraftActions(session.scope,session.client.nativeDiscrepancyCreate,orderDiscrepancies,orderId=>{const state=currentState();return !closed&&(queryKind==="workflow"||queryKind==="dashboard-order")&&queryWorkflowOrderId===orderId&&"read"in state&&state.read.kind==="workflow"&&state.read.value.orderId===orderId?state.read.value:null;});
  const orderInvoices = createOrderInvoiceReads(session.scope, session.client.nativeOrderInvoices, orderId => {
    const state = currentState(); return !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null;
  });
  const goodsReturnDrafts = createGoodsReturnDrafts(session.scope);
  const receiptDrafts = createShipmentReceiptDrafts(session.scope);
  const cancellationDrafts = createOrderCancellationDrafts(session.scope);
  const quantityDrafts = createCartQuantityDrafts(session.scope);
  const buyerWorkflowKeys = createBuyerWorkflowKeys(session.scope, session.client.buyerWorkflowCommandFixture, session.client.nativeBuyerWorkflowCommands);
  let paymentReductionProposalLocked: (id: string) => boolean = () => false;
  let paymentReductionOrderLocked: (id: string) => boolean = () => false;
  let manualTransferOrderLocked: (id: string) => boolean = () => false;
  let moneyReturnOrderLocked: (id: string) => boolean = () => false;
  let disputeOrderLocked: (id: string) => boolean = () => false;
  let compositionOrderLocked: (id: string) => boolean = () => false;
  let reorderOrderLocked: (id: string) => boolean = () => false;
  let reorderCartLocked: () => boolean = () => false;
  let refundReceiveOrderLocked: (id: string) => boolean = () => false;
  let returnSendOrderLocked: (id: string) => boolean = () => false;
  let returnOrderLocked: (id: string) => boolean = () => false;
  let receiptOrderLocked: (id: string) => boolean = () => false;
  const reloadBuyerWorkflow = async (orderId: string) => {
    if (closed || queryWorkflowOrderId !== orderId || queryKind !== "workflow" && queryKind !== "dashboard-order") return undefined;
    const before = queries.getState(), selection = queryKey;
    const work = queries.refresh(); publish();
    const outcome = await work; publish();
    if (closed || queryWorkflowOrderId !== orderId || queryKey !== selection || outcome !== "applied" || queries.getState() === before) return undefined;
    const state = currentState();
    return "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : undefined;
  };
  const cancellationCommands = createOrderCancellationCommands(session.scope, session.client.buyerWorkflowCommandFixture, cancellationDrafts,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || receiptOrderLocked(id) || returnOrderLocked(id) || returnSendOrderLocked(id) || refundReceiveOrderLocked(id) || reorderOrderLocked(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  const receiptCommands = createShipmentReceiptCommands(session.scope, session.client.buyerWorkflowCommandFixture, receiptDrafts,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || returnOrderLocked(id) || returnSendOrderLocked(id) || refundReceiveOrderLocked(id) || reorderOrderLocked(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  const goodsReturnCommands = createGoodsReturnCommands(session.scope, session.client.buyerWorkflowCommandFixture, goodsReturnDrafts,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || returnSendOrderLocked(id) || refundReceiveOrderLocked(id) || reorderOrderLocked(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  const returnSendCommands = createReturnSendCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || refundReceiveOrderLocked(id) || reorderOrderLocked(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, undefined, session.client.nativeBuyerWorkflowCommands);
  const refundReceiveCommands = createRefundReceiveCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || reorderOrderLocked(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  refundReceiveOrderLocked = id => refundReceiveCommands.blocksOtherCommands(id);
  returnSendOrderLocked = id => returnSendCommands.blocksOtherCommands(id);
  returnOrderLocked = id => goodsReturnCommands.blocksOtherCommands(id);
  receiptOrderLocked = id => receiptCommands.blocksOtherCommands(id);
  const localListDraft = createLocalListDraft(session.scope);
  const savedListCommandContext = createSavedListCommandContext(session.scope);
  let savedListCreateLocked: () => boolean = () => false;
  let savedListRemoveLocked: () => boolean = () => false;
  const savedListItemCommands = createSavedListItemCommands(session.scope, session.client.savedListItemCommandFixture, localListDraft,
    () => { const state = currentState(); return !closed && "read" in state && state.read.kind === "comparison" ? state.read.value : null; },
    () => { const state = currentState(); return !closed && queryKind === "saved-lists" && "read" in state && state.read.kind === "saved-lists" ? state.read.value : null; },
    async () => { if (queryKind !== "saved-lists") return undefined; const work = savedLists.load(); publish(); await work; publish(); const state = currentState(); return "read" in state && state.read.kind === "saved-lists" ? state.read.value : undefined; },
    () => !closed && queryKind === "saved-lists", () => savedListCreateLocked() || savedListRemoveLocked(), typeof session.client.savedListsFixture === "function", savedListCommandContext,session.client.nativeSavedListCommands);
  const savedListCreateCommands = createSavedListCreateCommands(session.scope, session.client.savedListCreateCommandFixture,
    () => { const state = currentState(); return !closed && queryKind === "saved-lists" && "read" in state && state.read.kind === "saved-lists" ? state.read.value : null; },
    async () => { if (queryKind !== "saved-lists") return undefined; const work = savedLists.load(); publish(); await work; publish(); const state = currentState(); return "read" in state && state.read.kind === "saved-lists" ? state.read.value : undefined; },
    () => !closed && queryKind === "saved-lists", () => savedListItemCommands.blocksOtherMutations() || savedListRemoveLocked(), typeof session.client.savedListsFixture === "function", savedListCommandContext,session.client.nativeSavedListCommands);
  const savedListRemoveCommands = createSavedListRemoveCommands(session.scope, session.client.savedListRemoveCommandFixture,
    () => { const state = currentState(); return !closed && queryKind === "saved-lists" && "read" in state && state.read.kind === "saved-lists" ? state.read.value : null; },
    async () => { if (queryKind !== "saved-lists") return undefined; const work = savedLists.load(); publish(); await work; publish(); const state = currentState(); return "read" in state && state.read.kind === "saved-lists" ? state.read.value : undefined; },
    () => !closed && queryKind === "saved-lists", () => savedListItemCommands.blocksOtherMutations() || savedListCreateCommands.blocksOtherMutations(), typeof session.client.savedListsFixture === "function", savedListCommandContext,session.client.nativeSavedListCommands);
  savedListRemoveLocked = () => savedListRemoveCommands.blocksOtherMutations();
  savedListCreateLocked = () => savedListCreateCommands.blocksOtherMutations();
  const supportTicketDraft = createSupportTicketDraft(session.scope);
  const supportReplyDrafts = createSupportReplyDrafts(session.scope);
  const conversationSupportReplyGuard = createConversationSupportReplyGuard(session.scope, conversationSupportLinks, session.client.supportCommandFixture, conversationWriteContext, () => {
    const state = currentState();
    return { origin: queryConversationSupportOrigin, queryActive: !closed && queryKind === "conversation-support-ticket", phase: state.phase, ticket: "read" in state && state.read.kind === "support-ticket" ? state.read.value : null };
  }, session.client.nativeSupportCommands);
  const offerSupportReplyGuard = createConversationSupportReplyGuard(session.scope, offerConversationSupportLinks, session.client.supportCommandFixture, conversationWriteContext, () => {
    const state = currentState();
    return { origin: queryOfferSupportOrigin, queryActive: !closed && queryKind === "offer-conversation-support-ticket", phase: state.phase, ticket: "read" in state && state.read.kind === "support-ticket" ? state.read.value : null };
  }, session.client.nativeSupportCommands);
  const supportAccessIssue = (issue: "authentication" | "denied") => {
    conversationWriteContext.deny(issue);
    if (!closed && issue === "authentication") {
      if (queryKind === "offer-conversation-support-ticket") offerConversationSupportRead.failAccess("authentication-required");
      if (queryKind === "conversation-support-ticket") conversationSupportRead.failAccess("authentication-required");
      if (queryKind === "order-conversation") orderConversation.failAccess("authentication-required");
      publish();
    }
  };
  const supportCreateCommand = createSupportCreateCommand(session.scope, session.client.supportCommandFixture, supportTicketDraft, { isAvailable: conversationSupportReplyGuard.allow, onAccessIssue: supportAccessIssue }, session.client.nativeSupportCommands);
  let reopenTicketLocked: (id:string)=>boolean=()=>false;
  const supportReplyAllowed=()=>{if(!conversationSupportReplyGuard.allowReply()||!offerSupportReplyGuard.allowReply())return false;const state=currentState();return !("read" in state&&state.read.kind==="support-ticket")||!reopenTicketLocked(state.read.value.id);};
  const supportReplyCommands = createSupportReplyCommands(session.scope, session.client.supportCommandFixture, supportReplyDrafts, () => {
    const state = currentState(); if (closed || !("read" in state) || state.read.kind !== "support-ticket") return null;
    if(queryOfferSupportOrigin&&!offerConversationSupportLinks.accepts(state.read.value,queryOfferSupportOrigin))return null;
    return queryConversationSupportOrigin && !conversationSupportLinks.accepts(state.read.value, queryConversationSupportOrigin) ? null : state.read.value;
  }, { isAvailable: supportReplyAllowed, captureContext: ticket => queryOfferSupportOrigin ? offerSupportReplyGuard.capture(ticket) : conversationSupportReplyGuard.capture(ticket), isContextCurrent: proof => conversationSupportReplyGuard.isCurrent(proof) || offerSupportReplyGuard.isCurrent(proof), onAccessIssue: supportAccessIssue }, session.client.nativeSupportCommands);
  const supportReopen=createNativeSupportReopen(session.scope,session.client.nativeSupportCommands,()=>{const state=currentState();return !closed&&queryKind==="support-ticket"&&!queryConversationSupportOrigin&&!queryOfferSupportOrigin&&"read" in state&&state.read.kind==="support-ticket"?state.read.value:null;},{isAvailable:()=>conversationSupportReplyGuard.allowReply()&&offerSupportReplyGuard.allowReply(),otherWriteLocked:ticket=>["pending","unknown","invalid-result"].includes(supportReplyCommands.stateFor(ticket).phase),captureContext:ticket=>conversationSupportReplyGuard.capture(ticket),isContextCurrent:proof=>conversationSupportReplyGuard.isCurrent(proof),onAccessIssue:supportAccessIssue});
  reopenTicketLocked=id=>supportReopen.blocksTicket(id);
  let unsubscribeSupportAuthority = conversationWriteContext.subscribe(() => { supportCreateCommand.denyAccess(); supportReplyCommands.denyAll(); supportReopen.denyAll(); supportReplyDrafts.clear(); offerConversationDrafts.clear(); supportTicketDraft.setReadAccess(session.scope, false); });
  let workspaceMutationLocked: () => boolean = () => false;
  let additionMutationLocked: () => boolean = () => false;
  let validationPending: () => boolean = () => false;
  let repriceLocked: () => boolean = () => false;
  let checkoutLocked: () => boolean = () => false;
  const reloadCartWorkspace = async () => {
    if (closed || queryKind !== "workspace-carts") return undefined;
    const before = queries.getState(), selection = queryKey;
    const work = queries.refresh(); publish();
    const outcome = await work; publish();
    const state = queries.getState();
    // An older DTO can retain the previous ready state; that view is not a new reconciliation observation.
    if (closed || queryKind !== "workspace-carts" || queryKey !== selection || outcome !== "applied" || state === before) return undefined;
    return "read" in state && state.read.kind === "workspace-carts" ? state.read.value : undefined;
  };
  const cartQuantityCommands = createCartQuantityCommands(session.scope, session.client.cartCommandFixture, quantityDrafts, () => { const state = currentState(); return "read" in state && state.read.kind === "workspace-carts" ? state.read.value.current : null; }, async () => (await reloadCartWorkspace())?.current, () => reorderCartLocked() || checkoutLocked() || repriceLocked() || validationPending() || workspaceMutationLocked() || additionMutationLocked(), () => { const state = currentState(); return queryKind === "workspace-carts" && "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; }, session.client.nativeCartCommands);
  const cartWorkspaceCommands = createCartWorkspaceCommands(session.scope, session.client.cartCommandFixture,
    () => { const state = currentState(); return "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; },
    reloadCartWorkspace,
    () => reorderCartLocked() || checkoutLocked() || repriceLocked() || validationPending() || additionMutationLocked() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle", "observed"].includes(state.phase)),
    () => !closed && queryKind === "workspace-carts", session.client.nativeCartCommands);
  workspaceMutationLocked = () => cartWorkspaceCommands.blocksOtherMutations();
  const cartAddCommands = createCartAddCommands(session.scope, session.client.cartCommandFixture, localListDraft,
    () => { const state = currentState(); return "read" in state && state.read.kind === "comparison" ? state.read.value : null; },
    () => { const state = currentState(); return "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; },
    reloadCartWorkspace,
    () => reorderCartLocked() || checkoutLocked() || repriceLocked() || validationPending() || cartWorkspaceCommands.blocksOtherMutations() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle", "observed"].includes(state.phase)),
    () => !closed && queryKind === "workspace-carts", typeof session.client.workspaceCarts === "function", session.client.nativeCartCommands);
  additionMutationLocked = () => cartAddCommands.blocksOtherMutations();
  const cartValidation = createCartValidation(session.scope, session.client.cartCommandFixture,
    () => { const state = currentState(); return !closed && queryKind === "workspace-carts" && "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; },
    () => reorderCartLocked() || checkoutLocked() || repriceLocked() || cartWorkspaceCommands.blocksOtherMutations() || cartAddCommands.blocksOtherMutations() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle", "observed"].includes(state.phase)), session.client.nativeCartCommands);
  validationPending = () => cartValidation.blocksOtherMutations();
  const cartReprice = createCartReprice(session.scope, session.client.cartCommandFixture, cartValidation,
    () => { const state = currentState(); return !closed && queryKind === "workspace-carts" && "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; },
    reloadCartWorkspace,
    () => reorderCartLocked() || checkoutLocked() || validationPending() || cartWorkspaceCommands.blocksOtherMutations() || cartAddCommands.blocksOtherMutations() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle", "observed"].includes(state.phase)),
    () => !closed && queryKind === "workspace-carts", session.client.nativeCartCommands);
  repriceLocked = () => cartReprice.blocksOtherMutations();
  const cartCheckout = createCartCheckout(session.scope, session.client.cartCommandFixture, cartValidation, quantityDrafts,
    () => { const state = currentState(); return !closed && queryKind === "workspace-carts" && "read" in state && state.read.kind === "workspace-carts" ? state.read.value : null; },
    reloadCartWorkspace,
    () => reorderCartLocked() || repriceLocked() || validationPending() || cartWorkspaceCommands.blocksOtherMutations() || cartAddCommands.blocksOtherMutations() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle", "observed"].includes(state.phase)),
    () => !closed && queryKind === "workspace-carts", session.client.nativeCartCommands);
  checkoutLocked = () => cartCheckout.blocksOtherMutations();
  const orderReorderCommands = createOrderReorderCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    async () => {
      if (closed) return undefined;
      const before = reorderWorkspaceQueries.getState();
      const outcome = await reorderWorkspaceQueries.load({ kind: "workspace-carts", input: {} });
      const state = reorderWorkspaceQueries.getState();
      return !closed && outcome === "applied" && state !== before && "read" in state && state.read.kind === "workspace-carts" ? state.read.value : undefined;
    },
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || compositionOrderLocked(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id),
    () => cartCheckout.blocksOtherMutations() || cartReprice.blocksOtherMutations() || cartValidation.blocksOtherMutations() || cartWorkspaceCommands.blocksOtherMutations() || cartAddCommands.blocksOtherMutations() || Object.values(cartQuantityCommands.getSnapshot()).some(state => !["idle","observed"].includes(state.phase)),
    buyerWorkflowKeys, typeof session.client.workspaceCarts === "function", session.client.nativeBuyerWorkflowCommands);
  reorderOrderLocked = id => orderReorderCommands.blocksOtherCommands(id);
  reorderCartLocked = () => orderReorderCommands.blocksCartMutations();
  const orderCompositionCommands = createOrderCompositionCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || disputeOrderLocked(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  compositionOrderLocked = id => orderCompositionCommands.blocksOtherCommands(id);
  const paymentDisputeCommands = createPaymentDisputeCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || orderCompositionCommands.blocksOtherCommands(id) || moneyReturnOrderLocked(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  disputeOrderLocked = id => paymentDisputeCommands.blocksOtherCommands(id);
  const moneyReturnCommands = createMoneyReturnCommands(session.scope, session.client.buyerWorkflowCommandFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || orderCompositionCommands.blocksOtherCommands(id) || paymentDisputeCommands.blocksOtherCommands(id), buyerWorkflowKeys, session.client.nativeBuyerWorkflowCommands);
  moneyReturnOrderLocked = id => moneyReturnCommands.blocksOtherCommands(id);
  const organizationProfile = createOrganizationProfileEdit(session.scope, session.client.nativeOrganizationProfile);
  const organizationOnboarding = createOrganizationOnboardingRead(session.scope, session.client.nativeOrganizationProfile, () => organizationProfile.getSnapshot().profile?.version);
  const manualTransfer = createManualTransferCommands(session.scope, session.client.nativeManualTransfer,
    id => { const state = currentState(); return !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === id && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === id ? state.read.value : null; },
    reloadBuyerWorkflow, buyerWorkflowKeys,
    id => paymentReductionProposalLocked(id) || paymentReductionOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || orderCompositionCommands.blocksOtherCommands(id) || paymentDisputeCommands.blocksOtherCommands(id) || moneyReturnCommands.blocksOtherCommands(id));
  manualTransferOrderLocked = id => manualTransfer.blocksOtherCommands(id);
  const paymentReductions = createNativePaymentReductionDecisions(session.scope, session.client.nativeBuyerWorkflowCommands, buyerWorkflowKeys,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => paymentReductionProposalLocked(id) || manualTransferOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || orderCompositionCommands.blocksOtherCommands(id) || paymentDisputeCommands.blocksOtherCommands(id) || moneyReturnCommands.blocksOtherCommands(id));
  paymentReductionOrderLocked = id => paymentReductions.blocksOtherCommands(id);
  const paymentReductionProposals = createNativePaymentReductionProposals(session.scope, session.client.nativeBuyerWorkflowCommands, buyerWorkflowKeys,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    reloadBuyerWorkflow,
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId,
    id => manualTransferOrderLocked(id) || paymentReductionOrderLocked(id) || cancellationCommands.blocksOtherCommands(id) || receiptCommands.blocksOtherCommands(id) || goodsReturnCommands.blocksOtherCommands(id) || returnSendCommands.blocksOtherCommands(id) || refundReceiveCommands.blocksOtherCommands(id) || orderReorderCommands.blocksOtherCommands(id) || orderCompositionCommands.blocksOtherCommands(id) || paymentDisputeCommands.blocksOtherCommands(id) || moneyReturnCommands.blocksOtherCommands(id));
  paymentReductionProposalLocked = id => paymentReductionProposals.blocksOtherCommands(id);
  const refundProofMetadata = createNativeManualRefundProofMetadata(session.scope, session.client.archiveDocumentFixture,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId);
  const orderDocumentArchive = createNativeOrderDocumentArchive(session.scope, session.client.nativeOrderDocumentArchive,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId, session.client.nativeOrderDocumentAccounting, {resolve:refundProofMetadata.resolveArchiveTarget,verifyBody:refundProofMetadata.verifyArchiveTargetBody});
  const transferSupportLinks = createTransferSupportLinks(session.scope,
    orderId => { const state = currentState(); return !closed && queryWorkflowOrderId === orderId && "read" in state && state.read.kind === "workflow" && state.read.value.orderId === orderId ? state.read.value : null; },
    orderId => !closed && (queryKind === "workflow" || queryKind === "dashboard-order") && queryWorkflowOrderId === orderId, typeof session.client.supportTicket === "function");
  let queryKind: MobileReadQuery["kind"] | null = null;
  let queryWorkflowOrderId: string | null = null;
  let queryCommentOrderId: string | null = null;
  let queryConversationOfferId:string|null=null;
  let queryConversationOrderId:string|null=null;
  let queryOfferSupportOrigin: OfferSupportOrigin | null = null;
  let queryConversationSupportOrigin: ConversationSupportOrigin | null = null;
  let queryTicketId: string | null = null;
  let queryComparison: { productId: string; variantId: string | null } | null = null;
  const listeners = new Set<() => void>();
  let queryKey: string | null = null;
  let snapshot: ReadView = { state: queries.getState(), queryKey };
  let closed = false;
  const currentState = (): MobileReadState => {
    if(queryKind==="offer-conversation-inbox")return offerConversationInbox.getState();
    if(queryKind==="offer-conversation")return offerConversation.getState();
    if(queryKind==="order-conversation-inbox")return orderConversationInbox.getState();
    if(queryKind==="offer-conversation-support-ticket")return offerConversationSupportRead.getState();
    if(queryKind==="conversation-support-ticket")return conversationSupportRead.getState();
    if (queryKind === "order-conversation") return orderConversation.getState();
    if (queryKind === "order-comments") return orderComments.getState();
    if (queryKind === "public-cities") return publicCities.getState();
    if (queryKind === "published-reviews") return publishedReviews.getState();
    if (queryKind === "document-archive" || queryKind === "archive-document" || queryKind === "archive-related" || queryKind === "archive-history" || queryKind === "archive-signatures" || queryKind === "archive-participants") return documentArchive.getState();
    if (queryKind === "payment-intent") return paymentIntent.getState();
    if (queryKind === "buyer-dashboard") return buyerDashboard.getState();
    if (queryKind === "saved-lists") return savedLists.getState();
    const state = queries.getState();
    // A dashboard buyer link cannot expand the older shared consumer's supplier-or-buyer boundary.
    if (queryKind === "dashboard-order" && "read" in state && state.read.kind === "workflow" && state.read.value.order.buyerOrganizationId !== buyerOrganizationId) return buyerScopeError;
    return state;
  };
  const catalogMedia = createCatalogMediaPreview(session.scope, session.client.nativeCatalogMedia, () => { if (closed || queryKind !== "catalog") return undefined; const state = currentState(); return (state.phase === "ready" || state.phase === "empty") && "read" in state && state.read.kind === "catalog" ? state.read.value : undefined; });
  const catalogCommercial = createCatalogCommercialFilters(session.client, () => { if (closed || queryKind !== "catalog") return undefined; const state = currentState(); return (state.phase === "ready" || state.phase === "empty") && "read" in state && state.read.kind === "catalog" ? state.read.value : undefined; });
  const attachmentImages = createAttachmentImages(session.scope, session.client.nativeAttachmentImages, (): AttachmentParent | null => {
    if (closed) return null; const state = currentState(); if (!("read" in state)) return null;
    if (state.read.kind === "support-ticket") return { kind: "support", value: state.read.value };
    if (state.read.kind === "order-conversation") return { kind: "order", value: state.read.value };
    if (state.read.kind === "offer-conversation") return { kind: "offer", value: state.read.value };
    return null;
  });
  const publish = () => {
    catalogMedia.sync(); catalogCommercial.sync();
    attachmentImages.syncCurrent();
    if (closed || (snapshot.state === currentState() && snapshot.queryKey === queryKey)) return;
    const state = currentState();
    if(state.phase==="authentication-required"){offerConversationReadMarker.denyAll("authentication");offerConversationDrafts.clear();}
    else if("read"in state&&state.read.kind==="offer-conversation"){offerConversationDrafts.syncWindow(state.read.value);offerConversationEscalate.syncWindow(state.read.value);}
    else {offerConversationEscalate.deactivate();offerConversationDrafts.deactivate();if(queryConversationOfferId&&["denied","contract-error","unavailable"].includes(state.phase)){offerConversationEscalate.denyOffer(queryConversationOfferId);offerConversationReadMarker.denyOffer(queryConversationOfferId);offerConversationResolve.denyOffer(queryConversationOfferId);offerConversationMessages.denyOffer(queryConversationOfferId);}}
    if(state.phase==="authentication-required"){orderConversationReadMarker.denyAll("authentication");orderConversationSend.denyAll("authentication");orderConversationDrafts.clear();}
    else if("read"in state&&state.read.kind==="order-conversation"){orderConversationEscalate.syncWindow(state.read.value);orderConversationStart.syncWindow(state.read.value);orderConversationDrafts.syncWindow(state.read.value);}
    else {orderConversationEscalate.deactivate();orderConversationStart.deactivate();orderConversationDrafts.deactivate();if(queryConversationOrderId&&["denied","contract-error","unavailable"].includes(state.phase))orderConversationDrafts.invalidateOrder(queryConversationOrderId);}
    if(queryConversationOrderId&&["denied","contract-error","unavailable"].includes(state.phase)){orderConversationEscalate.denyOrder(queryConversationOrderId);orderConversationResolve.denyOrder(queryConversationOrderId);orderConversationStart.denyOrder(queryConversationOrderId);orderConversationReadMarker.denyOrder(queryConversationOrderId);orderConversationSend.denyOrder(queryConversationOrderId);}
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartQuantityCommands.denyAll();
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartWorkspaceCommands.denyAll();
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartAddCommands.denyAll();
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartValidation.denyAll();
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartReprice.denyAll();
    if (state.phase === "authentication-required" || (queryKind === "workspace-carts" || queryKind === "cart" || queryKind === "checkout") && ["denied", "contract-error", "unavailable"].includes(state.phase)) cartCheckout.denyAll();
    if (queryKind === "checkout" && "read" in state && state.read.kind === "checkout") cartCheckout.acceptKnownReceiptRead(state.read.value);
    if (state.phase === "authentication-required") { buyerReviewCreate.denyAll(); buyerReviewUpdate.denyAll(); }
    if (state.phase === "authentication-required") { savedListItemCommands.denyAll(); savedListCreateCommands.denyAll(); savedListRemoveCommands.denyAll(); }
    if (state.phase === "authentication-required") { orderCommentCreateCommands.denyAll(); orderCommentEditCommands.denyAll(); }
    else if (queryKind === "order-comments" && queryCommentOrderId && ["denied","contract-error","unavailable"].includes(state.phase)) { orderCommentCreateCommands.denyOrder(queryCommentOrderId); orderCommentEditCommands.denyOrder(queryCommentOrderId); }
    if (state.phase === "authentication-required") { supportReplyCommands.denyAll(); supportReopen.denyAll(); }
    else if ((queryKind === "support-ticket"||queryKind === "conversation-support-ticket"||queryKind === "offer-conversation-support-ticket") && queryTicketId && ["denied", "contract-error", "unavailable"].includes(state.phase)) { supportReplyCommands.denyTicket(queryTicketId); if(queryKind==="support-ticket")supportReopen.denyTicket(queryTicketId); }
    if (state.phase === "authentication-required") goodsReturnDrafts.clear();
    else if ("read" in state && state.read.kind === "workflow") goodsReturnDrafts.syncWorkflow(state.read.value);
    else { goodsReturnDrafts.pause(); if (queryWorkflowOrderId && ["denied", "contract-error", "unavailable"].includes(state.phase)) goodsReturnDrafts.invalidate(queryWorkflowOrderId); }
    if (state.phase === "authentication-required") receiptDrafts.clear();
    else if ("read" in state && state.read.kind === "workflow") receiptDrafts.syncWorkflow(state.read.value);
    else { receiptDrafts.pause(); if (queryWorkflowOrderId && ["denied", "contract-error", "unavailable"].includes(state.phase)) receiptDrafts.invalidate(queryWorkflowOrderId); }
    if (state.phase === "authentication-required") { paymentReductionProposals.denyAll(); paymentReductions.denyAll(); moneyReturnCommands.denyAll(); paymentDisputeCommands.denyAll(); orderCompositionCommands.denyAll(); orderReorderCommands.denyAll(); cancellationCommands.denyAll(); receiptCommands.denyAll(); goodsReturnCommands.denyAll(); returnSendCommands.denyAll(); refundReceiveCommands.denyAll(); }
    else if (queryWorkflowOrderId && ["denied", "contract-error", "unavailable"].includes(state.phase)) { paymentReductionProposals.denyOrder(queryWorkflowOrderId); paymentReductions.denyOrder(queryWorkflowOrderId); moneyReturnCommands.denyOrder(queryWorkflowOrderId); paymentDisputeCommands.denyOrder(queryWorkflowOrderId); orderCompositionCommands.denyOrder(queryWorkflowOrderId); orderReorderCommands.denyOrder(queryWorkflowOrderId); cancellationCommands.denyOrder(queryWorkflowOrderId); receiptCommands.denyOrder(queryWorkflowOrderId); goodsReturnCommands.denyOrder(queryWorkflowOrderId); returnSendCommands.denyOrder(queryWorkflowOrderId); refundReceiveCommands.denyOrder(queryWorkflowOrderId); }
    else if ("read" in state && state.read.kind === "workflow" && state.read.value.order.buyerOrganizationId !== buyerOrganizationId) { paymentReductionProposals.denyOrder(state.read.value.orderId); paymentReductions.denyOrder(state.read.value.orderId); moneyReturnCommands.denyOrder(state.read.value.orderId); paymentDisputeCommands.denyOrder(state.read.value.orderId); orderCompositionCommands.denyOrder(state.read.value.orderId); orderReorderCommands.denyOrder(state.read.value.orderId); cancellationCommands.denyOrder(state.read.value.orderId); receiptCommands.denyOrder(state.read.value.orderId); goodsReturnCommands.denyOrder(state.read.value.orderId); returnSendCommands.denyOrder(state.read.value.orderId); refundReceiveCommands.denyOrder(state.read.value.orderId); }
    if (state.phase === "authentication-required") cancellationDrafts.clear();
    else if ("read" in state && state.read.kind === "workflow") cancellationDrafts.syncWorkflow(state.read.value);
    else if (queryWorkflowOrderId && ["denied", "contract-error", "unavailable"].includes(state.phase)) cancellationDrafts.invalidate(queryWorkflowOrderId);
    if ("read" in state && state.read.kind === "workspace-carts") { orderReorderCommands.observeWorkspace(state.read.value); quantityDrafts.syncCurrent(state.read.value.current); }
    else if (queryKind === "workspace-carts" && ["authentication-required", "denied", "contract-error", "unavailable"].includes(state.phase)) quantityDrafts.clear();
    if ("read" in state && state.read.kind === "support-tickets") supportTicketDraft.setReadAccess(session.scope, true);
    else if (state.phase === "authentication-required" || (queryKind === "support-tickets" && ["denied", "contract-error", "unavailable"].includes(state.phase))) supportTicketDraft.setReadAccess(session.scope, false);
    if (state.phase === "authentication-required") supportReplyDrafts.clear();
    else if ("read" in state && state.read.kind === "support-ticket") supportReplyDrafts.syncTicket(state.read.value);
    else if ("read" in state && state.read.kind === "support-tickets") supportReplyDrafts.syncSummaries(state.read.value);
    else if (["denied", "contract-error", "unavailable"].includes(state.phase)) {
      if ((queryKind === "support-ticket"||queryKind === "conversation-support-ticket"||queryKind === "offer-conversation-support-ticket") && queryTicketId) supportReplyDrafts.invalidate(queryTicketId);
      else if (queryKind === "support-tickets") supportReplyDrafts.clear();
    }
    if (state.phase === "authentication-required" || (queryKind === "catalog" && ["denied", "contract-error", "unavailable"].includes(state.phase))) localListDraft.clear();
    else if ("read" in state && state.read.kind === "comparison") localListDraft.syncComparison(state.read.value);
    else if (queryComparison && ["denied", "contract-error", "unavailable"].includes(state.phase)) localListDraft.invalidateComparison(queryComparison.productId, queryComparison.variantId);
    snapshot = { state, queryKey };
    listeners.forEach((listener) => listener());
  };
  const observe = async (start: () => Promise<unknown>) => {
    if (closed) return;
    const pending = start();
    publish();
    await pending;
    publish();
  };
  return {
    identity: ++nextIdentity,
    buyerReviewCreate, buyerReviewUpdate, orderCheckout, shipmentFulfillment, orderDiscrepancies, orderDiscrepancyCreate, orderDiscrepancyDraftActions, orderInvoices, manualTransfer, attachmentImages,
    supportsOfferConversationInbox:()=>offerConversationInbox.supportsRead()&&offerConversation.supportsRead(),
    openOfferInboxHistory(page:OfferInboxPage,row:OfferInboxRow){return !closed&&queryKind==="offer-conversation-inbox"?offerConversationInbox.history(page,row):null;},
    async openOfferInboxConversation(page:OfferInboxPage,row:OfferInboxRow){if(closed||queryKind!=="offer-conversation-inbox")return null;const selected=offerConversationInbox.select(page,row);if(!selected)return null;const work=offerConversationInbox.open(selected);publish();const target=await work;publish();return !closed&&queryKind==="offer-conversation-inbox"?target:null;},
    offerConversationEscalate,
    offerConversationReadMarker,
    offerConversationResolve,
    offerConversationMessages,
    offerConversationDrafts,
    supportsOfferConversation:()=>offerConversation.supportsRead(),
    selectOfferConversation(productId:string,variantId:string,offerId:string){const state=currentState();return !closed&&queryKind==="comparison"&&"read"in state&&state.read.kind==="comparison"?offerConversation.select(state.read.value,offerId,productId,variantId):null;},
    olderOfferConversation:(window:OfferConversationWindow)=>!closed?offerConversation.older(window):null,
    supportsOrderConversationInbox:()=>orderConversation.supportsRead()&&orderConversationInbox.supportsRead(),
    async openInboxConversation(page:ConversationInboxPage,row:ConversationInboxRow){const state=currentState();if(closed||queryKind!=="order-conversation-inbox"||!("read"in state)||state.read.kind!=="order-conversation-inbox"||state.read.value!==page)return null;const target=orderConversationInbox.select(page,row);if(!target)return null;const work=orderConversationInbox.open(target);publish();const selected=await work;publish();return closed||queryKind!=="order-conversation-inbox"?null:selected;},
    moneyReturnCommands,
    transferSupportLinks,
    offerConversationSupportLinks,
    supportsOfferSupportRead: typeof session.client.supportTicket === "function",
    conversationSupportLinks,
    supportsConversationSupportRead:typeof session.client.supportTicket==="function",
    orderDocumentArchive,
    refundProofMetadata,
    paymentReductionProposals,
    paymentReductions,
    paymentDisputeCommands,
    orderCompositionCommands,
    orderReorderCommands,
    orderCommentCreateCommands,
    orderCommentEditCommands,
    buyerOrganizationId,
    supportsOrderCommentFixtures: typeof session.client.orderCommentsFixture === "function",
    orderConversationDrafts,
    orderConversationSend,
    orderConversationStart,
    orderConversationEscalate,
    orderConversationResolve,
    orderConversationReadMarker,
    supportsOrderConversationFixtures:orderConversation.supportsRead(),
    selectOrderConversation:()=>{const state=currentState();return !closed&&"read"in state&&state.read.kind==="workflow"?orderConversation.select(state.read.value):null;},
    olderOrderConversation:(window:OrderConversationWindow)=>!closed?orderConversation.older(window):null,
    selectOrderComments: () => { const state = currentState(); return "read" in state && state.read.kind === "workflow" ? orderComments.select(state.read.value) : null; },
    supportsPublicCityFixtures: typeof session.client.publicCitiesFixture === "function",
    supportsProductReviewFixtures: typeof session.client.productReviewsFixture === "function",
    supportsSupplierReviewFixtures: typeof session.client.supplierReviewsFixture === "function",
    selectProductReviews: () => { const state = currentState(); return "read" in state && state.read.kind === "comparison" ? publishedReviews.selectProduct(state.read.value) : null; },
    selectSupplierReviews: (offerId: string) => { const state = currentState(); return "read" in state && state.read.kind === "comparison" ? publishedReviews.selectSupplier(state.read.value, offerId) : null; },
    selectArchiveParticipants: () => documentArchive.selectParticipants(),
    selectArchiveSignatures: () => documentArchive.selectSignatures(),
    selectArchiveHistory: () => documentArchive.selectHistory(),
    supportsArchiveChildMetadata: session.client.archiveMetadataOnly !== true || session.client.archiveChildMetadata === true,
    supportsArchiveBaseMetadata: session.client.archiveMetadataOnly !== true || session.client.archiveBaseMetadata === true,
    supportsExtendedArchiveMetadata: session.client.archiveMetadataOnly !== true,
    supportsDocumentArchiveFixtures: typeof session.client.documentArchiveFixture === "function" && typeof session.client.archiveDocumentFixture === "function",
    supportsPaymentIntentFixture: typeof session.client.paymentIntentFixture === "function" || nativePaymentIntentReadsAvailable(session.client.nativePaymentIntentReads, session.scope),
    goodsReturnDrafts,
    receiptDrafts,
    cancellationDrafts,
    cancellationCommands,
    receiptCommands,
    goodsReturnCommands,
    returnSendCommands,
    refundReceiveCommands,
    quantityDrafts,
    cartQuantityCommands,
    cartWorkspaceCommands,
    cartAddCommands,
    cartValidation,
    cartReprice,
    cartCheckout,
    localListDraft,
    savedListItemCommands,
    savedListCreateCommands,
    savedListRemoveCommands,
    supportTicketDraft,
    supportCreateCommand,
    supportReplyCommands,
    supportReopen,
    supportReplyDrafts,
    supportsBuyerDashboardFixtures: typeof session.client.buyerDashboardFixture === "function",
    supportsSavedListsFixtures: typeof session.client.savedListsFixture === "function",
    supportsCarts: typeof session.client.workspaceCarts === "function",
    organizationProfile, organizationOnboarding,
    catalogMedia, catalogCommercial,
    supportsOrganization: typeof session.client.getOrganizationProfile === "function",
    supportsCartDetails: typeof session.client.workspaceCart === "function",
    supportsCheckoutRead: typeof session.client.getCheckout === "function",
    supportsSupport: typeof session.client.supportTickets === "function" && typeof session.client.supportTicket === "function",
    getSnapshot: (): ReadView => snapshot,
    subscribe(listener: () => void) { closed = false; orderCheckout.activate(); shipmentFulfillment.activate(); orderDiscrepancies.activate(); orderDiscrepancyCreate.activate(); orderDiscrepancyDraftActions.activate(); catalogMedia.activate(); catalogCommercial.activate(); organizationOnboarding.activate(); organizationProfile.activate(); attachmentImages.activate(); manualTransfer.activate(); orderInvoices.activate(); buyerReviewCreate.activate(); buyerReviewUpdate.activate(); offerConversation.activate(); offerConversationInbox.activate(); offerConversationDrafts.activate(); orderConversationInbox.activate(); conversationWriteContext.activate(); offerConversationReadMarker.activate(); offerConversationResolve.activate(); offerConversationEscalate.activate(); offerConversationMessages.activate(); offerConversationSupportLinks.activate(); offerSupportReplyGuard.activate(); conversationSupportLinks.activate(); conversationSupportReplyGuard.activate(); unsubscribeSupportAuthority(); unsubscribeSupportAuthority = conversationWriteContext.subscribe(() => { supportCreateCommand.denyAccess(); supportReplyCommands.denyAll(); supportReopen.denyAll(); supportReplyDrafts.clear(); offerConversationDrafts.clear(); supportTicketDraft.setReadAccess(session.scope, false); }); orderConversationEscalate.activate(); orderConversationResolve.activate(); orderConversationStart.activate(); orderConversationReadMarker.activate(); orderConversationSend.activate(); orderConversationDrafts.activate(); transferSupportLinks.activate(); orderCommentCommandContext.activate(); orderCommentCreateCommands.activate(); orderCommentEditCommands.activate(); goodsReturnDrafts.activate(); receiptDrafts.activate(); cancellationDrafts.activate(); buyerWorkflowKeys.activate(); orderDocumentArchive.activate(); refundProofMetadata.activate(); paymentReductionProposals.activate(); paymentReductions.activate(); moneyReturnCommands.activate(); paymentDisputeCommands.activate(); orderCompositionCommands.activate(); orderReorderCommands.activate(); cancellationCommands.activate(); receiptCommands.activate(); goodsReturnCommands.activate(); returnSendCommands.activate(); refundReceiveCommands.activate(); quantityDrafts.activate(); localListDraft.activate(); savedListCommandContext.activate(); savedListItemCommands.activate(); savedListCreateCommands.activate(); savedListRemoveCommands.activate(); supportTicketDraft.activate(); supportReplyDrafts.activate(); supportCreateCommand.activate(); supportReplyCommands.activate(); supportReopen.activate(); cartQuantityCommands.activate(); cartWorkspaceCommands.activate(); cartAddCommands.activate(); cartValidation.activate(); cartReprice.activate(); cartCheckout.activate(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    load: (query: MobileReadQuery) => {
      if (closed) return Promise.resolve();
      queryKind = query.kind;
      queryConversationOfferId=query.kind==="offer-conversation"?query.target.offerId:null;
      queryOfferSupportOrigin = query.kind === "offer-conversation-support-ticket" ? query.origin : null;
      queryConversationSupportOrigin = query.kind === "conversation-support-ticket" ? query.origin : null;
      queryConversationOrderId=query.kind==="order-conversation"?query.target.orderId:null;
      queryCommentOrderId = query.kind === "order-comments" ? query.target.orderId : null;
      queryWorkflowOrderId = query.kind === "workflow" || query.kind === "dashboard-order" ? query.orderId : null;
      queryComparison = query.kind === "comparison" ? { productId: query.input.productId, variantId: query.input.variantId ?? null } : null;
      queryTicketId = query.kind === "support-ticket" ? query.ticketId : query.kind==="conversation-support-ticket"||query.kind==="offer-conversation-support-ticket"?query.origin.ticketId:null;
      queryKey = JSON.stringify(query);
      if(query.kind==="offer-conversation-inbox"){offerConversation.reset();orderConversation.reset();orderConversationInbox.reset();queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();conversationSupportRead.reset();offerConversationSupportRead.reset();return observe(()=>offerConversationInbox.load(query.offset));}
      offerConversationInbox.reset();
      if(query.kind==="offer-conversation-support-ticket"){offerConversation.pause();orderConversation.reset();orderConversationInbox.reset();queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();conversationSupportRead.reset();return observe(()=>offerConversationSupportRead.load(query));}
      offerConversationSupportRead.reset();
      if(query.kind==="offer-conversation"){orderConversation.reset();orderConversationInbox.reset();queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();conversationSupportRead.reset();return observe(()=>offerConversation.load(query.target));}
      offerConversation.reset();
      if(query.kind==="order-conversation-inbox"){orderConversation.reset();queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();conversationSupportRead.reset();return observe(()=>orderConversationInbox.load(query.offset));}
      orderConversationInbox.reset();
      if(query.kind==="conversation-support-ticket"){orderConversation.pause();queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();return observe(()=>conversationSupportRead.load(query));}
      conversationSupportRead.reset();
      if(query.kind==="order-conversation"){queries.reset(session.scope,session.client);savedLists.reset();buyerDashboard.reset();paymentIntent.reset();documentArchive.reset();publishedReviews.reset();publicCities.reset();orderComments.reset();return observe(()=>orderConversation.load(query.target));}
      orderConversation.reset();
      if (query.kind === "order-comments") { queries.reset(session.scope, session.client); savedLists.reset(); buyerDashboard.reset(); paymentIntent.reset(); documentArchive.reset(); publishedReviews.reset(); publicCities.reset(); return observe(() => orderComments.load(query.target)); }
      orderComments.reset();
      if (query.kind === "public-cities") { queries.reset(session.scope, session.client); savedLists.reset(); buyerDashboard.reset(); paymentIntent.reset(); documentArchive.reset(); publishedReviews.reset(); return observe(() => publicCities.load()); }
      publicCities.reset();
      if (query.kind === "published-reviews") { queries.reset(session.scope, session.client); savedLists.reset(); buyerDashboard.reset(); paymentIntent.reset(); documentArchive.reset(); return observe(() => publishedReviews.load(query.target)); }
      publishedReviews.reset();
      if (query.kind === "document-archive" || query.kind === "archive-document" || query.kind === "archive-related" || query.kind === "archive-history" || query.kind === "archive-signatures" || query.kind === "archive-participants") { queries.reset(session.scope, session.client); savedLists.reset(); buyerDashboard.reset(); paymentIntent.reset(); return observe(() => documentArchive.load(query)); }
      documentArchive.reset();
      if (query.kind === "payment-intent") { queries.reset(session.scope, session.client); savedLists.reset(); buyerDashboard.reset(); return observe(() => paymentIntent.load({ paymentIntentId: query.paymentIntentId, checkoutId: query.checkoutId })); }
      paymentIntent.reset();
      if (query.kind === "buyer-dashboard") { queries.reset(session.scope, session.client); savedLists.reset(); return observe(() => buyerDashboard.load()); }
      buyerDashboard.reset();
      if (query.kind === "saved-lists") { queries.reset(session.scope, session.client); return observe(() => savedLists.load()); }
      savedLists.reset();
      if (query.kind === "dashboard-order") return observe(() => queries.load({ kind: "workflow", orderId: query.orderId }));
      return observe(() => queries.load(query));
    },
    retry: () => {
      const phase = currentState().phase;
      if (closed || queryKey === null || phase === "loading" || phase === "idle") return Promise.resolve();
      return observe(() => queryKind === "offer-conversation-inbox" ? offerConversationInbox.refresh() : queryKind === "offer-conversation-support-ticket" ? offerConversationSupportRead.refresh() : queryKind === "offer-conversation" ? offerConversation.refresh() : queryKind === "order-conversation-inbox" ? orderConversationInbox.refresh() : queryKind === "conversation-support-ticket" ? conversationSupportRead.refresh() : queryKind === "order-conversation" ? orderConversation.refresh() : queryKind === "order-comments" ? orderComments.refresh() : queryKind === "public-cities" ? publicCities.load() : queryKind === "published-reviews" ? publishedReviews.refresh() : queryKind === "document-archive" || queryKind === "archive-document" || queryKind === "archive-related" || queryKind === "archive-history" || queryKind === "archive-signatures" || queryKind === "archive-participants" ? documentArchive.refresh() : queryKind === "payment-intent" ? paymentIntent.refresh() : queryKind === "buyer-dashboard" ? buyerDashboard.load() : queryKind === "saved-lists" ? savedLists.load() : queries.refresh());
    },
    dispose() { closed = true; orderCheckout.close(); orderDiscrepancyDraftActions.dispose(); orderDiscrepancyCreate.dispose(); shipmentFulfillment.dispose(); orderDiscrepancies.dispose(); catalogMedia.close(); catalogCommercial.close(); organizationOnboarding.close(); organizationProfile.close(); attachmentImages.close(); manualTransfer.close(); orderInvoices.close(); buyerReviewCreate.dispose(); buyerReviewUpdate.dispose(); offerConversationInbox.close(); offerSupportReplyGuard.close(); offerConversationSupportRead.close(); offerConversationSupportLinks.close(); offerConversationReadMarker.dispose(); offerConversationResolve.dispose(); offerConversationEscalate.dispose(); offerConversationMessages.dispose(); offerConversation.close(); offerConversationDrafts.close(); orderConversationInbox.close(); unsubscribeSupportAuthority(); conversationSupportReplyGuard.close(); conversationSupportRead.close(); conversationSupportLinks.close(); orderConversationReadMarker.dispose(); orderConversationEscalate.dispose(); orderConversationResolve.dispose(); orderConversationStart.dispose(); orderConversationSend.dispose(); conversationWriteContext.close(); orderConversationDrafts.close(); orderConversation.reset(); transferSupportLinks.close(); orderCommentCreateCommands.dispose(); orderCommentEditCommands.dispose(); orderCommentCommandContext.close(); supportCreateCommand.dispose(); supportReplyCommands.dispose(); supportReopen.dispose(); cartQuantityCommands.dispose(); cartWorkspaceCommands.dispose(); cartAddCommands.dispose(); cartValidation.dispose(); cartReprice.dispose(); cartCheckout.dispose(); goodsReturnDrafts.close(); receiptDrafts.close(); cancellationDrafts.close(); cancellationCommands.dispose(); receiptCommands.dispose(); goodsReturnCommands.dispose(); returnSendCommands.dispose(); refundReceiveCommands.dispose(); orderDocumentArchive.dispose(); refundProofMetadata.dispose(); paymentReductionProposals.dispose(); paymentReductions.dispose(); moneyReturnCommands.dispose(); paymentDisputeCommands.dispose(); orderCompositionCommands.dispose(); orderReorderCommands.dispose(); reorderWorkspaceQueries.reset(session.scope,session.client); buyerWorkflowKeys.close(); quantityDrafts.close(); localListDraft.close(); savedListItemCommands.dispose(); savedListCreateCommands.dispose(); savedListRemoveCommands.dispose(); savedListCommandContext.close(); supportTicketDraft.close(); supportReplyDrafts.close(); listeners.clear(); orderComments.reset(); publicCities.reset(); publishedReviews.reset(); documentArchive.reset(); paymentIntent.reset(); buyerDashboard.reset(); savedLists.reset(); queries.reset(session.scope, session.client); queryKey = null; snapshot = { state: queries.getState(), queryKey }; },
  };
}
export type ReadController = ReturnType<typeof createReadController>;
