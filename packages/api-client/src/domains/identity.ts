import type { ClientTransport } from "../transport-contract";
import type { RegistrationResumeRequest, RegistrationResumeRequested, AuthClientOptions, WorkspaceContext, AuthEmailRegistration, AuthRegistrationAccepted, AuthForgotAccepted, IdentityMember, IdentityRole, AccessPolicy, UpdateMembershipInput, InvitationSummary, CreateInvitationInput, InvitationCreated, InvitationDelivered, InvitationDetails, AcceptInvitationInput, InvitationAccepted, IdentitySession, IdentitySessionRevoked, LocalOperatorLogin, LocalOperatorSession, RegistrationResumeProof, RegistrationResumeDetails, RegistrationResumeComplete, RegistrationResumeCompleted } from "@marketplace/schemas";

export function requestRegistrationResume(transport: ClientTransport, input: RegistrationResumeRequest) {
    return transport.post<RegistrationResumeRequested>("/auth/registration/resume/request", input);
  }

export function authClientOptions(transport: ClientTransport) { return transport.get<AuthClientOptions>("/auth/client-options"); }

export function loginEmail(transport: ClientTransport, input: import("@marketplace/schemas").AuthEmailLogin) { return transport.request<import("@marketplace/schemas").AuthEmailSession>("/auth/login", { method: "POST", credentials: "include", body: JSON.stringify(input) }); }

export function verifyEmail(transport: ClientTransport, input: import("@marketplace/schemas").AuthEmailToken) { return transport.request<import("@marketplace/schemas").AuthEmailVerified>("/auth/email/verify", { method: "POST", credentials: "include", body: JSON.stringify(input) }); }

export function personalProfile(transport: ClientTransport, signal?: AbortSignal) { return transport.request<import("@marketplace/schemas").PersonalProfile>("/auth/profile", { signal }); }

export function savePersonalProfile(transport: ClientTransport, input: import("@marketplace/schemas").UpdatePersonalProfile) { return transport.request<import("@marketplace/schemas").PersonalProfile>("/auth/profile", { method: "POST", body: JSON.stringify(input) }); }

export function requestProfileEmail(transport: ClientTransport, input: import("@marketplace/schemas").RequestProfileEmail) { return transport.request<import("@marketplace/schemas").ProfileEmailRequested>("/auth/profile/email", { method: "POST", body: JSON.stringify(input) }); }

export function uploadProfileAvatar(transport: ClientTransport, input: import("@marketplace/schemas").UploadProfileAvatar) { return transport.request<import("@marketplace/schemas").PersonalProfile>("/auth/profile/avatar", { method: "POST", body: JSON.stringify(input) }); }

export function profileAvatar(transport: ClientTransport, signal?: AbortSignal) { return transport.request<import("@marketplace/schemas").ProfileAvatar>("/auth/profile/avatar", { signal }); }

export function resetPassword(transport: ClientTransport, input: import("@marketplace/schemas").AuthPasswordReset) { return transport.post<import("@marketplace/schemas").AuthPasswordResetResult>("/auth/password/reset", input); }

export function mfaStatus(transport: ClientTransport) { return transport.get<import("@marketplace/schemas").MfaStatus>("/identity/mfa"); }

export function enrollMfa(transport: ClientTransport) { return transport.post<import("@marketplace/schemas").MfaEnrollment>("/identity/mfa/totp/enroll", {}); }

export function verifyMfaEnrollment(transport: ClientTransport, input: import("@marketplace/schemas").MfaCodeInput) { return transport.post<import("@marketplace/schemas").MfaVerificationResult>("/identity/mfa/totp/verify", input); }

export function challengeMfa(transport: ClientTransport, input: import("@marketplace/schemas").MfaCodeInput) { return transport.post<import("@marketplace/schemas").MfaChallengeResult>("/identity/mfa/challenge", input); }

export function disableMfa(transport: ClientTransport, input: import("@marketplace/schemas").MfaCodeInput) { return transport.post<import("@marketplace/schemas").MfaDisabled>("/identity/mfa/disable", input); }

