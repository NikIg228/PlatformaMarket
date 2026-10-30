import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { SearchCatalogRequest, CatalogSearchResponse, CompareOffersRequest, OfferComparisonResponse, UpdateProductInput, UpdatedCatalogProduct, CatalogImportReviewQueueResponse, ApproveImportProductCandidateInput, CatalogImportReview } from "@marketplace/schemas";

export function searchCatalog(transport: ClientTransport, input: SearchCatalogRequest) {
    return transport.get<CatalogSearchResponse>(
      withQuery("/marketplace/search", input),
    );
  }

export function searchPublicCatalog(transport: ClientTransport, input: Omit<SearchCatalogRequest, "buyerOrganizationId">) {
    return transport.get<CatalogSearchResponse>(
      withQuery("/catalog/search", input),
    );
  }

export function compareOffers(transport: ClientTransport, input: CompareOffersRequest) {
    const { productId, ...query } = input;
    return transport.get<OfferComparisonResponse>(
      withQuery(`/marketplace/products/${productId}/compare`, query),
    );
  }

export function comparePublicOffers(transport: ClientTransport, productId: string, input: Omit<CompareOffersRequest, "buyerOrganizationId" | "productId">) {
    return transport.get<OfferComparisonResponse>(
      withQuery(`/catalog/products/${productId}/compare`, input),
    );
  }

export function searchOfferOptions(transport: ClientTransport, input: import("@marketplace/schemas").OfferOptionsQuery) {
    return transport.get<import("@marketplace/schemas").OfferOptionsResponse>(withQuery("/catalog/offer-options", input));
  }

export function updateCatalogProduct(transport: ClientTransport, productId: string, input: UpdateProductInput) {
    return transport.patch<UpdatedCatalogProduct>(`/catalog/products/${encodeURIComponent(productId)}`, input);
  }

export function submitProductCandidate(transport: ClientTransport, input: import("@marketplace/schemas").SubmitProductCandidateInput) {
    return transport.post<import("@marketplace/schemas").ProductCandidateSubmitted>("/moderation/product-candidates/submissions", input);
  }

export function listProductSubmissions(transport: ClientTransport, query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) {
    return transport.get<import("@marketplace/schemas").ProductCandidateHistoryResponse>(withQuery("/moderation/product-candidates/submissions", query));
  }

export function listManualProductReviews(transport: ClientTransport, query: import("@marketplace/schemas").ProductCandidateHistoryQuery = {}) {
    return transport.get<import("@marketplace/schemas").ManualProductReviewQueue>(withQuery("/moderation/product-candidates/review-queue", query));
  }

export function approveProductCandidate(transport: ClientTransport, candidateId: string, input: import("@marketplace/schemas").ApproveProductCandidateInput) {
    return transport.post<import("@marketplace/schemas").ApproveProductCandidateResponse>(`/moderation/product-candidates/${candidateId}/approve`, input);
  }

export function rejectProductCandidate(transport: ClientTransport, candidateId: string, input: import("@marketplace/schemas").RejectProductCandidateInput) {
    return transport.post<import("@marketplace/schemas").ProductCandidateSummary>(`/moderation/product-candidates/${candidateId}/reject`, input);
  }

export function listCatalogImportReviews(transport: ClientTransport) {
    return transport.get<CatalogImportReviewQueueResponse>(
      "/moderation/import-reviews",
    );
  }

export function approveCatalogImportCandidate(transport: ClientTransport, candidateId: string, input: ApproveImportProductCandidateInput) {
    return transport.post<CatalogImportReview>(
      `/moderation/import-reviews/${candidateId}/approve`,
      input,
    );
  }
