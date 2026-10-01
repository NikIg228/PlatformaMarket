import { workspaceCorrectionOfferPageSchema, workspaceInventoryPageSchema, workspaceLotPageSchema, workspaceReservationPageSchema, workspaceOverridePageSchema } from "@marketplace/schemas";
import { createOfferPromotionSchema, reviseOfferPromotionSchema, offerPromotionCommandSchema, offerPromotionSchema, promotionPageSchema, publicPromotionPageSchema } from "@marketplace/schemas";
import { orderWorkflowCommandSchema, orderWorkflowResponseSchema, orderWorkflowResultSchema } from "@marketplace/schemas";
import { saveSupplierPaymentPolicySchema, supplierPaymentPolicyResponseSchema } from "@marketplace/schemas";
import { workspacePageQuerySchema, workspaceOrderQuerySchema, workspaceOrderPageSchema, workspaceOfferSchema, workspaceOfferPageSchema, workspaceCartPageSchema, workspaceSummarySchema } from "@marketplace/schemas";
import { saveOfferCommercialSchema, offerCommercialStateSchema } from "@marketplace/schemas";
import { updateProductSchema, updatedCatalogProductSchema } from "@marketplace/schemas";
import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiUnauthorizedResponse,
  type OpenAPIObject,
} from "@nestjs/swagger";
import type {
  ReferenceObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import {
  offerOptionsResponseSchema,
  manualProductReviewQueueSchema,
  rejectProductCandidateSchema, productCandidateSummarySchema,
  submitProductCandidateSchema, productCandidateSubmittedSchema, productCandidateHistoryQuerySchema, productCandidateHistoryResponseSchema, approveProductCandidateSchema, approveProductCandidateResponseSchema,
  supplierImportHistoryQuerySchema, supplierImportHistoryResponseSchema,
  createOfferDeliveryOptionSchema, offerDeliveryOptionResponseSchema, offerDeliveryOptionsResponseSchema,
  offerOptionsQuerySchema,
  setInventoryBalanceSchema,
  saveOrganizationProfileSchema, organizationProfileResponseSchema, organizationOnboardingSchema, currentSessionSchema,
  addCartItemSchema,
  acceptSupplierTermsSchema, reviewSupplierAdmissionSchema, supplierLegalBundleSchema, supplierTermsStateSchema, supplierTermsAcceptanceSchema, supplierAdmissionListSchema,
  updateCartItemSchema,
  cartVersionSchema,
  repriceCartSchema,
  workspaceContextSchema,
  workspaceChoicesSchema, workspaceHandoffRequestSchema, workspaceHandoffResponseSchema, workspaceExchangeRequestSchema, workspaceSessionSchema, workspaceRefreshResponseSchema, refreshSessionSchema,
  registrationResumeRequestSchema,
  registrationResumeProofSchema,
  registrationResumeCompleteSchema,
  registrationResumeRequestedSchema,
  registrationResumeDetailsSchema,
  registrationResumeCompletedSchema,
  authClientOptionsSchema, authRegistrationAcceptedSchema, authForgotAcceptedSchema, localOperatorLoginSchema, localOperatorSessionSchema, emailRegisterSchema, emailForgotPasswordSchema,
  approveImportProductCandidateSchema,
  cartItemResponseSchema,
  cartListResponseSchema,
  cartValidationResponseSchema,
  cartResponseSchema,
  catalogImportReviewQueueResponseSchema,
  catalogImportReviewSchema,
  catalogSearchResponseSchema,
  checkoutCartSchema,
  checkoutResponseSchema,
  compareOffersSchema,
  confirmSupplierOrderSchema,
  createImportBatchSchema,
  createShipmentSchema,
  createCartSchema,
  recoverCartSchema,
  documentArchiveItemSchema,
  documentArchivePageResponseSchema,
  documentArchiveQuerySchema,
  documentArchiveSummaryResponseSchema,
  errorResponseSchema,
  generateOrderDocumentPackSchema,
  healthResponseSchema,
  offerComparisonResponseSchema,
  orderDocumentPackResponseSchema,
  preparedOrderDocumentsResponseSchema,
  outboxDeadLetterQuerySchema,
  outboxDeadLetterListResponseSchema,
  outboxReplaySchema,
  outboxReplayResponseSchema,
  publicCityListResponseSchema,
  readinessResponseSchema,
  searchCatalogSchema,
  supplierOrderListResponseSchema,
  supplierOrderResponseSchema,
  shipmentListResponseSchema,
  shipmentResponseSchema,
  setOfferPublicationSchema,
  rollbackImportBatchSchema,
  supplierOfferPublicationResponseSchema,
  supplierImportBatchResponseSchema,
  supplierImportDiagnosticsResponseSchema,
  supplierImportRollbackResponseSchema,
  transitionShipmentSchema,
  updateDocumentAccountingStatusSchema,
} from "@marketplace/schemas";
import { z, type ZodType } from "zod";

const { buyerOrganizationId: _buyerOrganizationId, ...publicSearchShape } =
  searchCatalogSchema.shape;
const publicCatalogSearchQuerySchema = z.object(publicSearchShape);
const publicCompareOffersQuerySchema = compareOffersSchema.omit({
  buyerOrganizationId: true,
  productId: true,
});
const authenticatedCompareOffersQuerySchema = compareOffersSchema.omit({
  productId: true,
});
const supplierOrdersQuerySchema = z.object({ checkoutId: z.uuid().optional() });

const coreZodSchemas = {
  CreateOfferPromotion: createOfferPromotionSchema,
  ReviseOfferPromotion: reviseOfferPromotionSchema,
  OfferPromotionCommand: offerPromotionCommandSchema,
  OfferPromotion: offerPromotionSchema,
  PromotionPage: promotionPageSchema,
  PublicPromotionPage: publicPromotionPageSchema,
  UpdateProductRequest: updateProductSchema,
  UpdatedCatalogProduct: updatedCatalogProductSchema,
  OrderWorkflowCommand: orderWorkflowCommandSchema,
  OrderWorkflowResponse: orderWorkflowResponseSchema,
  OrderWorkflowResult: orderWorkflowResultSchema,
  SaveSupplierPaymentPolicy: saveSupplierPaymentPolicySchema,
  SupplierPaymentPolicyResponse: supplierPaymentPolicyResponseSchema,
  SaveOrganizationProfileRequest: saveOrganizationProfileSchema,
  OrganizationProfileResponse: organizationProfileResponseSchema,
  OrganizationOnboardingResponse: organizationOnboardingSchema,
  CurrentSessionResponse: currentSessionSchema.nullable(),
  AcceptSupplierTermsRequest: acceptSupplierTermsSchema,
  ReviewSupplierAdmissionRequest: reviewSupplierAdmissionSchema,
  SupplierLegalBundleResponse: supplierLegalBundleSchema,
  SupplierTermsStateResponse: supplierTermsStateSchema,
  SupplierTermsAcceptanceResponse: supplierTermsAcceptanceSchema,
  SupplierAdmissionListResponse: supplierAdmissionListSchema,
  WorkspaceContextResponse: workspaceContextSchema,
  WorkspaceChoicesResponse: workspaceChoicesSchema,
  WorkspaceHandoffRequest: workspaceHandoffRequestSchema,
  WorkspaceHandoffResponse: workspaceHandoffResponseSchema,
  WorkspaceExchangeRequest: workspaceExchangeRequestSchema,
  WorkspaceSessionResponse: workspaceSessionSchema,
  WorkspaceRefreshResponse: workspaceRefreshResponseSchema,
  WorkspaceRefreshRequest: refreshSessionSchema,
  AuthClientOptionsResponse: authClientOptionsSchema,
  AuthRegistrationAcceptedResponse: authRegistrationAcceptedSchema,
  AuthForgotAcceptedResponse: authForgotAcceptedSchema,
  LocalOperatorLoginRequest: localOperatorLoginSchema,
  LocalOperatorSessionResponse: localOperatorSessionSchema,
  AuthEmailRegisterRequest: emailRegisterSchema,
  AuthForgotRequest: emailForgotPasswordSchema,
  RegistrationResumeRequest: registrationResumeRequestSchema,
  RegistrationResumeProofRequest: registrationResumeProofSchema,
  RegistrationResumeCompleteRequest: registrationResumeCompleteSchema,
  RegistrationResumeRequestedResponse: registrationResumeRequestedSchema,
  RegistrationResumeDetailsResponse: registrationResumeDetailsSchema,
  RegistrationResumeCompletedResponse: registrationResumeCompletedSchema,
  ErrorResponse: errorResponseSchema,
  HealthResponse: healthResponseSchema,
  ReadinessResponse: readinessResponseSchema,
  PublicCityListResponse: publicCityListResponseSchema,
  PublicCatalogSearchQuery: publicCatalogSearchQuerySchema,
  AuthenticatedCatalogSearchQuery: searchCatalogSchema,
  PublicCompareOffersQuery: publicCompareOffersQuerySchema,
  AuthenticatedCompareOffersQuery: authenticatedCompareOffersQuerySchema,
  SupplierOrdersQuery: supplierOrdersQuerySchema,
  CreateCartRequest: createCartSchema,
  RecoverCartRequest: recoverCartSchema,
  AddCartItemRequest: addCartItemSchema,
  UpdateCartItemRequest: updateCartItemSchema,
  CartVersionRequest: cartVersionSchema,
  RepriceCartRequest: repriceCartSchema,
  CheckoutCartRequest: checkoutCartSchema,
  ConfirmSupplierOrderRequest: confirmSupplierOrderSchema,
  CreateSupplierImportBatchRequest: createImportBatchSchema,
  RollbackSupplierImportBatchRequest: rollbackImportBatchSchema,
  ApproveImportProductCandidateRequest: approveImportProductCandidateSchema,
  SetOfferPublicationRequest: setOfferPublicationSchema,
  CreateShipmentRequest: createShipmentSchema,
  TransitionShipmentRequest: transitionShipmentSchema,
  GenerateOrderDocumentPackRequest: generateOrderDocumentPackSchema,
  DocumentArchiveQuery: documentArchiveQuerySchema,
  UpdateDocumentAccountingStatusRequest: updateDocumentAccountingStatusSchema,
  OutboxDeadLetterQuery: outboxDeadLetterQuerySchema,
  OutboxReplayRequest: outboxReplaySchema,
  CatalogSearchResponse: catalogSearchResponseSchema,
  OfferComparisonResponse: offerComparisonResponseSchema,
  CartResponse: cartResponseSchema,
  CartListResponse: cartListResponseSchema,
  WorkspacePageQuery: workspacePageQuerySchema,
  WorkspaceOrderQuery: workspaceOrderQuerySchema,
  WorkspaceOrderPage: workspaceOrderPageSchema,
  WorkspaceOffer: workspaceOfferSchema,
  WorkspaceOfferPage: workspaceOfferPageSchema,
  WorkspaceCorrectionOfferPage: workspaceCorrectionOfferPageSchema,
  WorkspaceInventoryPage: workspaceInventoryPageSchema,
  WorkspaceLotPage: workspaceLotPageSchema,
  WorkspaceReservationPage: workspaceReservationPageSchema,
  WorkspaceOverridePage: workspaceOverridePageSchema,
  WorkspaceCartPage: workspaceCartPageSchema,
  WorkspaceSummary: workspaceSummarySchema,
  CartValidationResponse: cartValidationResponseSchema,
  CartItemResponse: cartItemResponseSchema,
  CheckoutResponse: checkoutResponseSchema,
  SupplierOrderResponse: supplierOrderResponseSchema,
  SupplierOrderListResponse: supplierOrderListResponseSchema,
  SupplierImportBatchResponse: supplierImportBatchResponseSchema,
  OfferOptionsResponse: offerOptionsResponseSchema,
  ManualProductReviewQueueResponse: manualProductReviewQueueSchema,
  RejectProductCandidateRequest: rejectProductCandidateSchema,
  ProductCandidateSummaryResponse: productCandidateSummarySchema,
  SubmitProductCandidateRequest: submitProductCandidateSchema,
  ProductCandidateSubmittedResponse: productCandidateSubmittedSchema,
  ProductCandidateHistoryQuery: productCandidateHistoryQuerySchema,
  ProductCandidateHistoryResponse: productCandidateHistoryResponseSchema,
  ApproveProductCandidateRequest: approveProductCandidateSchema,
  ApproveProductCandidateResponse: approveProductCandidateResponseSchema,
  SupplierImportHistoryQuery: supplierImportHistoryQuerySchema,
  SupplierImportHistoryResponse: supplierImportHistoryResponseSchema,
  CreateOfferDeliveryOptionRequest: createOfferDeliveryOptionSchema,
  OfferDeliveryOptionResponse: offerDeliveryOptionResponseSchema,
  OfferDeliveryOptionsResponse: offerDeliveryOptionsResponseSchema,
  OfferOptionsQuery: offerOptionsQuerySchema,
  SetInventoryBalanceRequest: setInventoryBalanceSchema,
  SaveOfferCommercialRequest: saveOfferCommercialSchema,
  OfferCommercialState: offerCommercialStateSchema,
  SupplierImportDiagnosticsResponse: supplierImportDiagnosticsResponseSchema,
  SupplierImportRollbackResponse: supplierImportRollbackResponseSchema,
  CatalogImportReviewQueueResponse: catalogImportReviewQueueResponseSchema,
  CatalogImportReviewResponse: catalogImportReviewSchema,
  SupplierOfferPublicationResponse: supplierOfferPublicationResponseSchema,
  ShipmentResponse: shipmentResponseSchema,
  ShipmentListResponse: shipmentListResponseSchema,
  OrderDocumentPackResponse: orderDocumentPackResponseSchema,
  PreparedOrderDocumentsResponse: preparedOrderDocumentsResponseSchema,
  DocumentArchiveItem: documentArchiveItemSchema,
  DocumentArchivePageResponse: documentArchivePageResponseSchema,
  DocumentArchiveSummaryResponse: documentArchiveSummaryResponseSchema,
  OutboxDeadLetterListResponse: outboxDeadLetterListResponseSchema,
  OutboxReplayResponse: outboxReplayResponseSchema,
} satisfies Record<string, ZodType>;

export type CoreOpenApiSchemaName = keyof typeof coreZodSchemas;

function jsonSchema(schema: ZodType, io: "input" | "output" = "output") {
  const converted = z.toJSONSchema(schema, { io }) as Record<string, unknown>;
  const { $schema: _, ...openApiSchema } = converted;
  return openApiSchema as SchemaObject;
}

export const coreOpenApiSchemas = Object.fromEntries(
  Object.entries(coreZodSchemas).map(([name, schema]) => [
    name,
    jsonSchema(
      schema,
      name.endsWith("Request") || name.endsWith("Query") ? "input" : "output",
    ),
  ]),
) as Record<CoreOpenApiSchemaName, SchemaObject>;

const schemaRef = (name: CoreOpenApiSchemaName): ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});