export function workspaceContext(transport: ClientTransport) { return transport.get<WorkspaceContext>("/auth/workspace-context"); }

export function registerEmail(transport: ClientTransport, input: AuthEmailRegistration) { return transport.post<AuthRegistrationAccepted>("/auth/register", input); }

export function requestPasswordReset(transport: ClientTransport, email: string) { return transport.post<AuthForgotAccepted>("/auth/password/forgot", { email }); }

export function listMembers(transport: ClientTransport, organizationId: string) { return transport.get<IdentityMember[]>(`/organizations/${encodeURIComponent(organizationId)}/memberships`); }

export function listRoles(transport: ClientTransport, organizationId: string) { return transport.get<IdentityRole[]>(`/organizations/${encodeURIComponent(organizationId)}/roles`); }

export function getAccessPolicy(transport: ClientTransport, signal?: AbortSignal) { return transport.get<AccessPolicy>("/access-control/policy", { signal }); }

export function updateMember(transport: ClientTransport, organizationId: string, memberId: string, input: UpdateMembershipInput) { return transport.patch<IdentityMember>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}`, input); }

export function assignMemberRole(transport: ClientTransport, organizationId: string, memberId: string, roleId: string) { return transport.post<unknown>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}/roles`, { roleId }); }

export function removeMemberRole(transport: ClientTransport, organizationId: string, memberId: string, roleId: string) { return transport.request<unknown>(`/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(memberId)}/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }); }

export function listInvitations(transport: ClientTransport, organizationId: string) { return transport.get<InvitationSummary[]>(`/organizations/${encodeURIComponent(organizationId)}/invitations`); }

export function createInvitation(transport: ClientTransport, organizationId: string, input: CreateInvitationInput) { return transport.post<InvitationCreated>(`/organizations/${encodeURIComponent(organizationId)}/invitations`, input); }

export function deliverInvitation(transport: ClientTransport, organizationId: string, invitationId: string) { return transport.post<InvitationDelivered>(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/deliver`); }

export function revokeInvitation(transport: ClientTransport, organizationId: string, invitationId: string) { return transport.post<{ ok: true }>(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}/revoke`); }

export function invitationDetails(transport: ClientTransport, token: string) { return transport.post<InvitationDetails>("/invitations/details", { token }); }

export function acceptInvitation(transport: ClientTransport, input: AcceptInvitationInput) { return transport.post<InvitationAccepted>("/invitations/accept", input); }

export function listSessions(transport: ClientTransport) { return transport.get<IdentitySession[]>("/auth/sessions"); }

export function revokeSession(transport: ClientTransport, sessionId: string) { return transport.post<IdentitySessionRevoked>(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { reason: "user_security_settings" }); }

export function loginLocalOperator(transport: ClientTransport, input: LocalOperatorLogin) { return transport.post<LocalOperatorSession>("/auth/local-operator/login", input); }

export function loginOperator(transport: ClientTransport, input: import("@marketplace/schemas").OperatorLogin) { return transport.request<import("@marketplace/schemas").OperatorSession>("/auth/operator/login", { method: "POST", body: JSON.stringify(input), credentials: "include" }); }

export function currentOperatorSession(transport: ClientTransport) { return transport.request<import("@marketplace/schemas").OperatorSession | null>("/auth/operator/current", { credentials: "include" }); }

export function logoutOperator(transport: ClientTransport, csrfToken: string) { return transport.request<{ ok: true }>("/auth/operator/logout", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrfToken } }); }

export function inspectRegistrationResume(transport: ClientTransport, input: RegistrationResumeProof) {
    return transport.post<RegistrationResumeDetails>("/auth/registration/resume/inspect", input);
  }

export function completeRegistrationResume(transport: ClientTransport, input: RegistrationResumeComplete) {
    return transport.post<RegistrationResumeCompleted>("/auth/registration/resume/complete", input);
  }
