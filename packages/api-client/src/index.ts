import * as integrationsApi from "./domains/integrations";
import * as supplierImportsApi from "./domains/supplier-imports";
import * as workspacesApi from "./domains/workspaces";
import * as documentsApi from "./domains/documents";
import * as deliveryApi from "./domains/delivery";
import * as ordersApi from "./domains/orders";
import * as cartsApi from "./domains/carts";
import * as identityApi from "./domains/identity";
import * as organizationsApi from "./domains/organizations";
import * as promotionsApi from "./domains/promotions";
import * as conversationsApi from "./domains/conversations";
import * as operationsApi from "./domains/operations";
import * as notificationsApi from "./domains/notifications";
import * as supportApi from "./domains/support";
import * as supplierApi from "./domains/supplier";
import * as catalogApi from "./domains/catalog";
import type { OrderDiscrepanciesResponse, OrderDiscrepancyCommand, OrderDiscrepancyResult, OrderReviewState, CreateVerifiedReviewInput, VerifiedOrderReview } from "@marketplace/schemas";
import type { PrepareShipmentWaybillInput, ShipmentWaybillView, ShipmentWaybillsResponse } from "@marketplace/schemas";
import type { PrepareResupplyDocumentInput, ResupplyDocumentView, ResupplyDocumentsResponse } from "@marketplace/schemas";
import type { PrepareOrderInvoiceInput, OrderInvoiceView, OrderInvoicesResponse } from "@marketplace/schemas";
import type { AccessPolicy, CommerceAnalyticsQuery, CommerceAnalyticsResponse, WorkspaceCorrectionOfferPage, WorkspaceInventoryPage, WorkspaceLotPage, WorkspaceReservationPage, WorkspaceOverridePage } from "@marketplace/schemas";
import type { CreateInvitationInput, AcceptInvitationInput, UpdateMembershipInput, IdentityMember, IdentityRole, IdentitySession, IdentitySessionRevoked, InvitationSummary, InvitationCreated, InvitationDelivered, InvitationAccepted, InvitationDetails } from "@marketplace/schemas";
import type { CreateOfferPromotion, ReviseOfferPromotion, OfferPromotionCommand, OfferPromotion, PromotionPage, PublicPromotionPage, PromotionListQuery } from "@marketplace/schemas";
import type { WorkspaceOfferQuery, WorkspaceInventoryQuery, WorkspacePageQuery, WorkspaceOrderQuery, WorkspaceOrderPage, WorkspaceOffer, WorkspaceOfferPage, WorkspaceCartPage, WorkspaceSummary } from "@marketplace/schemas";
import { deploymentFeatures, isDeploymentApiPathEnabled, type DeploymentProfile } from "@marketplace/schemas/deployment-policy";

// Next replaces this literal at build time. Missing/unrecognised values stay pilot.
export const frontendDeploymentProfile: DeploymentProfile =
  process.env.NEXT_PUBLIC_DEPLOYMENT_PROFILE === "go_live" ? "go_live" : "pilot";
export const frontendFeatures = deploymentFeatures(frontendDeploymentProfile);

import type {
  UpdateProductInput, UpdatedCatalogProduct,
  OrderWorkflowCommand, OrderWorkflowResponse, OrderWorkflowResult, SaveSupplierPaymentPolicy, SupplierPaymentPolicyResponse,
  OrganizationProfileResponse, SaveOrganizationProfileInput, OrganizationOnboarding,
  OrganizationRequisitesResponse, SaveOrganizationRequisitesInput, ConfirmOrganizationRequisitesInput, OrganizationRequisitesMutation, OrganizationRequisitesHistory, OrganizationRequisitesHistoryQuery,
  AcceptSupplierTermsInput, ReviewSupplierAdmissionInput, SupplierLegalBundle, SupplierTermsState, SupplierTermsAcceptance, SupplierAdmissionList,
  WorkspaceContext,
  AuthClientOptions, AuthRegistrationAccepted, AuthForgotAccepted, AuthEmailRegistration, LocalOperatorLogin, LocalOperatorSession,
  RegistrationResumeRequest,
  RegistrationResumeProof,
  RegistrationResumeComplete,
  RegistrationResumeRequested,
  RegistrationResumeDetails,
  RegistrationResumeCompleted,
  AddCartItemRequest,
  UpdateCartItemRequest,
  CartVersionRequest,
  RepriceCartRequest,
  ApproveImportProductCandidateInput,
  CartItemResponse,
  CartResponse,
  CartValidationResponse,
  CatalogSearchResponse,
  CatalogImportReview,
  CatalogImportReviewQueueResponse,
  CheckoutCartRequest,
  CheckoutResponse,
  CompareOffersRequest,
  ConfirmSupplierOrderRequest,
  CreateImportBatchInput,
  RollbackImportBatchInput,
  GenerateOrderDocumentPackRequest,
  CreateShipmentRequest,
  OrderDocumentPackResponse,
  PreparedOrderDocumentsResponse,
  CreateCartRequest,
  RecoverCartRequest,
  DocumentArchiveItem,
  DocumentArchivePageResponse,
  DocumentArchiveQueryInput,
  DocumentArchiveSummaryResponse,
  OfferComparisonResponse,
  SearchCatalogRequest,
  SupplierOrderResponse,
  SupplierImportBatchResponse,
  SupplierImportDiagnosticsResponse,
  SupplierImportRollbackResponse,
  ShipmentResponse,
  SetOfferPublicationInput,
  SupplierOfferPublicationResponse,
  TransitionShipmentRequest,
  OutboxDeadLetterQueryInput,
  OutboxDeadLetterListResponse,
  OutboxReplayInput,
  OutboxReplayResponse,
  UpdateDocumentAccountingStatusInput,
  UploadDocumentInput,
} from "@marketplace/schemas";