export function registerCoreOpenApiSchemas(document: OpenAPIObject) {
  document.openapi = "3.1.0";
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...coreOpenApiSchemas,
  };
  return document;
}

export function ApiCoreBody(name: CoreOpenApiSchemaName) {
  return ApiBody({ schema: schemaRef(name) });
}

export function ApiCoreResponse(
  name: CoreOpenApiSchemaName,
  status = 200,
  description?: string,
) {
  return ApiResponse({ status, description, schema: schemaRef(name) });
}

export function ApiCoreQuery(name: CoreOpenApiSchemaName) {
  const schema = coreOpenApiSchemas[name] as SchemaObject & {
    properties?: Record<string, SchemaObject>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  return applyDecorators(
    ...Object.entries(schema.properties ?? {}).map(
      ([propertyName, propertySchema]) =>
        ApiQuery({
          name: propertyName,
          required: required.has(propertyName),
          schema: propertySchema,
        }),
    ),
  );
}

export function ApiUuidParam(name: string, description?: string) {
  return ApiParam({
    name,
    description,
    schema: { type: "string", format: "uuid" },
  });
}

export function ApiCoreProtected() {
  return ApiBearerAuth("access-token");
}

export function ApiCoreErrors() {
  const response = { schema: schemaRef("ErrorResponse") };
  return applyDecorators(
    ApiBadRequestResponse(response),
    ApiUnauthorizedResponse(response),
    ApiForbiddenResponse(response),
    ApiNotFoundResponse(response),
    ApiConflictResponse(response),
  );
}

export function ApiCoreValidationErrors() {
  const response = { schema: schemaRef("ErrorResponse") };
  return applyDecorators(
    ApiBadRequestResponse(response),
    ApiNotFoundResponse(response),
  );
}
