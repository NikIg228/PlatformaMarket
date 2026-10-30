import type { ClientTransport } from "../transport-contract";
import type { SupplierLegalBundle, SupplierTermsState, OrganizationProfileResponse, SaveOrganizationProfileInput, OrganizationRequisitesResponse, SaveOrganizationRequisitesInput, OrganizationRequisitesMutation, ConfirmOrganizationRequisitesInput, OrganizationRequisitesHistoryQuery, OrganizationRequisitesHistory, OrganizationOnboarding, AcceptSupplierTermsInput, SupplierTermsAcceptance, SupplierAdmissionList, ReviewSupplierAdmissionInput } from "@marketplace/schemas";

export function getSupplierLegalDocuments(transport: ClientTransport) { return transport.get<SupplierLegalBundle>("/supplier-terms/documents"); }

export function getSupplierTerms(transport: ClientTransport) { return transport.get<SupplierTermsState>("/supplier-terms/current"); }

export function getOrganizationProfile(transport: ClientTransport) { return transport.get<OrganizationProfileResponse>("/organizations/current/profile"); }

export function saveOrganizationProfile(transport: ClientTransport, input: SaveOrganizationProfileInput) { return transport.post<OrganizationProfileResponse>("/organizations/current/profile", input); }

export function getOrganizationRequisites(transport: ClientTransport) { return transport.get<OrganizationRequisitesResponse>("/organizations/current/requisites"); }

export function saveOrganizationRequisites(transport: ClientTransport, input: SaveOrganizationRequisitesInput) { return transport.post<OrganizationRequisitesMutation>("/organizations/current/requisites", input); }

export function confirmOrganizationRequisites(transport: ClientTransport, input: ConfirmOrganizationRequisitesInput) { return transport.post<OrganizationRequisitesMutation>("/organizations/current/requisites/confirm", input); }

export function getOrganizationRequisitesHistory(transport: ClientTransport, query: OrganizationRequisitesHistoryQuery = {}) {
    const suffix = query.beforeVersion === undefined ? "" : `?beforeVersion=${encodeURIComponent(query.beforeVersion)}`;
    return transport.get<OrganizationRequisitesHistory>(`/organizations/current/requisites/history${suffix}`);
  }

export function getOrganizationOnboarding(transport: ClientTransport) { return transport.get<OrganizationOnboarding>("/organizations/current/onboarding"); }

export function getOperatorOrganizationOnboarding(transport: ClientTransport, id: string) { return transport.get<OrganizationOnboarding>(`/organizations/${encodeURIComponent(id)}/onboarding`); }

export function acceptSupplierTerms(transport: ClientTransport, input: AcceptSupplierTermsInput) { return transport.post<SupplierTermsAcceptance>("/supplier-terms/acceptances", input); }

export function getSupplierAdmissions(transport: ClientTransport) { return transport.get<SupplierAdmissionList>("/supplier-terms/operator/acceptances"); }

export function reviewSupplierAdmission(transport: ClientTransport, id: string, input: ReviewSupplierAdmissionInput) { return transport.post<SupplierTermsAcceptance>(`/supplier-terms/operator/acceptances/${encodeURIComponent(id)}/review`, input); }

export function downloadSupplierTerms(transport: ClientTransport, id: string) { return transport.download(`/supplier-terms/acceptances/${encodeURIComponent(id)}/download`); }