export type {
  CatalogSearchResponse,
  CatalogImportReview,
  CatalogImportReviewQueueResponse,
  OrderDocumentResponse,
  SupplierOfferPublicationResponse,
  SupplierImportBatchResponse,
  SupplierImportDiagnosticsResponse,
  SupplierImportRollbackResponse,
  DocumentArchiveItem,
  DocumentArchivePageResponse,
  DocumentArchiveQueryInput,
  DocumentArchiveSummaryResponse,
  UpdateDocumentAccountingStatusInput,
  UploadDocumentInput,
} from "@marketplace/schemas";

export type ApiContext = {
  actorId?: string;
  organizationId?: string;
  accessToken?: string;
  getAccessToken?: (forceRefresh?: boolean) => Promise<string | undefined>;
  onUnauthorized?: () => void;
};

export { parseSessionHandoff, type SessionHandoffEnvelope } from "./session-handoff";
export { createWorkspaceSession, workspaceSessionStore } from "./workspace-session";

export { revokeWorkspaceSession } from "./session-logout";

export class MarketplaceApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : `Marketplace API returned ${status}`,
    );
  }
}

export class MarketplaceApiClient {
  getSupplierVatSettings(supplierId: string) { return supplierApi.getSupplierVatSettings(this, supplierId); }
  saveSupplierVatSettings(supplierId: string, input: import("@marketplace/schemas").SaveSupplierVatSettingsInput) { return supplierApi.saveSupplierVatSettings(this, supplierId, input); }
  previewOfferVat(supplierId: string, input: import("@marketplace/schemas").PreviewOfferVatInput) { return supplierApi.previewOfferVat(this, supplierId, input); }
  applyOfferVat(supplierId: string, input: import("@marketplace/schemas").ApplyOfferVatInput) { return supplierApi.applyOfferVat(this, supplierId, input); }
  createSupportTicket(input: import("@marketplace/schemas").CreateSupportTicketInput) { return supportApi.createSupportTicket(this, input); }
  internalNotifications(organizationId: string, offset = 0) { return notificationsApi.internalNotifications(this, organizationId, offset); }
  notificationInbox(organizationId: string, query: import("@marketplace/schemas").NotificationInboxQuery = {}, options?: { signal?: AbortSignal }) { return notificationsApi.notificationInbox(this, organizationId, query, options); }
  readNotificationInbox(organizationId: string, before: string) { return notificationsApi.readNotificationInbox(this, organizationId, before); }
  readNotification(id: string) { return notificationsApi.readNotification(this, id); }
  operationObject(type: import("@marketplace/schemas").OperationQueueType, id: string) { return operationsApi.operationObject(this, type, id); }
  operatorDocumentException(id: string, signal?: AbortSignal) { return operationsApi.operatorDocumentException(this, id, signal); }
  operatorAudit(input: import("@marketplace/schemas").OperatorAuditQuery, signal?: AbortSignal) { return operationsApi.operatorAudit(this, input, signal); }
  operatorTechnical(signal?: AbortSignal) { return operationsApi.operatorTechnical(this, signal); }
  operatorTrust(input: import("@marketplace/schemas").OperatorTrustQuery, signal?: AbortSignal) { return operationsApi.operatorTrust(this, input, signal); }
  operatorTrustEvents(id: string, offset = 0, signal?: AbortSignal) { return operationsApi.operatorTrustEvents(this, id, offset, signal); }
  resolveOperatorTrustIncident(id: string, input: import("@marketplace/schemas").OperatorTrustResolve) { return operationsApi.resolveOperatorTrustIncident(this, id, input); }
  publishOperatorExceptionRecommendation(id: string, input: import("@marketplace/schemas").OperatorExceptionReview) { return operationsApi.publishOperatorExceptionRecommendation(this, id, input); }
  supportTickets(status?: string, offset = 0, options: { q?: string; sort?: "queue" | "recent" } = {}) { return supportApi.supportTickets(this, status, offset, options); }
  supportTicket(id: string, beforeMessageId?: string) { return supportApi.supportTicket(this, id, beforeMessageId); }
  updateSupportTicket(id: string, input: import("@marketplace/schemas").UpdateSupportTicketInput) { return supportApi.updateSupportTicket(this, id, input); }
  supportTicketHistory(id: string) { return supportApi.supportTicketHistory(this, id); }
  addSupportMessage(id: string, input: import("@marketplace/schemas").AddSupportMessageInput) { return supportApi.addSupportMessage(this, id, input); }
  conversationContext(contextType: "OFFER" | "ORDER", contextId: string) { return conversationsApi.conversationContext(this, contextType, contextId); }
  uploadConversationAttachment(input: import("@marketplace/schemas").UploadConversationAttachmentInput) { return conversationsApi.uploadConversationAttachment(this, input); }
  downloadConversationAttachment(conversationId: string, messageId: string, assetId: string) { return conversationsApi.downloadConversationAttachment(this, conversationId, messageId, assetId); }
  operationWorkQueue(query: Partial<import("@marketplace/schemas").OperationWorkQueueQuery> = {}, signal?: AbortSignal) { return operationsApi.operationWorkQueue(this, query, signal); }
  operatorDashboard(signal?: AbortSignal) { return operationsApi.operatorDashboard(this, signal); }
  operatorCapabilities(signal?: AbortSignal) { return operationsApi.operatorCapabilities(this, signal); }
  operatorOrganizations(query: Partial<import("@marketplace/schemas").OperatorOrganizationsQuery> = {}, signal?: AbortSignal) { return operationsApi.operatorOrganizations(this, query, signal); }
  operatorOrders(query: Partial<import("@marketplace/schemas").OperatorOrdersQuery> = {}, signal?: AbortSignal) { return operationsApi.operatorOrders(this, query, signal); }
  operatorOrder(id: string, signal?: AbortSignal) { return operationsApi.operatorOrder(this, id, signal); }
  operatorOrganization(id: string, signal?: AbortSignal) { return operationsApi.operatorOrganization(this, id, signal); }
  operationAssignees() { return operationsApi.operationAssignees(this); }
  assignOperation(type: import("@marketplace/schemas").OperationQueueType, id: string, input: import("@marketplace/schemas").OperationAssignment) { return operationsApi.assignOperation(this, type, id, input); }
  operationHistory(type: import("@marketplace/schemas").OperationQueueType, id: string) { return operationsApi.operationHistory(this, type, id); }
  conversations(query: Partial<import("@marketplace/schemas").ConversationQuery> = {}) { return conversationsApi.conversations(this, query); }
  conversation(id: string, beforeSequence?: number) { return conversationsApi.conversation(this, id, beforeSequence); }
  startConversation(input: import("@marketplace/schemas").StartConversation) { return conversationsApi.startConversation(this, input); }
  sendConversationMessage(id: string, input: import("@marketplace/schemas").ConversationMessageInput) { return conversationsApi.sendConversationMessage(this, id, input); }
  readConversation(id: string, throughSequence: number) { return conversationsApi.readConversation(this, id, throughSequence); }
  resolveConversation(id: string, expectedVersion: number, decision?: string) { return conversationsApi.resolveConversation(this, id, expectedVersion, decision); }
  escalateConversation(id: string, input: import("@marketplace/schemas").ConversationEscalation) { return conversationsApi.escalateConversation(this, id, input); }
  listPromotions(query: Partial<PromotionListQuery> = {}) { return promotionsApi.listPromotions(this, query); }
  listPublicPromotions(query: Partial<PromotionListQuery> = {}) { return promotionsApi.listPublicPromotions(this, query); }
  createOfferPromotion(input: CreateOfferPromotion) { return promotionsApi.createOfferPromotion(this, input); }
  reviseOfferPromotion(id: string, input: ReviseOfferPromotion) { return promotionsApi.reviseOfferPromotion(this, id, input); }
  commandOfferPromotion(id: string, input: OfferPromotionCommand) { return promotionsApi.commandOfferPromotion(this, id, input); }
  getSupplierLegalDocuments() { return organizationsApi.getSupplierLegalDocuments(this); }
  getSupplierTerms() { return organizationsApi.getSupplierTerms(this); }
  getOrganizationProfile() { return organizationsApi.getOrganizationProfile(this); }
  saveOrganizationProfile(input: SaveOrganizationProfileInput) { return organizationsApi.saveOrganizationProfile(this, input); }
  getOrganizationRequisites() { return organizationsApi.getOrganizationRequisites(this); }
  saveOrganizationRequisites(input: SaveOrganizationRequisitesInput) { return organizationsApi.saveOrganizationRequisites(this, input); }
  confirmOrganizationRequisites(input: ConfirmOrganizationRequisitesInput) { return organizationsApi.confirmOrganizationRequisites(this, input); }
  getOrganizationRequisitesHistory(query: OrganizationRequisitesHistoryQuery = {}) { return organizationsApi.getOrganizationRequisitesHistory(this, query); }
  getOrganizationOnboarding() { return organizationsApi.getOrganizationOnboarding(this); }
  getOperatorOrganizationOnboarding(id: string) { return organizationsApi.getOperatorOrganizationOnboarding(this, id); }
  acceptSupplierTerms(input: AcceptSupplierTermsInput) { return organizationsApi.acceptSupplierTerms(this, input); }
  getSupplierAdmissions() { return organizationsApi.getSupplierAdmissions(this); }
  reviewSupplierAdmission(id: string, input: ReviewSupplierAdmissionInput) { return organizationsApi.reviewSupplierAdmission(this, id, input); }
  downloadSupplierTerms(id: string) { return organizationsApi.downloadSupplierTerms(this, id); }
  constructor(
    private readonly baseUrl: string,
    private readonly context: ApiContext,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const accessToken = this.context.getAccessToken ? await this.context.getAccessToken() : this.context.accessToken;
    if (accessToken)
      headers.authorization = `Bearer ${accessToken}`;
    else {
      if (this.context.actorId) headers["x-user-id"] = this.context.actorId;
      if (this.context.organizationId)
        headers["x-organization-id"] = this.context.organizationId;
    }
    return headers;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertEnabledPath(path);
    const send = async () => fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...await this.headers(),
        ...init.headers,
      },
      cache: "no-store",
      signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
    let response = await send();
    // Only safe reads can be replayed. Writes refresh before sending and never retry.
    if (response.status === 401 && this.context.getAccessToken && ["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) {
      init.signal?.throwIfAborted();
      await this.context.getAccessToken(true);
      response = await send();
    }
    if (response.status === 401) this.context.onUnauthorized?.();
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) throw new MarketplaceApiError(response.status, payload);
    return payload as T;
  }

  async download(
    path: string,
  ): Promise<{ blob: Blob; fileName: string | null }> {
    this.assertEnabledPath(path);
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      headers: await this.headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const text = await response.text();
      let payload: unknown = text;
      try {
        payload = JSON.parse(text);
      } catch {}
      throw new MarketplaceApiError(response.status, payload);
    }
    const disposition = response.headers.get("content-disposition");
    const encodedName = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let blob: Blob;
    if ((response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      const payload = (await response.json()) as { url?: unknown };
      if (typeof payload.url !== "string" || !payload.url) throw new MarketplaceApiError(502, { message: "Document download did not return a file or signed URL" });
      const signedResponse = await fetch(payload.url, { cache: "no-store" });
      if (!signedResponse.ok) throw new MarketplaceApiError(signedResponse.status, { message: "Signed document download failed" });
      blob = await signedResponse.blob();
    } else {
      blob = await response.blob();
    }
    return {
      blob,
      fileName: encodedName ? decodeURIComponent(encodedName) : null,
    };
  }

  private assertEnabledPath(path: string) {
    if (!isDeploymentApiPathEnabled(frontendDeploymentProfile, `${this.baseUrl.replace(/\/$/, "")}${path}`)) {
      throw new MarketplaceApiError(404, { code: "FEATURE_UNAVAILABLE", message: "Функция недоступна в текущем профиле", path });
    }
  }

  get<T>(path: string, options?: Pick<RequestInit, "signal">) {
    return this.request<T>(path, options);
  }
  requestRegistrationResume(input: RegistrationResumeRequest) { return identityApi.requestRegistrationResume(this, input); }
  authClientOptions() { return identityApi.authClientOptions(this); }
  loginEmail(input: import("@marketplace/schemas").AuthEmailLogin) { return identityApi.loginEmail(this, input); }
  verifyEmail(input: import("@marketplace/schemas").AuthEmailToken) { return identityApi.verifyEmail(this, input); }
  personalProfile(signal?: AbortSignal) { return identityApi.personalProfile(this, signal); }
  savePersonalProfile(input: import("@marketplace/schemas").UpdatePersonalProfile) { return identityApi.savePersonalProfile(this, input); }
  requestProfileEmail(input: import("@marketplace/schemas").RequestProfileEmail) { return identityApi.requestProfileEmail(this, input); }
  uploadProfileAvatar(input: import("@marketplace/schemas").UploadProfileAvatar) { return identityApi.uploadProfileAvatar(this, input); }
  profileAvatar(signal?: AbortSignal) { return identityApi.profileAvatar(this, signal); }
  resetPassword(input: import("@marketplace/schemas").AuthPasswordReset) { return identityApi.resetPassword(this, input); }
  mfaStatus() { return identityApi.mfaStatus(this); }
  enrollMfa() { return identityApi.enrollMfa(this); }
  verifyMfaEnrollment(input: import("@marketplace/schemas").MfaCodeInput) { return identityApi.verifyMfaEnrollment(this, input); }
  challengeMfa(input: import("@marketplace/schemas").MfaCodeInput) { return identityApi.challengeMfa(this, input); }
  disableMfa(input: import("@marketplace/schemas").MfaCodeInput) { return identityApi.disableMfa(this, input); }
  workspaceContext() { return identityApi.workspaceContext(this); }
  registerEmail(input: AuthEmailRegistration) { return identityApi.registerEmail(this, input); }
  requestPasswordReset(email: string) { return identityApi.requestPasswordReset(this, email); }
  listMembers(organizationId: string) { return identityApi.listMembers(this, organizationId); }
  listRoles(organizationId: string) { return identityApi.listRoles(this, organizationId); }
  getAccessPolicy(signal?: AbortSignal) { return identityApi.getAccessPolicy(this, signal); }
  updateMember(organizationId: string, memberId: string, input: UpdateMembershipInput) { return identityApi.updateMember(this, organizationId, memberId, input); }
  assignMemberRole(organizationId: string, memberId: string, roleId: string) { return identityApi.assignMemberRole(this, organizationId, memberId, roleId); }
  removeMemberRole(organizationId: string, memberId: string, roleId: string) { return identityApi.removeMemberRole(this, organizationId, memberId, roleId); }
  listInvitations(organizationId: string) { return identityApi.listInvitations(this, organizationId); }
  createInvitation(organizationId: string, input: CreateInvitationInput) { return identityApi.createInvitation(this, organizationId, input); }
  deliverInvitation(organizationId: string, invitationId: string) { return identityApi.deliverInvitation(this, organizationId, invitationId); }
  revokeInvitation(organizationId: string, invitationId: string) { return identityApi.revokeInvitation(this, organizationId, invitationId); }
  invitationDetails(token: string) { return identityApi.invitationDetails(this, token); }
  acceptInvitation(input: AcceptInvitationInput) { return identityApi.acceptInvitation(this, input); }
  listSessions() { return identityApi.listSessions(this); }
  revokeSession(sessionId: string) { return identityApi.revokeSession(this, sessionId); }
  loginLocalOperator(input: LocalOperatorLogin) { return identityApi.loginLocalOperator(this, input); }
  loginOperator(input: import("@marketplace/schemas").OperatorLogin) { return identityApi.loginOperator(this, input); }
  currentOperatorSession() { return identityApi.currentOperatorSession(this); }
  logoutOperator(csrfToken: string) { return identityApi.logoutOperator(this, csrfToken); }
  inspectRegistrationResume(input: RegistrationResumeProof) { return identityApi.inspectRegistrationResume(this, input); }
  completeRegistrationResume(input: RegistrationResumeComplete) { return identityApi.completeRegistrationResume(this, input); }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }



  searchCatalog(input: SearchCatalogRequest) { return catalogApi.searchCatalog(this, input); }

  searchPublicCatalog(
    input: Omit<SearchCatalogRequest, "buyerOrganizationId">,
  ) { return catalogApi.searchPublicCatalog(this, input); }

  compareOffers(input: CompareOffersRequest) { return catalogApi.compareOffers(this, input); }

  comparePublicOffers(
    productId: string,
    input: Omit<CompareOffersRequest, "buyerOrganizationId" | "productId">,
  ) { return catalogApi.comparePublicOffers(this, productId, input); }

  listCarts(buyerOrganizationId: string) { return cartsApi.listCarts(this, buyerOrganizationId); }

  createCart(buyerOrganizationId: string, input: CreateCartRequest) { return cartsApi.createCart(this, buyerOrganizationId, input); }

  addCartItem(cartId: string, input: AddCartItemRequest) { return cartsApi.addCartItem(this, cartId, input); }

  updateCartItem(cartId: string, itemId: string, input: UpdateCartItemRequest) { return cartsApi.updateCartItem(this, cartId, itemId, input); }

  removeCartItem(cartId: string, itemId: string, input: CartVersionRequest) { return cartsApi.removeCartItem(this, cartId, itemId, input); }

  repriceCart(cartId: string, input: RepriceCartRequest = {}) { return cartsApi.repriceCart(this, cartId, input); }

  validateCart(cartId: string) { return cartsApi.validateCart(this, cartId); }

  checkoutCart(cartId: string, input: CheckoutCartRequest) { return cartsApi.checkoutCart(this, cartId, input); }

  getCheckout(checkoutId: string) { return cartsApi.getCheckout(this, checkoutId); }

  listBuyerOrders(buyerOrganizationId: string) { return ordersApi.listBuyerOrders(this, buyerOrganizationId); }

  listSupplierOrders(checkoutId?: string) { return ordersApi.listSupplierOrders(this, checkoutId); }

  confirmSupplierOrder(orderId: string, input: ConfirmSupplierOrderRequest) { return ordersApi.confirmSupplierOrder(this, orderId, input); }

  listOrderShipments(orderId: string) { return deliveryApi.listOrderShipments(this, orderId); }

  createShipment(orderId: string, input: CreateShipmentRequest) { return deliveryApi.createShipment(this, orderId, input); }

  transitionShipment(shipmentId: string, input: TransitionShipmentRequest) { return deliveryApi.transitionShipment(this, shipmentId, input); }

  generateOrderDocumentPack(
    orderId: string,
    input: GenerateOrderDocumentPackRequest,
  ) { return documentsApi.generateOrderDocumentPack(this, orderId, input); }

  getOrderDiscrepancies(orderId: string) { return documentsApi.getOrderDiscrepancies(this, orderId); }
  getResupplyDocuments(orderId: string, discrepancyId: string) { return documentsApi.getResupplyDocuments(this, orderId, discrepancyId); }
  prepareResupplyDocument(orderId: string, discrepancyId: string, input: PrepareResupplyDocumentInput) { return documentsApi.prepareResupplyDocument(this, orderId, discrepancyId, input); }
  downloadResupplyDocument(orderId: string, discrepancyId: string, documentId: string) { return documentsApi.downloadResupplyDocument(this, orderId, discrepancyId, documentId); }
  executeOrderDiscrepancy(orderId: string, input: OrderDiscrepancyCommand) { return documentsApi.executeOrderDiscrepancy(this, orderId, input); }
  uploadDiscrepancyAttachment(orderId: string, input: { fileName: string; contentBase64: string }) { return documentsApi.uploadDiscrepancyAttachment(this, orderId, input); }
  downloadDiscrepancyAttachment(orderId: string, discrepancyId: string, assetId: string) { return documentsApi.downloadDiscrepancyAttachment(this, orderId, discrepancyId, assetId); }

  getShipmentWaybills(orderId: string, shipmentId: string) { return documentsApi.getShipmentWaybills(this, orderId, shipmentId); }

  prepareShipmentWaybill(orderId: string, shipmentId: string, input: PrepareShipmentWaybillInput) { return documentsApi.prepareShipmentWaybill(this, orderId, shipmentId, input); }

  getOrderInvoices(orderId: string) { return documentsApi.getOrderInvoices(this, orderId); }

  prepareOrderInvoice(orderId: string, input: PrepareOrderInvoiceInput) { return documentsApi.prepareOrderInvoice(this, orderId, input); }

  prepareOrderDocuments(orderId: string) { return documentsApi.prepareOrderDocuments(this, orderId); }

  listDocumentArchive(input: DocumentArchiveQueryInput = {}) { return documentsApi.listDocumentArchive(this, input); }

  getDocumentArchiveSummary() { return documentsApi.getDocumentArchiveSummary(this); }

  getArchiveDocument(documentId: string) { return documentsApi.getArchiveDocument(this, documentId); }

  updateDocumentAccountingStatus(documentId: string, input: UpdateDocumentAccountingStatusInput) { return documentsApi.updateDocumentAccountingStatus(this, documentId, input); }

  uploadDocument(input: UploadDocumentInput) { return documentsApi.uploadDocument(this, input); }

  downloadDocument(documentId: string) { return documentsApi.downloadDocument(this, documentId); }

  searchOfferOptions(input: import("@marketplace/schemas").OfferOptionsQuery) { return catalogApi.searchOfferOptions(this, input); }

  uploadSupportAttachment(input: import("@marketplace/schemas").UploadSupportAttachmentInput) { return supportApi.uploadSupportAttachment(this, input); }

  downloadSupportAttachment(ticketId: string, messageId: string, assetId: string) { return supportApi.downloadSupportAttachment(this, ticketId, messageId, assetId); }

  workspaceCorrectionOffers(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceCorrectionOffers(this, query, options); }
  workspaceInventory(query: WorkspaceInventoryQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceInventory(this, query, options); }
  workspaceLots(balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceLots(this, balanceId, query, options); }
  workspaceReservations(balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceReservations(this, balanceId, query, options); }
  workspaceOverrides(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceOverrides(this, query, options); }
  workspaceOrders(role: "buyer" | "supplier", query: WorkspaceOrderQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceOrders(this, role, query, options); }
  workspaceOffers(query: WorkspaceOfferQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceOffers(this, query, options); }
  workspaceOffer(offerId: string, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceOffer(this, offerId, options); }
  workspaceCarts(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceCarts(this, query, options); }
  workspaceCart(cartId: string, options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceCart(this, cartId, options); }
  workspaceSummary(options?: Pick<RequestInit, "signal">) { return workspacesApi.workspaceSummary(this, options); }
  commerceAnalytics(query: CommerceAnalyticsQuery, options?: Pick<RequestInit, "signal">) { return workspacesApi.commerceAnalytics(this, query, options); }

  recoverCart(cartId: string, input: RecoverCartRequest) { return cartsApi.recoverCart(this, cartId, input); }

  updateCatalogProduct(productId: string, input: UpdateProductInput) { return catalogApi.updateCatalogProduct(this, productId, input); }

  getOrderWorkflow(orderId: string) { return ordersApi.getOrderWorkflow(this, orderId); }
  getOrderReviewState(orderId: string) { return ordersApi.getOrderReviewState(this, orderId); }
  createOrderReview(orderId: string, input: CreateVerifiedReviewInput) { return ordersApi.createOrderReview(this, orderId, input); }

  getSupplierPaymentPolicy() { return ordersApi.getSupplierPaymentPolicy(this); }

  saveSupplierPaymentPolicy(input: SaveSupplierPaymentPolicy) { return ordersApi.saveSupplierPaymentPolicy(this, input); }

  executeOrderWorkflow(orderId: string, input: OrderWorkflowCommand) { return ordersApi.executeOrderWorkflow(this, orderId, input); }

  listSupplierWarehouses(supplierId: string) { return supplierApi.listSupplierWarehouses(this, supplierId); }

  createSupplierOffer(supplierId: string, input: import("@marketplace/schemas").CreateSupplierOfferInput) { return supplierApi.createSupplierOffer(this, supplierId, input); }

  setSupplierOfferPrice(supplierId: string, offerId: string, input: import("@marketplace/schemas").SetOfferPriceInput) { return supplierApi.setSupplierOfferPrice(this, supplierId, offerId, input); }

  getSupplierOfferCommercial(supplierId: string, offerId: string, warehouseId: string) { return supplierApi.getSupplierOfferCommercial(this, supplierId, offerId, warehouseId); }

  saveSupplierOfferCommercial(supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferCommercialInput) { return supplierApi.saveSupplierOfferCommercial(this, supplierId, offerId, input); }

  saveSupplierOfferStock(supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferStockInput) { return supplierApi.saveSupplierOfferStock(this, supplierId, offerId, input); }

  saveSupplierOfferPrice(supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferPriceInput) { return supplierApi.saveSupplierOfferPrice(this, supplierId, offerId, input); }

  assignSupplierOfferPackaging(supplierId: string, offerId: string, input: import("@marketplace/schemas").AssignOfferPackagingInput) { return supplierApi.assignSupplierOfferPackaging(this, supplierId, offerId, input); }

  setSupplierInventory(supplierId: string, input: import("@marketplace/schemas").SetInventoryBalanceInput) { return supplierApi.setSupplierInventory(this, supplierId, input); }

  submitProductCandidate(input: import("@marketplace/schemas").SubmitProductCandidateInput) { return catalogApi.submitProductCandidate(this, input); }

  listProductSubmissions(query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) { return catalogApi.listProductSubmissions(this, query); }

  listManualProductReviews(query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) { return catalogApi.listManualProductReviews(this, query); }

  approveProductCandidate(candidateId: string, input: import("@marketplace/schemas").ApproveProductCandidateInput) { return catalogApi.approveProductCandidate(this, candidateId, input); }

  rejectProductCandidate(candidateId: string, input: import("@marketplace/schemas").RejectProductCandidateInput) { return catalogApi.rejectProductCandidate(this, candidateId, input); }

  listSupplierImportBatches(supplierId: string, query: import("@marketplace/schemas").SupplierImportHistoryQuery = {}) { return supplierImportsApi.listSupplierImportBatches(this, supplierId, query); }

  previewSupplierImport(supplierId: string, input: import("@marketplace/schemas").SupplierImportPreviewInput) { return supplierImportsApi.previewSupplierImport(this, supplierId, input); }

  previewSupplierImportTax(supplierId: string, input: import("@marketplace/schemas").SupplierImportTaxPreviewInput) { return supplierImportsApi.previewSupplierImportTax(this, supplierId, input); }

  listIntegrationTaxBindings(supplierId: string) { return integrationsApi.listIntegrationTaxBindings(this, supplierId); }

  updateIntegrationTax(supplierId: string, connectionId: string, bindingId: string, input: import("@marketplace/schemas").UpdateIntegrationTaxInput) { return integrationsApi.updateIntegrationTax(this, supplierId, connectionId, bindingId, input); }

  listOfferDeliveryOptions(supplierId: string, offerId: string) { return deliveryApi.listOfferDeliveryOptions(this, supplierId, offerId); }

  saveOfferDeliveryOption(supplierId: string, offerId: string, input: import("@marketplace/schemas").CreateOfferDeliveryOptionInput) { return deliveryApi.saveOfferDeliveryOption(this, supplierId, offerId, input); }

  createSupplierImportBatch(
    supplierOrganizationId: string,
    input: CreateImportBatchInput,
  ) { return supplierImportsApi.createSupplierImportBatch(this, supplierOrganizationId, input); }

  processSupplierImportBatch(supplierOrganizationId: string, batchId: string) { return supplierImportsApi.processSupplierImportBatch(this, supplierOrganizationId, batchId); }

  getSupplierImportBatch(supplierOrganizationId: string, batchId: string) { return supplierImportsApi.getSupplierImportBatch(this, supplierOrganizationId, batchId); }

  getSupplierImportDiagnostics(
    supplierOrganizationId: string,
    batchId: string,
  ) { return supplierImportsApi.getSupplierImportDiagnostics(this, supplierOrganizationId, batchId); }

  rollbackSupplierImportBatch(
    supplierOrganizationId: string,
    batchId: string,
    input: RollbackImportBatchInput,
  ) { return supplierImportsApi.rollbackSupplierImportBatch(this, supplierOrganizationId, batchId, input); }

  resolveIntegrationReconciliation(supplierId: string, connectionId: string, entryId: string, input: import("@marketplace/schemas").ResolveReconciliationInput) { return integrationsApi.resolveIntegrationReconciliation(this, supplierId, connectionId, entryId, input); }

  listCatalogImportReviews() { return catalogApi.listCatalogImportReviews(this); }

  approveCatalogImportCandidate(
    candidateId: string,
    input: ApproveImportProductCandidateInput,
  ) { return catalogApi.approveCatalogImportCandidate(this, candidateId, input); }

  setSupplierOfferPublication(
    supplierOrganizationId: string,
    offerId: string,
    input: SetOfferPublicationInput,
  ) { return supplierApi.setSupplierOfferPublication(this, supplierOrganizationId, offerId, input); }

  listOutboxDeadLetters(input: OutboxDeadLetterQueryInput = {}, signal?: AbortSignal) { return operationsApi.listOutboxDeadLetters(this, input, signal); }

  replayOutboxDeadLetter(eventId: string, input: OutboxReplayInput) { return operationsApi.replayOutboxDeadLetter(this, eventId, input); }
}
export { unifiedFrontend, workspacePath } from "./frontend-routes";
