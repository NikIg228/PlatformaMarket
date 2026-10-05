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

/** Revoke the handoff's session, never an unrelated refresh-cookie session. */
export async function revokeWorkspaceSession(
  apiUrl: string,
  session: { sessionId?: string; accessToken?: string } | null,
): Promise<void> {
  if (!session?.sessionId || !session.accessToken) {
    throw new Error("Не удалось определить серверную сессию. Выход не подтверждён.");
  }
  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/sessions/${encodeURIComponent(session.sessionId)}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
      // Existing bearer endpoint: no identity headers, refresh cookies or
      // fallback to logout of a potentially different cookie-bound session.
      credentials: "omit",
      body: JSON.stringify({ reason: "user_logout" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Не удалось связаться с сервером. Выход не подтверждён — проверьте соединение и повторите.");
  }
  if (!response.ok) {
    throw new Error(response.status === 401
      ? "Сервер не подтвердил выход: доступ к сессии истёк или уже отозван. Повторите попытку; при повторной ошибке обратитесь в поддержку."
      : "Сервер не подтвердил выход. Повторите попытку.");
  }
  const result = await response.json().catch(() => null) as { id?: string; status?: string } | null;
  if (result?.id !== session.sessionId || result.status !== "REVOKED") {
    throw new Error("Сервер не подтвердил отзыв текущей сессии. Повторите попытку.");
  }
}

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
  createSupportTicket(input: import("@marketplace/schemas").CreateSupportTicketInput) { return this.post<import("@marketplace/schemas").SupportTicketSummary>("/support/tickets", input); }
  internalNotifications(organizationId: string, offset = 0) { return this.get<import("@marketplace/schemas").InternalNotification[]>(`/notifications/organizations/${encodeURIComponent(organizationId)}?channel=IN_APP&limit=50&offset=${offset}`); }
  readNotification(id: string) { return this.post<import("@marketplace/schemas").InternalNotification>(`/notifications/${encodeURIComponent(id)}/read`, {}); }
  operationObject(type: import("@marketplace/schemas").OperationQueueType, id: string) { return this.get<import("@marketplace/schemas").OperationObject>(`/operations/work-queue/${type}/${encodeURIComponent(id)}`); }
  supportTickets(status?: string, offset = 0) { return this.get<import("@marketplace/schemas").SupportTicketSummary[]>(`/support/tickets?offset=${offset}${status ? `&status=${encodeURIComponent(status)}` : ""}`); }
  supportTicket(id: string, beforeMessageId?: string) { return this.get<import("@marketplace/schemas").SupportTicketDetail>(`/support/tickets/${encodeURIComponent(id)}${beforeMessageId ? `?beforeMessageId=${encodeURIComponent(beforeMessageId)}` : ""}`); }
  updateSupportTicket(id: string, input: import("@marketplace/schemas").UpdateSupportTicketInput) { return this.patch<import("@marketplace/schemas").SupportTicketSummary>(`/support/tickets/${encodeURIComponent(id)}`, input); }
  supportTicketHistory(id: string) { return this.get<import("@marketplace/schemas").OperationHistory>(`/support/tickets/${encodeURIComponent(id)}/history`); }
  addSupportMessage(id: string, input: import("@marketplace/schemas").AddSupportMessageInput) { return this.post<import("@marketplace/schemas").SupportTicketDetail["messages"][number]>(`/support/tickets/${encodeURIComponent(id)}/messages`, input); }
  conversationContext(contextType: "OFFER" | "ORDER", contextId: string) { return this.get<{ conversationId: string | null }>(`/conversations/context?contextType=${contextType}&contextId=${encodeURIComponent(contextId)}`); }
  operationWorkQueue(offset = 0) { return this.get<import("@marketplace/schemas").OperationWorkQueue>(`/operations/work-queue?offset=${offset}`); }
  operationAssignees() { return this.get<{ id: string; displayName: string }[]>("/operations/work-queue/assignees"); }
  assignOperation(type: import("@marketplace/schemas").OperationQueueType, id: string, input: import("@marketplace/schemas").OperationAssignment) { return this.post<import("@marketplace/schemas").OperationAssignmentResult>(`/operations/work-queue/${type}/${encodeURIComponent(id)}/assignment`, input); }
  operationHistory(type: import("@marketplace/schemas").OperationQueueType, id: string) { return this.get<import("@marketplace/schemas").OperationHistory>(`/operations/work-queue/${type}/${encodeURIComponent(id)}/history`); }
  conversations(query: Partial<import("@marketplace/schemas").ConversationQuery> = {}) {
    const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
    return this.get<import("@marketplace/schemas").ConversationPage>(`/conversations?${params}`);
  }
  conversation(id: string, beforeSequence?: number) { return this.get<import("@marketplace/schemas").ConversationDetail>(`/conversations/${encodeURIComponent(id)}${beforeSequence ? `?beforeSequence=${beforeSequence}` : ""}`); }
  startConversation(input: import("@marketplace/schemas").StartConversation) { return this.post<{ conversationId: string }>("/conversations", input); }
  sendConversationMessage(id: string, input: import("@marketplace/schemas").ConversationMessageInput) { return this.post<{ conversationId: string }>(`/conversations/${encodeURIComponent(id)}/messages`, input); }
  readConversation(id: string, throughSequence: number) { return this.post<{ throughSequence: number }>(`/conversations/${encodeURIComponent(id)}/read`, { throughSequence }); }
  resolveConversation(id: string, expectedVersion: number) { return this.post<{ conversationId: string }>(`/conversations/${encodeURIComponent(id)}/resolve`, { expectedVersion }); }
  escalateConversation(id: string, input: import("@marketplace/schemas").ConversationEscalation) { return this.post<{ ticketId: string }>(`/conversations/${encodeURIComponent(id)}/escalate`, input); }
  listPromotions(query: Partial<PromotionListQuery> = {}) { return this.get<PromotionPage>(`/promotions?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`); }
  listPublicPromotions(query: Partial<PromotionListQuery> = {}) { return this.get<PublicPromotionPage>(`/promotions/storefront?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`); }
  createOfferPromotion(input: CreateOfferPromotion) { return this.post<OfferPromotion>("/promotions", input); }
  reviseOfferPromotion(id: string, input: ReviseOfferPromotion) { return this.patch<OfferPromotion>(`/promotions/${encodeURIComponent(id)}/terms`, input); }
  commandOfferPromotion(id: string, input: OfferPromotionCommand) { return this.post<OfferPromotion>(`/promotions/${encodeURIComponent(id)}/commands`, input); }
  getSupplierLegalDocuments() { return this.get<SupplierLegalBundle>("/supplier-terms/documents"); }
  getSupplierTerms() { return this.get<SupplierTermsState>("/supplier-terms/current"); }
  getOrganizationProfile() { return this.get<OrganizationProfileResponse>("/organizations/current/profile"); }
  saveOrganizationProfile(input: SaveOrganizationProfileInput) { return this.post<OrganizationProfileResponse>("/organizations/current/profile", input); }
  getOrganizationOnboarding() { return this.get<OrganizationOnboarding>("/organizations/current/onboarding"); }
  getOperatorOrganizationOnboarding(id: string) { return this.get<OrganizationOnboarding>(`/organizations/${encodeURIComponent(id)}/onboarding`); }
  acceptSupplierTerms(input: AcceptSupplierTermsInput) { return this.post<SupplierTermsAcceptance>("/supplier-terms/acceptances", input); }
  getSupplierAdmissions() { return this.get<SupplierAdmissionList>("/supplier-terms/operator/acceptances"); }
  reviewSupplierAdmission(id: string, input: ReviewSupplierAdmissionInput) { return this.post<SupplierTermsAcceptance>(`/supplier-terms/operator/acceptances/${encodeURIComponent(id)}/review`, input); }
  downloadSupplierTerms(id: string) { return this.download(`/supplier-terms/acceptances/${encodeURIComponent(id)}/download`); }
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
  requestRegistrationResume(input: RegistrationResumeRequest) {
    return this.post<RegistrationResumeRequested>("/auth/registration/resume/request", input);
  }
  authClientOptions() { return this.get<AuthClientOptions>("/auth/client-options"); }
  loginEmail(input: import("@marketplace/schemas").AuthEmailLogin) { return this.request<import("@marketplace/schemas").AuthEmailSession>("/auth/login", { method: "POST", credentials: "include", body: JSON.stringify(input) }); }
  verifyEmail(input: import("@marketplace/schemas").AuthEmailToken) { return this.request<import("@marketplace/schemas").AuthEmailVerified>("/auth/email/verify", { method: "POST", credentials: "include", body: JSON.stringify(input) }); }
  resetPassword(input: import("@marketplace/schemas").AuthPasswordReset) { return this.post<import("@marketplace/schemas").AuthPasswordResetResult>("/auth/password/reset", input); }
  mfaStatus() { return this.get<import("@marketplace/schemas").MfaStatus>("/identity/mfa"); }
  enrollMfa() { return this.post<import("@marketplace/schemas").MfaEnrollment>("/identity/mfa/totp/enroll", {}); }
  verifyMfaEnrollment(input: import("@marketplace/schemas").MfaCodeInput) { return this.post<import("@marketplace/schemas").MfaVerificationResult>("/identity/mfa/totp/verify", input); }
  challengeMfa(input: import("@marketplace/schemas").MfaCodeInput) { return this.post<import("@marketplace/schemas").MfaChallengeResult>("/identity/mfa/challenge", input); }
  disableMfa(input: import("@marketplace/schemas").MfaCodeInput) { return this.post<import("@marketplace/schemas").MfaDisabled>("/identity/mfa/disable", input); }
  workspaceContext() { return this.get<WorkspaceContext>("/auth/workspace-context"); }
  registerEmail(input: AuthEmailRegistration) { return this.post<AuthRegistrationAccepted>("/auth/register", input); }
  requestPasswordReset(email: string) { return this.post<AuthForgotAccepted>("/auth/password/forgot", { email }); }
  listMembers(organizationId: string) { return this.get<IdentityMember[]>(`/organizations/${encodeURIComponent(organizationId)}/memberships`); }
  listRoles(organizationId: string) { return this.get<IdentityRole[]>(`/organizations/${encodeURIComponent(organizationId)}/roles`); }
  getAccessPolicy(signal?: AbortSignal) { return this.get<AccessPolicy>("/access-control/policy", { signal }); }
  updateMember(organizationId: string, memberId: string, input: UpdateMembershipInput) { return this.patch<IdentityMember>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}`, input); }
  assignMemberRole(organizationId: string, memberId: string, roleId: string) { return this.post<unknown>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}/roles`, { roleId }); }
  removeMemberRole(organizationId: string, memberId: string, roleId: string) { return this.request<unknown>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }); }
  listInvitations(organizationId: string) { return this.get<InvitationSummary[]>(`/organizations/${encodeURIComponent(organizationId)}/invitations`); }
  createInvitation(organizationId: string, input: CreateInvitationInput) { return this.post<InvitationCreated>(`/organizations/${encodeURIComponent(organizationId)}/invitations`, input); }
  deliverInvitation(organizationId: string, invitationId: string) { return this.post<InvitationDelivered>(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/deliver`); }
  revokeInvitation(organizationId: string, invitationId: string) { return this.post<{ ok: true }>(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`); }
  invitationDetails(token: string) { return this.post<InvitationDetails>("/invitations/details", { token }); }
  acceptInvitation(input: AcceptInvitationInput) { return this.post<InvitationAccepted>("/invitations/accept", input); }
  listSessions() { return this.get<IdentitySession[]>("/auth/sessions"); }
  revokeSession(sessionId: string) { return this.post<IdentitySessionRevoked>(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { reason: "user_security_settings" }); }
  loginLocalOperator(input: LocalOperatorLogin) { return this.post<LocalOperatorSession>("/auth/local-operator/login", input); }
  inspectRegistrationResume(input: RegistrationResumeProof) {
    return this.post<RegistrationResumeDetails>("/auth/registration/resume/inspect", input);
  }
  completeRegistrationResume(input: RegistrationResumeComplete) {
    return this.post<RegistrationResumeCompleted>("/auth/registration/resume/complete", input);
  }
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

  private withQuery(path: string, input: Record<string, unknown>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null || value === "") continue;
      query.set(key, String(value));
    }
    const serialized = query.toString();
    return serialized ? `${path}?${serialized}` : path;
  }

  searchCatalog(input: SearchCatalogRequest) {
    return this.get<CatalogSearchResponse>(
      this.withQuery("/marketplace/search", input),
    );
  }

  searchPublicCatalog(
    input: Omit<SearchCatalogRequest, "buyerOrganizationId">,
  ) {
    return this.get<CatalogSearchResponse>(
      this.withQuery("/catalog/search", input),
    );
  }

  compareOffers(input: CompareOffersRequest) {
    const { productId, ...query } = input;
    return this.get<OfferComparisonResponse>(
      this.withQuery(`/marketplace/products/${productId}/compare`, query),
    );
  }

  comparePublicOffers(
    productId: string,
    input: Omit<CompareOffersRequest, "buyerOrganizationId" | "productId">,
  ) {
    return this.get<OfferComparisonResponse>(
      this.withQuery(`/catalog/products/${productId}/compare`, input),
    );
  }

  listCarts(buyerOrganizationId: string) {
    return this.get<CartResponse[]>(`/buyers/${buyerOrganizationId}/carts`);
  }

  createCart(buyerOrganizationId: string, input: CreateCartRequest) {
    return this.post<CartResponse>(
      `/buyers/${buyerOrganizationId}/carts`,
      input,
    );
  }

  addCartItem(cartId: string, input: AddCartItemRequest) {
    return this.post<CartItemResponse>(`/carts/${cartId}/items`, input);
  }

  updateCartItem(cartId: string, itemId: string, input: UpdateCartItemRequest) {
    return this.patch<CartResponse>(`/carts/${cartId}/items/${itemId}`, input);
  }

  removeCartItem(cartId: string, itemId: string, input: CartVersionRequest) {
    return this.request<CartResponse>(`/carts/${cartId}/items/${itemId}`, { method: "DELETE", body: JSON.stringify(input) });
  }

  repriceCart(cartId: string, input: RepriceCartRequest = {}) {
    return this.post<CartResponse>(`/carts/${cartId}/reprice`, input);
  }

  validateCart(cartId: string) {
    return this.post<CartValidationResponse>(`/carts/${cartId}/validate`);
  }

  checkoutCart(cartId: string, input: CheckoutCartRequest) {
    return this.post<CheckoutResponse>(`/carts/${cartId}/checkout`, input);
  }

  getCheckout(checkoutId: string) {
    return this.get<CheckoutResponse>(`/checkouts/${checkoutId}`);
  }

  listBuyerOrders(buyerOrganizationId: string) {
    return this.get<SupplierOrderResponse[]>(
      `/buyers/${buyerOrganizationId}/orders`,
    );
  }

  listSupplierOrders(checkoutId?: string) {
    return this.get<SupplierOrderResponse[]>(
      this.withQuery("/supplier-orders", { checkoutId }),
    );
  }

  confirmSupplierOrder(orderId: string, input: ConfirmSupplierOrderRequest) {
    return this.post<SupplierOrderResponse>(
      `/supplier-orders/${orderId}/confirm`,
      input,
    );
  }

  listOrderShipments(orderId: string) {
    return this.get<ShipmentResponse[]>(
      `/supplier-orders/${orderId}/shipments`,
    );
  }

  createShipment(orderId: string, input: CreateShipmentRequest) {
    return this.post<ShipmentResponse>(
      `/supplier-orders/${orderId}/shipments`,
      input,
    );
  }

  transitionShipment(shipmentId: string, input: TransitionShipmentRequest) {
    return this.post<ShipmentResponse>(
      `/shipments/${shipmentId}/transitions`,
      input,
    );
  }

  generateOrderDocumentPack(
    orderId: string,
    input: GenerateOrderDocumentPackRequest,
  ) {
    return this.post<OrderDocumentPackResponse>(
      `/supplier-orders/${orderId}/document-pack`,
      input,
    );
  }

  prepareOrderDocuments(orderId: string) {
    return this.post<PreparedOrderDocumentsResponse>(
      `/supplier-orders/${orderId}/documents/prepare`,
      {},
    );
  }

  listDocumentArchive(input: DocumentArchiveQueryInput = {}) {
    return this.get<DocumentArchivePageResponse>(
      this.withQuery("/documents/archive", input),
    );
  }

  getDocumentArchiveSummary() {
    return this.get<DocumentArchiveSummaryResponse>("/documents/archive/summary");
  }

  getArchiveDocument(documentId: string) {
    return this.get<DocumentArchiveItem>(`/documents/archive/${documentId}`);
  }

  updateDocumentAccountingStatus(documentId: string, input: UpdateDocumentAccountingStatusInput) {
    return this.patch<DocumentArchiveItem>(`/documents/archive/${documentId}/accounting-status`, input);
  }

  uploadDocument(input: UploadDocumentInput) {
    return this.post<import("@marketplace/schemas").UploadedDocument>("/documents/upload", input);
  }

  downloadDocument(documentId: string) {
    return this.download(`/documents/${documentId}/download`);
  }

  searchOfferOptions(input: import("@marketplace/schemas").OfferOptionsQuery) {
    return this.get<import("@marketplace/schemas").OfferOptionsResponse>(this.withQuery("/catalog/offer-options", input));
  }

  workspaceCorrectionOffers(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceCorrectionOfferPage>(this.withQuery(`/workspaces/supplier/correction-offers`, query), options);
  }
  workspaceInventory(query: WorkspaceInventoryQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceInventoryPage>(this.withQuery(`/workspaces/supplier/inventory`, query), options);
  }
  workspaceLots(balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceLotPage>(this.withQuery(`/workspaces/supplier/inventory/${encodeURIComponent(balanceId)}/lots`, query), options);
  }
  workspaceReservations(balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceReservationPage>(this.withQuery(`/workspaces/supplier/inventory/${encodeURIComponent(balanceId)}/reservations`, query), options);
  }
  workspaceOverrides(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceOverridePage>(this.withQuery(`/workspaces/supplier/inventory-overrides`, query), options);
  }
  workspaceOrders(role: "buyer" | "supplier", query: WorkspaceOrderQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceOrderPage>(this.withQuery(`/workspaces/${role}/orders`, query), options);
  }
  workspaceOffers(query: WorkspaceOfferQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceOfferPage>(this.withQuery("/workspaces/supplier/offers", query), options);
  }
  workspaceOffer(offerId: string, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceOffer>(`/workspaces/supplier/offers/${offerId}`, options);
  }
  workspaceCarts(query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceCartPage>(this.withQuery("/workspaces/buyer/carts", query), options);
  }
  workspaceCart(cartId: string, options?: Pick<RequestInit, "signal">) {
    return this.get<CartResponse>(`/workspaces/buyer/carts/${cartId}`, options);
  }
  workspaceSummary(options?: Pick<RequestInit, "signal">) {
    return this.get<WorkspaceSummary>("/workspaces/supplier/summary", options);
  }
  commerceAnalytics(query: CommerceAnalyticsQuery, options?: Pick<RequestInit, "signal">) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    return this.get<CommerceAnalyticsResponse>(`/commerce-analytics?${params}`, options);
  }

  recoverCart(cartId: string, input: RecoverCartRequest) {
    return this.post<CartResponse>(`/carts/${cartId}/recover`, input);
  }

  updateCatalogProduct(productId: string, input: UpdateProductInput) {
    return this.patch<UpdatedCatalogProduct>(`/catalog/products/${encodeURIComponent(productId)}`, input);
  }

  getOrderWorkflow(orderId: string) {
    return this.get<OrderWorkflowResponse>(`/supplier-orders/${orderId}/workflow`);
  }

  getSupplierPaymentPolicy() {
    return this.get<SupplierPaymentPolicyResponse>("/suppliers/current/payment-review-policy");
  }

  saveSupplierPaymentPolicy(input: SaveSupplierPaymentPolicy) {
    return this.post<SupplierPaymentPolicyResponse>("/suppliers/current/payment-review-policy", input);
  }

  executeOrderWorkflow(orderId: string, input: OrderWorkflowCommand) {
    return this.post<OrderWorkflowResult>(`/supplier-orders/${orderId}/workflow`, input);
  }

  listSupplierWarehouses(supplierId: string) {
    return this.get<import("@marketplace/schemas").SupplierWarehouseList>(`/suppliers/${supplierId}/warehouses`);
  }

  createSupplierOffer(supplierId: string, input: import("@marketplace/schemas").CreateSupplierOfferInput) {
    return this.post<import("@marketplace/schemas").SupplierOfferCreated>(`/suppliers/${supplierId}/offers`, input);
  }

  setSupplierOfferPrice(supplierId: string, offerId: string, input: import("@marketplace/schemas").SetOfferPriceInput) {
    return this.put<unknown>(`/suppliers/${supplierId}/offers/${offerId}/price`, input);
  }

  getSupplierOfferCommercial(supplierId: string, offerId: string, warehouseId: string) {
    return this.get<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial/${warehouseId}`);
  }

  saveSupplierOfferCommercial(supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferCommercialInput) {
    return this.put<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial`, input);
  }

  assignSupplierOfferPackaging(supplierId: string, offerId: string, input: import("@marketplace/schemas").AssignOfferPackagingInput) {
    return this.put<unknown>(`/suppliers/${supplierId}/offers/${offerId}/packaging`, input);
  }

  setSupplierInventory(supplierId: string, input: import("@marketplace/schemas").SetInventoryBalanceInput) {
    return this.put<unknown>(`/suppliers/${supplierId}/inventory/balances`, input);
  }

  submitProductCandidate(input: import("@marketplace/schemas").SubmitProductCandidateInput) {
    return this.post<import("@marketplace/schemas").ProductCandidateSubmitted>("/moderation/product-candidates/submissions", input);
  }

  listProductSubmissions(query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) {
    return this.get<import("@marketplace/schemas").ProductCandidateHistoryResponse>(this.withQuery("/moderation/product-candidates/submissions", query));
  }

  listManualProductReviews(query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) {
    return this.get<import("@marketplace/schemas").ManualProductReviewQueue>(this.withQuery("/moderation/product-candidates/review-queue", query));
  }

  approveProductCandidate(candidateId: string, input: import("@marketplace/schemas").ApproveProductCandidateInput) {
    return this.post<import("@marketplace/schemas").ApproveProductCandidateResponse>(`/moderation/product-candidates/${candidateId}/approve`, input);
  }

  rejectProductCandidate(candidateId: string, input: import("@marketplace/schemas").RejectProductCandidateInput) {
    return this.post<import("@marketplace/schemas").ProductCandidateSummary>(`/moderation/product-candidates/${candidateId}/reject`, input);
  }

  listSupplierImportBatches(supplierId: string, query: import("@marketplace/schemas").SupplierImportHistoryQuery = {}) {
    return this.get<SupplierImportBatchResponse[]>(this.withQuery(`/suppliers/${supplierId}/import-batches`, query));
  }

  listOfferDeliveryOptions(supplierId: string, offerId: string) {
    return this.get<import("@marketplace/schemas").OfferDeliveryOptionResponse[]>(`/suppliers/${supplierId}/offers/${offerId}/delivery-options`);
  }

  saveOfferDeliveryOption(supplierId: string, offerId: string, input: import("@marketplace/schemas").CreateOfferDeliveryOptionInput) {
    return this.post<import("@marketplace/schemas").OfferDeliveryOptionResponse>(`/suppliers/${supplierId}/offers/${offerId}/delivery-options`, input);
  }

  createSupplierImportBatch(
    supplierOrganizationId: string,
    input: CreateImportBatchInput,
  ) {
    return this.post<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches`,
      input,
    );
  }

  processSupplierImportBatch(supplierOrganizationId: string, batchId: string) {
    return this.post<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/process`,
      {},
    );
  }

  getSupplierImportBatch(supplierOrganizationId: string, batchId: string) {
    return this.get<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}`,
    );
  }

  getSupplierImportDiagnostics(
    supplierOrganizationId: string,
    batchId: string,
  ) {
    return this.get<SupplierImportDiagnosticsResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/diagnostics`,
    );
  }

  rollbackSupplierImportBatch(
    supplierOrganizationId: string,
    batchId: string,
    input: RollbackImportBatchInput,
  ) {
    return this.post<SupplierImportRollbackResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/rollback`,
      input,
    );
  }

  listCatalogImportReviews() {
    return this.get<CatalogImportReviewQueueResponse>(
      "/moderation/import-reviews",
    );
  }

  approveCatalogImportCandidate(
    candidateId: string,
    input: ApproveImportProductCandidateInput,
  ) {
    return this.post<CatalogImportReview>(
      `/moderation/import-reviews/${candidateId}/approve`,
      input,
    );
  }

  setSupplierOfferPublication(
    supplierOrganizationId: string,
    offerId: string,
    input: SetOfferPublicationInput,
  ) {
    return this.put<SupplierOfferPublicationResponse>(
      `/suppliers/${supplierOrganizationId}/offers/${offerId}/publication`,
      input,
    );
  }

  listOutboxDeadLetters(input: OutboxDeadLetterQueryInput = {}) {
    return this.get<OutboxDeadLetterListResponse>(
      this.withQuery("/operations/outbox/dead-letter", input),
    );
  }

  replayOutboxDeadLetter(eventId: string, input: OutboxReplayInput) {
    return this.post<OutboxReplayResponse>(
      `/operations/outbox/dead-letter/${eventId}/replay`,
      input,
    );
  }
}
export { unifiedFrontend, workspacePath } from "./frontend-routes";
