import { bindNativeOrderDocumentAccounting } from "./native-order-document-accounting";
import { bindNativeDiscrepancyCreate } from "./native-order-discrepancy-create";
import { bindNativeOrderDiscrepancyReads } from "./native-order-discrepancy-reads";
import { bindNativePaymentIntentReads } from "./native-payment-intent-reads";
import { loginCurrent, loginEmailMatches } from "./login-unknown-recovery";
import { pinLogoutBody, logoutCurrent, type LogoutTarget } from "./session-logout-recovery";
import { sameRestoredOwner, type KnownWorkspaceOwner } from "./foreground-session-recovery";
import { workspaceEntryCode, workspaceEntryCurrent } from "./workspace-entry-recovery";
import { authEntryCode, authEntryElevation } from "./auth-entry-recovery";
import { createRegistrationResume, type ResumePath } from "./registration-resume";
import { createBuyerRegistration } from "./buyer-registration";
import { parseEmailVerificationInput, decodeEmailVerification, emailVerificationRejected, type EmailVerificationInput, type EmailVerificationFeedback } from "./email-verification";
import { parsePasswordResetInput, passwordResetAccepted, passwordResetRejected, type PasswordResetInput, type PasswordResetFeedback } from "./password-reset";
import { bindNativeCatalogMedia } from "./native-catalog-media";
import { bindNativePersonalProfile } from "./native-personal-profile";
import { bindNativeOwnSessions } from "./native-own-sessions";
import { bindNativeOrganizationProfile } from "./native-organization-profile";
import { bindNativeMfa } from "./native-mfa";
import { parseEmailEntryInput, emailEntryAccepted, emailEntryRejected, type EmailEntryKind, type EmailEntryFeedback, type EmailRegistrationInput } from "./email-entry";
import { bindNativeAttachmentImages } from "./native-attachment-images";
import { createNativeManualTransferPort } from "./native-manual-transfer";
import { bindNativeOrderDocumentArchiveReads } from "./native-order-document-archive";
import { bindNativeOrderInvoiceReads } from "./order-invoices";
import { bindNativePublishedReviewReads } from "./native-published-review-reads";
import { createNativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { createNativeSupportCommands } from "./native-support-commands";
import { createNativeCartCommands } from "./native-cart-commands";
import { createNativeSavedListCommands } from "./native-saved-list-commands";
import { createNativeConversationActions } from "./native-conversation-actions";
import { createNativeConversationMessages } from "./native-conversation-messages";
import { createNativeOrderCommentCommands } from "./native-order-comment-commands";
import type { MarketRequestMethod } from "./market-transport";
import { bindNativeConversationReads } from "./native-conversation-reads";
import type { z } from "zod";
import { authEmailSessionSchema, mfaStatusSchema } from "../../../packages/schemas/src/auth-api";
import { emailLoginSchema } from "../../../packages/schemas/src/commercial";
import { currentSessionSchema, workspaceChoicesSchema, workspaceContextSchema, workspaceSessionSchema, workspaceRefreshResponseSchema } from "../../../packages/schemas/src/workspace-session";
import { sessionLogoutResponseSchema } from "../../../packages/schemas/src/session-logout";
import type { WorkspaceContext } from "../../../packages/schemas/src/workspace-context";
import type { MarketSession } from "./read-controller";
import { bindMarketReads, createMarketTransport, MarketHttpError, type FetchTransport } from "./market-transport";
import { bindNativeBuyerWorkspaceReads } from "./native-buyer-workspace-reads";
import { createNativeBuyerReviewPort, platformReviewUuidProvider } from "./buyer-review-native-port";
import type { NativeUuidProvider } from "./native-uuid-source";

export type SessionIssue = "network" | "authentication" | "denied" | "throttled" | "contract" | "input";
export type SessionSnapshot = Readonly<{ phase: "checking" | "signed-out" | "working" | "mfa" | "choose" | "ready";
  canCheckLogin?: true; loginUncertain?: true; canContinueLogout?: true; canRetryLogout?: true; logoutUncertain?: true; canContinueSessionRestore?: true; workspaceEntry?: Readonly<{ kind: "known" | "unknown"; organizationName: string }>; workspaceEntryUncertain?: true; canContinueAuthEntry?: true; authEntryStep?: "mfa-status" | "choices"; challengeFeedback?: "unknown" | "rejected"; challengeUncertain?: true; mfaNotice?: "disabled"; sessionNotice?: "revoked"; emailEntry?: EmailEntryFeedback; passwordReset?: PasswordResetFeedback; passwordResetUncertain?: true; emailVerification?: EmailVerificationFeedback; emailVerificationUncertain?: true; canContinueEmailVerification?: true; choices: readonly WorkspaceContext[]; canLogout: boolean; canReloadChoices: boolean; accountName?: string; session?: MarketSession; issue?: SessionIssue }>;
type AuthSession = z.infer<typeof authEmailSessionSchema>;
type Credentials = Pick<AuthSession, "user" | "sessionId" | "accessToken" | "organizationIds" | "csrfToken"> & {
  activeOrganizationId: string | null; expiresAt: number; workspace?: "BUYER";
};
class SessionFailure extends Error { constructor(readonly issue: SessionIssue) { super(issue); } }
function decode<T>(schema: z.ZodType<T>, raw: unknown): T {
  // A native cookie flow must never fall back to a refresh secret in JSON.
  if (raw && typeof raw === "object" && "refreshToken" in raw) throw new SessionFailure("contract");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new SessionFailure("contract");
  return parsed.data;
}
function classify(error: unknown): SessionIssue {
  if (error instanceof SessionFailure) return error.issue;
  if (error instanceof MarketHttpError) return error.status === 429 ? "throttled" : error.status === 400 ? "input" : error.status === 401 ? "authentication" : error.status === 403 ? "denied" : "network";
  return "network";
}
let nextGeneration = 0;

/** Consumer of existing server sessions. Access/CSRF stay private in memory; HttpOnly cookies belong to Expo's native transport. */
export function createMarketSession(address: string, fetcher: FetchTransport, now: () => number = Date.now, reviewUuidProvider: NativeUuidProvider | undefined = platformReviewUuidProvider()) {
  const http = createMarketTransport(address, fetcher);
  let generation = ++nextGeneration;
  let credentials: Credentials | undefined;
  let catalogMediaBinding: ReturnType<typeof bindNativeCatalogMedia> | undefined;
  let personalProfileBinding: ReturnType<typeof bindNativePersonalProfile> | undefined;
  let ownSessionsBinding: ReturnType<typeof bindNativeOwnSessions> | undefined;
  let organizationProfileBinding: ReturnType<typeof bindNativeOrganizationProfile> | undefined;
  let mfaBinding: ReturnType<typeof bindNativeMfa> | undefined;
  let attachmentImageBinding: ReturnType<typeof bindNativeAttachmentImages> | undefined;
  let manualTransferBinding: ReturnType<typeof createNativeManualTransferPort> | undefined;
  let buyerWorkflowBinding: ReturnType<typeof createNativeBuyerWorkflowCommands> | undefined;
  let discrepancyCreateBinding: ReturnType<typeof bindNativeDiscrepancyCreate> | undefined;
  let supportBinding: ReturnType<typeof createNativeSupportCommands> | undefined;
  let cartBinding: ReturnType<typeof createNativeCartCommands> | undefined;
  let savedListBinding: ReturnType<typeof createNativeSavedListCommands> | undefined;
  let conversationActionBinding: ReturnType<typeof createNativeConversationActions> | undefined;
  let conversationMessageBinding: ReturnType<typeof createNativeConversationMessages> | undefined;
  let commentBinding: ReturnType<typeof createNativeOrderCommentCommands> | undefined;
  let reviewBinding: ReturnType<typeof createNativeBuyerReviewPort> | undefined;
  let snapshot: SessionSnapshot = { phase: "checking", choices: [], canLogout: false, canReloadChoices: false };
  let busy = false;
  let pendingLogin: { email: string } | undefined;
  let loginUncertain = false;
  let logoutRecovery: LogoutTarget & { body?: NonNullable<ReturnType<typeof pinLogoutBody>>; retryAllowed: boolean } | undefined;
  let logoutUncertain = false;
  let resumeOwner: KnownWorkspaceOwner | undefined;
  let workspaceEntry: { kind: "known" | "unknown"; userId: string; organizationId: string; organizationName: string; destinationSessionId?: string } | undefined;
  let workspaceEntryUncertain = false;
  let authEntry: { sessionId: string; step: "mfa-status" | "choices" } | undefined;
  let challengeFeedback: "unknown" | "rejected" | undefined;
  let challengeUncertain = false;
  const entryChallenges = new Set<string>();
  const entryCurrent = (expected?: SessionSnapshot) => !expected || expected === snapshot;
  const clearAuthEntry = () => { authEntry = undefined; challengeFeedback = undefined; challengeUncertain = false; entryChallenges.clear(); };
  let passwordResetUncertain = false;
  const consumedPasswordResetInputs = new WeakSet<object>();
  let emailVerification: EmailVerificationFeedback | undefined;
  let emailVerificationUncertain = false;
  let verifiedEmailSessionId: string | undefined;
  const consumedEmailVerificationInputs = new WeakSet<object>();
  let initialization: Promise<void> | undefined;
  let refreshing: { generation: number; promise: Promise<string> } | undefined;
  const listeners = new Set<() => void>();
  const buyerRegistration = createBuyerRegistration({ uuidProvider: reviewUuidProvider, available: () => !busy && !credentials && !pendingLogin && snapshot.phase === "signed-out", post: submitAnonymousOnboarding });
  const registrationResume = createRegistrationResume({ available: () => !busy && !credentials && !pendingLogin && snapshot.phase === "signed-out", post: submitAnonymousOnboarding });
  const publish = (phase: SessionSnapshot["phase"], extra: Partial<SessionSnapshot> = {}) => {
    snapshot = { phase, choices: [], ...(pendingLogin && phase === "signed-out" ? { canCheckLogin: true as const } : {}), ...(loginUncertain ? { loginUncertain: true as const } : {}), ...(logoutRecovery && phase === "signed-out" ? { canContinueLogout: true as const, ...(logoutRecovery.body && logoutRecovery.retryAllowed ? { canRetryLogout: true as const } : {}) } : {}), ...(logoutUncertain ? { logoutUncertain: true as const } : {}), ...(resumeOwner && phase === "signed-out" ? { canContinueSessionRestore: true as const } : {}), ...(workspaceEntry && phase === "choose" ? { workspaceEntry: Object.freeze({ kind: workspaceEntry.kind, organizationName: workspaceEntry.organizationName }) } : {}), ...(workspaceEntryUncertain ? { workspaceEntryUncertain: true as const } : {}), ...(authEntry && credentials?.sessionId === authEntry.sessionId && (phase === "signed-out" || phase === "mfa") ? { canContinueAuthEntry: true as const, authEntryStep: authEntry.step } : {}), ...(challengeFeedback ? { challengeFeedback } : {}), ...(challengeUncertain ? { challengeUncertain: true as const } : {}), canLogout: !!credentials, ...(emailVerification ? { emailVerification } : {}), ...(emailVerificationUncertain ? { emailVerificationUncertain: true as const } : {}), ...(phase === "signed-out" && credentials && verifiedEmailSessionId === credentials.sessionId && emailVerification?.phase === "verified" ? { canContinueEmailVerification: true as const } : {}), ...(passwordResetUncertain ? { passwordResetUncertain: true as const } : {}),
      canReloadChoices: phase === "choose" && !!(credentials?.activeOrganizationId ?? credentials?.organizationIds[0]),
      accountName: credentials?.user.displayName, ...extra };
    listeners.forEach(listener => listener());
  };
  function assertCurrent(ticket: number) { if (ticket !== generation) throw new SessionFailure("authentication"); }
  function invalidate(issue?: SessionIssue) { discrepancyCreateBinding?.close(); discrepancyCreateBinding = undefined; pendingLogin = undefined; loginUncertain = false; logoutRecovery = undefined; logoutUncertain = false; resumeOwner = undefined; workspaceEntry = undefined; workspaceEntryUncertain = false; clearAuthEntry(); buyerRegistration.reset(); registrationResume.reset(); emailVerification = undefined; verifiedEmailSessionId = undefined; reviewBinding?.close(); reviewBinding = undefined; commentBinding?.close(); commentBinding = undefined; conversationMessageBinding?.close(); conversationMessageBinding = undefined; conversationActionBinding?.close(); conversationActionBinding = undefined; savedListBinding?.close(); savedListBinding = undefined; cartBinding?.close(); cartBinding = undefined; supportBinding?.close(); supportBinding = undefined; buyerWorkflowBinding?.close(); buyerWorkflowBinding = undefined; manualTransferBinding?.close(); manualTransferBinding = undefined; attachmentImageBinding?.close(); attachmentImageBinding = undefined; mfaBinding?.close(); mfaBinding = undefined; ownSessionsBinding?.close(); ownSessionsBinding = undefined; personalProfileBinding?.close(); personalProfileBinding = undefined; catalogMediaBinding?.close(); catalogMediaBinding = undefined; organizationProfileBinding?.close(); organizationProfileBinding = undefined; generation = ++nextGeneration; http.cancelAll(); credentials = undefined; refreshing = undefined; busy = false; publish("signed-out", { issue }); }
  async function request(ticket: number, path: string, options?: Parameters<typeof http.request>[1]) {
    assertCurrent(ticket); const raw = await http.request(path, options); assertCurrent(ticket); return raw;
  }
  const capture = (value: AuthSession | z.infer<typeof currentSessionSchema> | z.infer<typeof workspaceSessionSchema>, workspace?: "BUYER"): Credentials => ({
    user: value.user, sessionId: value.sessionId, accessToken: value.accessToken, organizationIds: value.organizationIds,
    activeOrganizationId: value.activeOrganizationId, csrfToken: value.csrfToken,
    expiresAt: now() + value.accessTokenExpiresIn * 1000, workspace,
  });
  async function context(ticket: number, token: string, organizationId: string) {
    const value = decode(workspaceContextSchema, await request(ticket, "/auth/workspace-context", { token, organizationId }));
    if (value.organizationId !== organizationId || !value.capabilities.includes("BUYER")) throw new SessionFailure("denied");
    return value;
  }
  async function token(ticket: number, force = false): Promise<string> {
    assertCurrent(ticket); const captured = credentials;
    if (!captured) throw new SessionFailure("authentication");
    if (!force && captured.expiresAt > now() + 30_000) return captured.accessToken;
    if (refreshing?.generation === ticket) return refreshing.promise;
    const promise = (async () => {
      try {
        const refreshed = decode(workspaceRefreshResponseSchema, await request(ticket, "/auth/refresh", { method: "POST", cookies: true, csrf: captured.csrfToken,
          body: { ...(captured.workspace ? { workspace: captured.workspace } : {}), expectedSessionId: captured.sessionId } }));
        if (refreshed.sessionId !== captured.sessionId || refreshed.activeOrganizationId !== captured.activeOrganizationId || !refreshed.organizationIds.includes(refreshed.activeOrganizationId)) throw new SessionFailure("authentication");
        if (captured.workspace) await context(ticket, refreshed.accessToken, refreshed.activeOrganizationId);
        assertCurrent(ticket); credentials = { ...captured, ...refreshed, expiresAt: now() + refreshed.accessTokenExpiresIn * 1000 };
        return refreshed.accessToken;
      } catch (error) {
        if (ticket === generation && ["authentication", "denied", "contract"].includes(classify(error))) invalidate(classify(error));
        throw error;
      }
    })().finally(() => { if (refreshing?.generation === ticket) refreshing = undefined; });
    refreshing = { generation: ticket, promise }; return promise;
  }
  function ready(ticket: number, value: WorkspaceContext) {
    assertCurrent(ticket); const captured = credentials;
    if (!captured || captured.workspace !== "BUYER" || value.organizationId !== captured.activeOrganizationId) throw new SessionFailure("authentication");
    const scope: MarketSession["scope"] = Object.freeze({ product: "market", environment: http.apiUrl, userId: captured.user.id, organizationId: value.organizationId, generation: ticket });
    const read = async (path: string) => {
      let accessToken = await token(ticket);
      try { return await request(ticket, path, { token: accessToken }); }
      catch (error) {
        if (!(error instanceof MarketHttpError) || error.status !== 401) throw error;
        accessToken = await token(ticket, credentials?.accessToken === accessToken);
        try { return await request(ticket, path, { token: accessToken }); }
        catch (retryError) { if (ticket === generation && retryError instanceof MarketHttpError && retryError.status === 401) invalidate("authentication"); throw retryError; }
      }
    };
    const isCurrentScope = () => ticket === generation && credentials?.workspace === "BUYER" && credentials?.user.id === scope.userId && credentials?.activeOrganizationId === scope.organizationId;
    const readAttachment = async (path: string, expected: Parameters<typeof http.attachmentBinary>[1], signal: AbortSignal) => {
      const execute = async (accessToken: string) => { assertCurrent(ticket); const bytes = await http.attachmentBinary(path, expected, { token: accessToken, signal }); assertCurrent(ticket); return bytes; };
      let accessToken = await token(ticket);
      try { return await execute(accessToken); }
      catch (error) {
        if (!(error instanceof MarketHttpError) || error.status !== 401 || signal.aborted) throw error;
        accessToken = await token(ticket, credentials?.accessToken === accessToken);
        try { return await execute(accessToken); }
        catch (retryError) { if (ticket === generation && retryError instanceof MarketHttpError && retryError.status === 401) invalidate("authentication"); throw retryError; }
      }
    };
    attachmentImageBinding?.close();
    attachmentImageBinding = bindNativeAttachmentImages(scope, readAttachment, isCurrentScope);
    const mutateOnce = async (method: Exclude<MarketRequestMethod, "GET">, path: string, body?: Readonly<object>) => {
      const accessToken = await token(ticket);
      try { return await request(ticket, path, { method, body, token: accessToken, organizationId: scope.organizationId }); }
      catch (error) { if (ticket === generation && error instanceof MarketHttpError && error.status === 401) invalidate("authentication"); throw error; }
    };
    catalogMediaBinding?.close();
    catalogMediaBinding = bindNativeCatalogMedia(scope, isCurrentScope);
    personalProfileBinding?.close();
    personalProfileBinding = bindNativePersonalProfile(scope, read, async (path, body) => { const accessToken = await token(ticket); return request(ticket, path, { method: "POST", token: accessToken, organizationId: scope.organizationId, body }); }, isCurrentScope, profile => {
      assertCurrent(ticket); if (!isCurrentScope() || !credentials || credentials.sessionId !== captured.sessionId || profile.id !== credentials.user.id) throw new SessionFailure("authentication");
      credentials = { ...credentials, user: { ...credentials.user, displayName: profile.displayName } };
      if (snapshot.phase === "ready" && snapshot.session) publish("ready", { session: snapshot.session });
    });
    ownSessionsBinding?.close();
    ownSessionsBinding = bindNativeOwnSessions(scope, read, (path, body) => mutateOnce("POST", path, body), isCurrentScope, captured.sessionId, () => { assertCurrent(ticket); if (!isCurrentScope() || credentials?.sessionId !== captured.sessionId) throw new SessionFailure("authentication"); invalidate(); publish("signed-out", { sessionNotice: "revoked" }); });
    organizationProfileBinding?.close();
    organizationProfileBinding = bindNativeOrganizationProfile(scope, read, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    mfaBinding?.close();
    mfaBinding = bindNativeMfa(scope, read, async (path, body) => {
      const accessToken = await token(ticket);
      // Source MFA code validation also returns401. Do not replay POST or infer whether code/session failed.
      return request(ticket, path, { method: "POST", token: accessToken, organizationId: scope.organizationId, body });
    }, isCurrentScope, { email: captured.user.email,
      applyElevation(value) { assertCurrent(ticket); if (!isCurrentScope() || !credentials || credentials.sessionId !== captured.sessionId || value.activeOrganizationId !== scope.organizationId) throw new SessionFailure("authentication"); credentials = { ...credentials, accessToken: value.accessToken, expiresAt: now() + value.accessTokenExpiresIn * 1000 }; },
      onDisabled() { assertCurrent(ticket); if (!isCurrentScope()) throw new SessionFailure("authentication"); invalidate(); publish("signed-out", { mfaNotice: "disabled" }); },
    });
    reviewBinding?.close();
    reviewBinding = createNativeBuyerReviewPort(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope, { writeOnce: (path, body) => mutateOnce("PATCH", path, body), read });
    commentBinding?.close();
    commentBinding = createNativeOrderCommentCommands(scope, read, mutateOnce, reviewUuidProvider, isCurrentScope);
    conversationMessageBinding?.close();
    conversationMessageBinding = createNativeConversationMessages(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    conversationActionBinding?.close();
    conversationActionBinding = createNativeConversationActions(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    savedListBinding?.close();
    savedListBinding = createNativeSavedListCommands(scope, read, mutateOnce, isCurrentScope);
    manualTransferBinding?.close();
    manualTransferBinding = createNativeManualTransferPort(scope, read, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    buyerWorkflowBinding?.close();
    buyerWorkflowBinding = createNativeBuyerWorkflowCommands(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    supportBinding?.close();
    discrepancyCreateBinding?.close();
    discrepancyCreateBinding = bindNativeDiscrepancyCreate(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    supportBinding = createNativeSupportCommands(scope, (path, body) => mutateOnce("POST", path, body), reviewUuidProvider, isCurrentScope);
    cartBinding?.close();
    cartBinding = createNativeCartCommands(scope, mutateOnce, reviewUuidProvider, isCurrentScope);
    const client = {
      buyerReviewCommandPort: reviewBinding.port,
      nativeOrderCommentCommands: commentBinding.port,
      nativeConversationMessages: conversationMessageBinding.port,
      nativeConversationActions: conversationActionBinding.port,
      nativeSavedListCommands: savedListBinding.port,
      nativeCartCommands: cartBinding.port,
      nativeSupportCommands: supportBinding.port,
      nativeDiscrepancyCreate: discrepancyCreateBinding.port,
      nativeBuyerWorkflowCommands: buyerWorkflowBinding.port,
      nativeManualTransfer: manualTransferBinding.port, nativeOrganizationProfile: organizationProfileBinding.port, nativeOwnSessions: ownSessionsBinding.port, nativePersonalProfile: personalProfileBinding.port, nativeCatalogMedia: catalogMediaBinding.port, nativeCatalogFilterOptions: true as const,
      ...bindNativeConversationReads(scope, read, () => ticket === generation && credentials?.workspace === "BUYER" && credentials?.user.id === scope.userId && credentials?.activeOrganizationId === scope.organizationId),
      ...bindMarketReads(read, value.organizationId), nativeAttachmentImages: attachmentImageBinding.port, nativeMfa: mfaBinding.port,
      ...bindNativePublishedReviewReads(scope, read, isCurrentScope),
      ...bindNativePaymentIntentReads(scope, read, isCurrentScope),
      ...bindNativeOrderInvoiceReads(scope, read, isCurrentScope),
      ...bindNativeOrderDocumentArchiveReads(scope, read, isCurrentScope),
      ...bindNativeOrderDocumentAccounting(scope, read, (path, body) => mutateOnce("PATCH", path, body), isCurrentScope),
      ...bindNativeOrderDiscrepancyReads(scope, read, isCurrentScope),
      ...bindNativeBuyerWorkspaceReads(scope, read, () => ticket === generation && credentials?.workspace === "BUYER" && credentials?.user.id === scope.userId && credentials?.activeOrganizationId === scope.organizationId),
    };
    publish("ready", { session: { scope, client, organizationName: value.organizationDisplayName } });
  }
  async function transaction(work: (ticket: number) => Promise<void>, fallback: "signed-out" | "mfa" | "choose" = "signed-out") {
    if (busy) return;
    busy = true; reviewBinding?.close(); reviewBinding = undefined; commentBinding?.close(); commentBinding = undefined; conversationMessageBinding?.close(); conversationMessageBinding = undefined; conversationActionBinding?.close(); conversationActionBinding = undefined; savedListBinding?.close(); savedListBinding = undefined; cartBinding?.close(); cartBinding = undefined; supportBinding?.close(); supportBinding = undefined; buyerWorkflowBinding?.close(); buyerWorkflowBinding = undefined; manualTransferBinding?.close(); manualTransferBinding = undefined; attachmentImageBinding?.close(); attachmentImageBinding = undefined; mfaBinding?.close(); mfaBinding = undefined; ownSessionsBinding?.close(); ownSessionsBinding = undefined; personalProfileBinding?.close(); personalProfileBinding = undefined; catalogMediaBinding?.close(); catalogMediaBinding = undefined; organizationProfileBinding?.close(); organizationProfileBinding = undefined; generation = ++nextGeneration; http.cancelAll(); const ticket = generation; const previous = snapshot;
    publish("working");
    try { await work(ticket); }
    catch (error) {
      if (ticket === generation) {
        publish(fallback, { choices: previous.choices, issue: classify(error) });
      }
    }
    finally { if (ticket === generation) busy = false; }
  }
  async function choices(ticket: number) {
    const current = credentials;
    if (!current) throw new SessionFailure("authentication");
    const org = current.activeOrganizationId ?? current.organizationIds[0];
    if (!org) { publish("choose"); return; }
    const values = decode(workspaceChoicesSchema, await request(ticket, "/auth/workspaces", { token: await token(ticket), organizationId: org }));
    publish("choose", { choices: values.filter(value => value.capabilities.includes("BUYER") && current.organizationIds.includes(value.organizationId)) });
  }
  async function restore(expected?: SessionSnapshot) {
    if (!entryCurrent(expected)) return;
    if (logoutRecovery) return continueLogout(expected);
    if (pendingLogin) return checkCurrentLogin(expected);
    if (workspaceEntry) return continueWorkspaceEntry(expected);
    if (snapshot.phase !== "checking" && snapshot.phase !== "signed-out" && snapshot.phase !== "ready") return;
    const previous = snapshot.session?.scope;
    if (previous && credentials) resumeOwner = Object.freeze({ userId: previous.userId, organizationId: previous.organizationId, sessionId: credentials.sessionId });
    return transaction(async ticket => {
      clearAuthEntry(); if (!resumeOwner) credentials = undefined;
      emailVerification = undefined; verifiedEmailSessionId = undefined; buyerRegistration.reset(); registrationResume.reset();
      const raw = await request(ticket, "/auth/current?workspace=BUYER", { cookies: true });
      if (raw === null) { if (resumeOwner) throw new SessionFailure("authentication"); publish("signed-out"); return; }
      const value = decode(currentSessionSchema, raw);
      if (resumeOwner && !sameRestoredOwner(value, resumeOwner)) throw new SessionFailure("authentication");
      const workspace = value.workspaces.find(item => item.organizationId === value.activeOrganizationId && item.capabilities.includes("BUYER"));
      if (!workspace || !value.organizationIds.includes(workspace.organizationId)) throw new SessionFailure("denied");
      credentials = capture(value, "BUYER");
      const verified = await context(ticket, value.accessToken, workspace.organizationId);
      resumeOwner = undefined; ready(ticket, verified);
    });
  }
  async function submitEmailEntry(kind: EmailEntryKind, raw: unknown) {
    // These source requests must never replace or reuse an authenticated session.
    if (busy || pendingLogin || snapshot.phase !== "signed-out" || credentials) return;
    return transaction(async ticket => {
      let email: string | undefined;
      try { const input = parseEmailEntryInput(kind, raw); email = input.email; buyerRegistration.reset(); registrationResume.reset();
        const body = await request(ticket, kind === "register" ? "/auth/register" : "/auth/password/forgot", { method: "POST", body: input });
        const emailEntry = emailEntryAccepted(kind, email, body); assertCurrent(ticket); publish("signed-out", { emailEntry });
      } catch (error) { assertCurrent(ticket); publish("signed-out", { emailEntry: emailEntryRejected(kind, email, error) }); }
    });
  }
  async function completePasswordReset(raw: PasswordResetInput) {
    if (busy || pendingLogin || snapshot.phase !== "signed-out" || credentials || snapshot.passwordReset?.phase === "completed" || snapshot.passwordReset?.phase === "unknown" || raw && typeof raw === "object" && consumedPasswordResetInputs.has(raw)) return;
    return transaction(async ticket => {
      try {
        const input = parsePasswordResetInput(raw); assertCurrent(ticket); buyerRegistration.reset(); registrationResume.reset();
        consumedPasswordResetInputs.add(raw);
        const reply = await request(ticket, "/auth/password/reset", { method: "POST", body: input });
        const passwordReset = passwordResetAccepted(reply); assertCurrent(ticket); publish("signed-out", { passwordReset });
      } catch (error) {
        assertCurrent(ticket); const passwordReset = passwordResetRejected(error);
        if (passwordReset.phase === "unknown") passwordResetUncertain = true;
        publish("signed-out", { passwordReset });
      }
    });
  }
  function checkCurrentLogin(expected?: SessionSnapshot) {
    if (!entryCurrent(expected) || busy || credentials || snapshot.phase !== "signed-out" || !pendingLogin) return Promise.resolve();
    return transaction(async ticket => {
      const pending = pendingLogin;
      if (!pending) throw new SessionFailure("authentication");
      const value = loginCurrent(await request(ticket, "/auth/current", { cookies: true }), pending.email);
      if (!value) throw new SessionFailure("authentication");
      credentials = capture(value); pendingLogin = undefined;
      authEntry = { sessionId: value.sessionId, step: "mfa-status" }; await finishAuthEntry(ticket);
    });
  }
  async function executeLogout(ticket: number) {
    const attempt = logoutRecovery, body = attempt?.body;
    if (!attempt || !body || !credentials || credentials.sessionId !== attempt.sessionId || credentials.user.id !== attempt.userId) throw new SessionFailure("authentication");
    try {
      const receipt = decode(sessionLogoutResponseSchema, await request(ticket, "/auth/session-logout", { method: "POST", body }));
      if (receipt.sessionId !== attempt.sessionId) throw new SessionFailure("contract");
      invalidate();
    } catch (error) {
      assertCurrent(ticket); logoutUncertain = true;
      if (error instanceof MarketHttpError && [400,401,403].includes(error.status)) attempt.retryAllowed = false;
      throw error;
    }
  }
  function retryLogout(expected?: SessionSnapshot) {
    if (!entryCurrent(expected) || busy || snapshot.phase !== "signed-out" || !logoutRecovery?.body || !logoutRecovery.retryAllowed) return Promise.resolve();
    return transaction(executeLogout);
  }
  function continueLogout(expected?: SessionSnapshot) {
    if (!entryCurrent(expected) || busy || snapshot.phase !== "signed-out" || !logoutRecovery) return Promise.resolve();
    return transaction(async ticket => {
      const target = logoutRecovery;
      if (!target) throw new SessionFailure("authentication");
      const raw = await request(ticket, target.workspace ? "/auth/current?workspace=BUYER" : "/auth/current", { cookies: true });
      if (raw === null) { const history = logoutUncertain; invalidate(); logoutUncertain = history; publish("signed-out"); return; }
      const current = logoutCurrent(raw, target);
      if (!current) throw new SessionFailure("authentication");
      credentials = capture(current, target.workspace);
      if (target.workspace) {
        const verified = await context(ticket, current.accessToken, current.activeOrganizationId);
        logoutRecovery = undefined; ready(ticket, verified);
      } else {
        logoutRecovery = undefined; authEntry = { sessionId: current.sessionId, step: "mfa-status" }; await finishAuthEntry(ticket);
      }
    });
  }
  async function finishWorkspaceEntry(ticket: number) {
    assertCurrent(ticket); let entry = workspaceEntry;
    if (!entry) throw new SessionFailure("authentication");
    if (entry.kind === "unknown") {
      const current = workspaceEntryCurrent(await request(ticket, "/auth/current?workspace=BUYER", { cookies: true }), entry.userId, entry.organizationId);
      if (!current) throw new SessionFailure("authentication");
      assertCurrent(ticket); credentials = capture(current, "BUYER");
      entry = { ...entry, kind: "known", destinationSessionId: current.sessionId }; workspaceEntry = entry;
    }
    if (!credentials || credentials.sessionId !== entry.destinationSessionId || credentials.user.id !== entry.userId || credentials.activeOrganizationId !== entry.organizationId || credentials.workspace !== "BUYER") throw new SessionFailure("authentication");
    const verified = await context(ticket, await token(ticket), entry.organizationId);
    workspaceEntry = undefined; ready(ticket, verified);
  }
  function continueWorkspaceEntry(expected?: SessionSnapshot) {
    if (!entryCurrent(expected) || !workspaceEntry || snapshot.phase !== "choose" || busy) return Promise.resolve();
    return transaction(finishWorkspaceEntry, "choose");
  }
  async function finishAuthEntry(ticket: number) {
    assertCurrent(ticket); const current = credentials, entry = authEntry;
    if (!current || !entry || entry.sessionId !== current.sessionId) throw new SessionFailure("authentication");
    if (entry.step === "mfa-status") {
      const org = current.activeOrganizationId ?? current.organizationIds[0];
      if (org) {
        const mfa = decode(mfaStatusSchema, await request(ticket, "/identity/mfa", { token: await token(ticket), organizationId: org }));
        if (mfa.enabled !== (mfa.status === "ACTIVE")) throw new SessionFailure("contract");
        if (mfa.enabled) { authEntry = undefined; publish("mfa"); return; }
      }
      entry.step = "choices";
    }
    await choices(ticket); authEntry = undefined;
  }
  async function finishVerifiedEmailSession(ticket: number) {
    assertCurrent(ticket); const current = credentials;
    if (!current || current.sessionId !== verifiedEmailSessionId || emailVerification?.phase !== "verified") throw new SessionFailure("authentication");
    const org = current.activeOrganizationId ?? current.organizationIds[0];
    if (org) {
      const mfa = decode(mfaStatusSchema, await request(ticket, "/identity/mfa", { token: await token(ticket), organizationId: org }));
      if (mfa.enabled !== (mfa.status === "ACTIVE")) throw new SessionFailure("contract");
      if (mfa.enabled) { publish("mfa"); return; }
    }
    await choices(ticket);
  }
  async function verifyEmail(raw: EmailVerificationInput) {
    if (busy || pendingLogin || snapshot.phase !== "signed-out" || credentials || emailVerification?.phase === "unknown" || emailVerification?.phase === "verified" || raw && typeof raw === "object" && consumedEmailVerificationInputs.has(raw)) return;
    return transaction(async ticket => {
      try {
        const input = parseEmailVerificationInput(raw); assertCurrent(ticket); buyerRegistration.reset(); registrationResume.reset(); consumedEmailVerificationInputs.add(raw);
        const value = decodeEmailVerification(await request(ticket, "/auth/email/verify", { method: "POST", cookies: true, body: input }));
        assertCurrent(ticket); credentials = capture(value); verifiedEmailSessionId = value.sessionId; emailVerification = Object.freeze({ phase: "verified" });
        await finishVerifiedEmailSession(ticket);
      } catch (error) {
        assertCurrent(ticket);
        if (credentials && credentials.sessionId === verifiedEmailSessionId && emailVerification?.phase === "verified") { publish("signed-out", { issue: classify(error) }); return; }
        emailVerification = emailVerificationRejected(error); if (emailVerification.phase === "unknown") emailVerificationUncertain = true;
        publish("signed-out");
      }
    });
  }
  async function submitAnonymousOnboarding(path: "/onboarding/registrations" | "/auth/register" | ResumePath, body: unknown): Promise<unknown> {
    if (busy || pendingLogin || credentials || snapshot.phase !== "signed-out") throw new SessionFailure("authentication");
    if (path.startsWith("/auth/registration/resume/")) buyerRegistration.reset(); else registrationResume.reset();
    let reply: unknown, failure: unknown, failed = false, settled = false;
    await transaction(async ticket => {
      try { reply = await request(ticket, path, { method: "POST", body }); settled = true; }
      catch (error) { failure = error; failed = true; settled = true; }
      if (ticket === generation) publish("signed-out");
    });
    if (!settled) throw new SessionFailure("authentication"); if (failed) throw failure; return reply;
  }
  return {
    apiUrl: http.apiUrl,
    buyerRegistration, registrationResume,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); queueMicrotask(() => { if (!listeners.size) { invalidate(); initialization = undefined; } }); };
    },
    start() { initialization ??= restore(); return initialization; },
    restore, continueWorkspaceEntry, continueLogout, retryLogout, checkCurrentLogin,
    prepareNewLogin(expected?: SessionSnapshot) { if (!entryCurrent(expected) || busy || credentials || !pendingLogin || snapshot.phase !== "signed-out") return; pendingLogin = undefined; publish("signed-out"); },
    reloadOrganizations(expected?: SessionSnapshot) {
      // Re-read only the existing authenticated choices route with a known selector.
      // No selectorless membership discovery or synthetic organization is introduced.
      if (!entryCurrent(expected) || workspaceEntry || !snapshot.canReloadChoices) return Promise.resolve();
      return transaction(choices, "choose");
    },
    requireLogin: () => invalidate("authentication"),
    verifyEmail,
    continueAuthEntry(expected?: SessionSnapshot) { if (!entryCurrent(expected) || !snapshot.canContinueAuthEntry) return Promise.resolve(); return transaction(finishAuthEntry, snapshot.phase === "mfa" ? "mfa" : "signed-out"); },
    continueEmailVerification() { if (!snapshot.canContinueEmailVerification) return Promise.resolve(); return transaction(finishVerifiedEmailSession); },
    completePasswordReset,
    registerEmail: (input: EmailRegistrationInput) => submitEmailEntry("register", input),
    requestPasswordReset: (email: string) => submitEmailEntry("forgot", { email }),
    dismissEmailEntry() { if (!busy && snapshot.phase === "signed-out" && !credentials && !pendingLogin) { emailVerification = undefined; verifiedEmailSessionId = undefined; publish("signed-out"); } },
    async login(email: string, password: string, expected?: SessionSnapshot) {
      if (!entryCurrent(expected) || busy || pendingLogin || credentials || (snapshot.phase !== "signed-out" && !(snapshot.phase === "checking" && !initialization))) return;
      return transaction(async ticket => {
        clearAuthEntry(); emailVerification = undefined; verifiedEmailSessionId = undefined; buyerRegistration.reset(); registrationResume.reset();
        const input = emailLoginSchema.safeParse({ email: email.trim(), password });
        if (!input.success) throw new SessionFailure("input");
        try {
          const value = decode(authEmailSessionSchema, await request(ticket, "/auth/login", { method: "POST", cookies: true, body: input.data }));
          if (!loginEmailMatches(value.user.email, input.data.email)) throw new SessionFailure("contract");
          credentials = capture(value);
        } catch (error) {
          assertCurrent(ticket);
          if (!(error instanceof MarketHttpError && [400,401,429].includes(error.status))) { pendingLogin = { email: input.data.email }; loginUncertain = true; }
          throw error;
        }
        authEntry = { sessionId: credentials.sessionId, step: "mfa-status" };
        await finishAuthEntry(ticket);
      });
    },
    async challenge(code: string, expected?: SessionSnapshot) {
      if (!entryCurrent(expected) || busy || snapshot.phase !== "mfa" || authEntry) return;
      const input = authEntryCode(code);
      if (!input) { publish("mfa", { issue: "input" }); return; }
      return transaction(async ticket => {
        const current = credentials, org = current?.activeOrganizationId ?? current?.organizationIds[0];
        if (!current || !org) throw new SessionFailure("input");
        let dispatched = false, acknowledged = false;
        try {
          const accessToken = await token(ticket); assertCurrent(ticket);
          dispatched = true; challengeFeedback = undefined;
          const raw = await request(ticket, "/identity/mfa/challenge", { method: "POST", token: accessToken, organizationId: org, body: { code: input } });
          const value = authEntryElevation(raw, input, org, entryChallenges);
          if (!value) throw new SessionFailure("contract");
          assertCurrent(ticket);
          if (!credentials || credentials.sessionId !== current.sessionId || credentials.user.id !== current.user.id) throw new SessionFailure("authentication");
          entryChallenges.add(value.factor.challengeId);
          // token() may rotate CSRF: merge the latest credentials, not the pre-refresh capture.
          credentials = { ...credentials, accessToken: value.accessToken, activeOrganizationId: org, expiresAt: now() + value.accessTokenExpiresIn * 1000 };
          acknowledged = true; authEntry = { sessionId: credentials.sessionId, step: "choices" };
          await finishAuthEntry(ticket);
        } catch (error) {
          assertCurrent(ticket);
          if (dispatched && !acknowledged) {
            challengeFeedback = error instanceof MarketHttpError && (error.status === 400 || error.status === 429) ? "rejected" : "unknown";
            if (challengeFeedback === "unknown") challengeUncertain = true;
          }
          throw error;
        }
      }, "mfa");
    },
    async selectOrganization(id: string, expected?: SessionSnapshot) {
      if (!entryCurrent(expected) || workspaceEntry || snapshot.phase !== "choose") return;
      const selected = snapshot.choices.find(item => item.organizationId === id);
      return transaction(async ticket => {
        const current = credentials;
        if (!selected || !current || !current.organizationIds.includes(id)) throw new SessionFailure("denied");
        const accessToken = await token(ticket);
        await context(ticket, accessToken, id);
        const body = workspaceEntryCode(await request(ticket, "/auth/handoff", { method: "POST", token: accessToken, organizationId: id, body: { capability: "BUYER" } }), id, now());
        if (!body) throw new SessionFailure("contract");
        workspaceEntry = { kind: "unknown", userId: current.user.id, organizationId: id, organizationName: selected.organizationDisplayName };
        let exchanged: z.infer<typeof workspaceSessionSchema>;
        try {
          exchanged = decode(workspaceSessionSchema, await request(ticket, "/auth/handoff/exchange", { method: "POST", cookies: true, body }));
          if (exchanged.user.id !== current.user.id || exchanged.organizationId !== id || exchanged.activeOrganizationId !== id || exchanged.capability !== "BUYER" || !exchanged.organizationIds.includes(id)) throw new SessionFailure("contract");
        } catch (error) { assertCurrent(ticket); workspaceEntryUncertain = true; throw error; }
        credentials = capture(exchanged, "BUYER");
        workspaceEntry = { ...workspaceEntry, kind: "known", destinationSessionId: exchanged.sessionId };
        await finishWorkspaceEntry(ticket);
      }, "choose");
    },
    async logout(expected?: SessionSnapshot) {
      if (!entryCurrent(expected) || busy || logoutRecovery || !credentials) return;
      const expectedSessionId = credentials.sessionId;
      if (refreshing) await refreshing.promise.catch(() => undefined);
      if (!entryCurrent(expected) || credentials?.sessionId !== expectedSessionId) return;
      resumeOwner = undefined; workspaceEntry = undefined; clearAuthEntry();
      logoutRecovery = { sessionId: credentials.sessionId, userId: credentials.user.id, activeOrganizationId: credentials.activeOrganizationId, workspace: credentials.workspace, retryAllowed: true };
      return transaction(async ticket => {
        const accessToken = await token(ticket), attempt = logoutRecovery;
        if (!attempt) throw new SessionFailure("authentication");
        const body = pinLogoutBody(attempt.sessionId, accessToken);
        if (!body) throw new SessionFailure("contract");
        attempt.body = body; await executeLogout(ticket);
      });
    },
  };
}
export type MarketSessionController = ReturnType<typeof createMarketSession>;
