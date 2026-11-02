import { unknownLoginCopy } from "./login-unknown-recovery";
import { logoutRecoveryCopy } from "./session-logout-recovery";
import { foregroundSessionCopy } from "./foreground-session-recovery";
import { workspaceEntryCopy } from "./workspace-entry-recovery";
import { authEntryCopy } from "./auth-entry-recovery";
import { RegistrationResumeUi, registrationResumeCopy } from "./RegistrationResumeUi";
import { BuyerRegistrationUi, buyerRegistrationCopy } from "./BuyerRegistrationUi";
import { EmailVerificationUi, emailVerificationCopy } from "./EmailVerificationUi";
import { PasswordResetUi, passwordResetCopy } from "./PasswordResetUi";
import { NativePersonalProfileLauncher } from "./NativePersonalProfileUi";
import { NativeSessionsLauncher, ownSessionsCopy } from "./NativeSessionsUi";
import { NativeMfaLauncher, mfaCopy } from "./NativeMfaUi";
import { EmailEntryUi, emailEntryCopy } from "./EmailEntryUi";
import type { EmailEntryKind } from "./email-entry";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppState, ScrollView, StyleSheet, View } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import App from "../App";
import type { Locale } from "./format-wire";
import { createMarketSession, type MarketSessionController, type SessionSnapshot } from "./market-session";
import { normalizeApiUrl, type FetchTransport } from "./market-transport";
import { sessionCopy } from "./session-copy";
import { Button, FormInput, Loading, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
import type { NativeUuidProvider } from "./native-uuid-source";

const nativeFetch: FetchTransport = (url, init) => expoFetch(url, init);
export default function NativeMarketApp({ initialApiUrl = process.env.EXPO_PUBLIC_MARKET_API_URL, fetcher = nativeFetch, reviewUuidProvider }: { initialApiUrl?: string; fetcher?: FetchTransport; reviewUuidProvider?: NativeUuidProvider } = {}) {
  const [locale, setLocale] = useState<Locale>("ru");
  const [address, setAddress] = useState(initialApiUrl ?? "");
  const [apiUrl, setApiUrl] = useState(() => { try { return initialApiUrl ? normalizeApiUrl(initialApiUrl) : undefined; } catch { return undefined; } });
  const [invalidUrl, setInvalidUrl] = useState(() => {
    if (!initialApiUrl) return false;
    try { normalizeApiUrl(initialApiUrl); return false; } catch { return true; }
  });
  const addressInput = useRef<FormInputHandle>(null);
  const connect = () => {
    try { setApiUrl(normalizeApiUrl(address)); setInvalidUrl(false); }
    catch { setInvalidUrl(true); addressInput.current?.focus(); }
  };
  if (apiUrl) return <ConnectedMarket key={apiUrl} apiUrl={apiUrl} fetcher={fetcher} reviewUuidProvider={reviewUuidProvider} locale={locale} onLocaleChange={setLocale} onChangeApiUrl={() => { setApiUrl(undefined); setInvalidUrl(false); }} />;
  const t = sessionCopy[locale];
  return <App locale={locale} onLocaleChange={setLocale} authContent={<ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text kind="subtitle">{t.setup}</Text><FormInput ref={addressInput} accessibilityLabel={t.api} accessibilityHint={invalidUrl ? t.invalidUrl : undefined} placeholder={t.api} value={address} onChangeText={setAddress} keyboardType="url" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={connect} />
    {invalidUrl && <Notice kind="error" title={t.invalidUrl} />}<Button label={t.connect} onPress={connect} />
  </ScrollView>} />;
}
function ConnectedMarket({ apiUrl, fetcher, reviewUuidProvider, locale, onLocaleChange, onChangeApiUrl }: { apiUrl: string; fetcher: FetchTransport; reviewUuidProvider?: NativeUuidProvider; locale: Locale; onLocaleChange: (locale: Locale) => void; onChangeApiUrl: () => void }) {
  const controller = useMemo(() => createMarketSession(apiUrl, fetcher, Date.now, reviewUuidProvider), [apiUrl, fetcher, reviewUuidProvider]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.start(); }, [controller]);
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && previous !== "active" && controller.getSnapshot().phase === "ready") void controller.restore(controller.getSnapshot());
      previous = state;
    });
    return () => subscription.remove();
  }, [controller]);
  const t = sessionCopy[locale];
  return <App locale={locale} onLocaleChange={onLocaleChange} session={snapshot.session} onSessionRequired={controller.requireLogin}
    sessionActions={<View style={styles.actions}><Stack row><Text>{snapshot.accountName}</Text><Button label={t.logout} onPress={() => { void controller.logout(snapshot); }} />{snapshot.session?.client.nativePersonalProfile && <NativePersonalProfileLauncher key={`personal-profile:${snapshot.session.scope.product}:${snapshot.session.scope.environment}:${snapshot.session.scope.userId}:${snapshot.session.scope.organizationId}:${snapshot.session.scope.generation}`} scope={snapshot.session.scope} port={snapshot.session.client.nativePersonalProfile} locale={locale} />}{snapshot.session?.client.nativeOwnSessions && <NativeSessionsLauncher key={`own-sessions:${snapshot.session.scope.product}:${snapshot.session.scope.environment}:${snapshot.session.scope.userId}:${snapshot.session.scope.organizationId}:${snapshot.session.scope.generation}`} scope={snapshot.session.scope} port={snapshot.session.client.nativeOwnSessions} locale={locale} />}{snapshot.session?.client.nativeMfa && <NativeMfaLauncher key={`${snapshot.session.scope.product}:${snapshot.session.scope.environment}:${snapshot.session.scope.userId}:${snapshot.session.scope.organizationId}:${snapshot.session.scope.generation}`} scope={snapshot.session.scope} port={snapshot.session.client.nativeMfa} locale={locale} />}</Stack>{snapshot.issue && <Notice kind="error" title={t.issue[snapshot.issue]} />}{snapshot.workspaceEntryUncertain && <Notice title={workspaceEntryCopy[locale].history} />}{snapshot.logoutUncertain && <Notice title={logoutRecoveryCopy[locale].history} />}{snapshot.loginUncertain && <Notice title={unknownLoginCopy[locale].history} />}</View>}
    authContent={<SessionPanel controller={controller} snapshot={snapshot} locale={locale} onChangeApiUrl={onChangeApiUrl} />} />;
}
function SessionPanel({ controller, snapshot, locale, onChangeApiUrl }: { controller: MarketSessionController; snapshot: SessionSnapshot; locale: Locale; onChangeApiUrl: () => void }) {
  const [entry, setEntry] = useState<"login" | "reset" | "verify" | "buyer-registration" | "registration-resume" | EmailEntryKind>("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState("");
  const passwordInput = useRef<FormInputHandle>(null);
  const t = sessionCopy[locale];
  const canSubmit = !!email.trim() && !!password;
  const changeApi = () => { if (controller.getSnapshot() === snapshot) onChangeApiUrl(); };
  const submit = () => { if (!canSubmit) return; const value = password; setPassword(""); void controller.login(email, value, snapshot); };
  const verify = () => { if (!code.trim()) return; const value = code; setCode(""); void controller.challenge(value, snapshot); };
  const changeEntry = (kind: "login" | "reset" | "verify" | "buyer-registration" | "registration-resume" | EmailEntryKind, value = email) => { if (controller.getSnapshot() !== snapshot || snapshot.canCheckLogin) return; setEmail(value); setPassword(""); setCode(""); controller.dismissEmailEntry(); setEntry(kind); };
  const emailEntry = entry !== "login" && entry !== "reset" && entry !== "verify" && entry !== "buyer-registration" && entry !== "registration-resume" && !snapshot.canLogout && (snapshot.phase === "signed-out" || snapshot.phase === "working") ? entry : undefined;
  useEffect(() => { if (snapshot.emailVerification?.phase === "verified" && snapshot.canLogout) setEntry("login"); }, [snapshot.emailVerification, snapshot.canLogout]);
  const resumeEntry = entry === "registration-resume" && !snapshot.canLogout && (snapshot.phase === "signed-out" || snapshot.phase === "working");
  const registrationEntry = entry === "buyer-registration" && !snapshot.canLogout && (snapshot.phase === "signed-out" || snapshot.phase === "working");
  const verificationEntry = entry === "verify" && !snapshot.canLogout && (snapshot.phase === "signed-out" || snapshot.phase === "working");
  const resetEntry = entry === "reset" && !snapshot.canLogout && (snapshot.phase === "signed-out" || snapshot.phase === "working");
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    {snapshot.issue && <Notice kind="error" title={t.issue[snapshot.issue]} />}{snapshot.mfaNotice === "disabled" && <Notice title={mfaCopy[locale].disabled} />}{snapshot.sessionNotice === "revoked" && <Notice title={ownSessionsCopy[locale].currentRevoked} />}
    {snapshot.workspaceEntryUncertain && <Notice title={workspaceEntryCopy[locale].history} />}
    {snapshot.canCheckLogin ? <><Notice title={unknownLoginCopy[locale].unknown} body={unknownLoginCopy[locale].body} /><Button label={unknownLoginCopy[locale].check} onPress={() => { void controller.checkCurrentLogin(snapshot); }} /><Button label={unknownLoginCopy[locale].again} onPress={() => { setPassword(""); setCode(""); controller.prepareNewLogin(snapshot); }} /><Button label={t.changeApiUrl} onPress={changeApi} /></> : snapshot.loginUncertain && <Notice title={unknownLoginCopy[locale].history} />}
    {snapshot.logoutUncertain && <Notice title={logoutRecoveryCopy[locale].history} />}{snapshot.canContinueLogout && <><Notice title={logoutRecoveryCopy[locale].pending} body={logoutRecoveryCopy[locale].body} /><Button label={logoutRecoveryCopy[locale].check} onPress={() => { void controller.continueLogout(snapshot); }} />{snapshot.canRetryLogout && <Button label={logoutRecoveryCopy[locale].retry} onPress={() => { void controller.retryLogout(snapshot); }} />}<Button label={t.changeApiUrl} onPress={changeApi} /></>}
    {snapshot.canContinueSessionRestore && <><Notice title={foregroundSessionCopy[locale].blocked} body={foregroundSessionCopy[locale].body} /><Button label={foregroundSessionCopy[locale].continue} onPress={() => { void controller.restore(snapshot); }} /><Button label={sessionCopy[locale].changeApiUrl} onPress={changeApi} /></>}
    {snapshot.challengeFeedback && <Notice title={authEntryCopy[locale][snapshot.challengeFeedback]} />}{snapshot.challengeUncertain && snapshot.challengeFeedback !== "unknown" && <Notice title={authEntryCopy[locale].history} />}{snapshot.canContinueAuthEntry && <><Notice title={snapshot.phase === "mfa" ? authEntryCopy[locale].elevated : authEntryCopy[locale].pending} /><Button label={authEntryCopy[locale].continue} onPress={() => { void controller.continueAuthEntry(snapshot); }} /></>}
    {snapshot.emailVerification?.phase === "verified" && <Notice title={emailVerificationCopy[locale].verified} body={emailVerificationCopy[locale].verifiedBody} />}{snapshot.canContinueEmailVerification && <Button label={emailVerificationCopy[locale].continue} onPress={() => { void controller.continueEmailVerification(); }} />}
    {resumeEntry ? <RegistrationResumeUi model={controller.registrationResume} locale={locale} onBack={() => changeEntry("login")} /> : registrationEntry ? <BuyerRegistrationUi model={controller.buyerRegistration} locale={locale} onBack={() => changeEntry("login")} onVerify={() => changeEntry("verify")} onResume={() => { const current = controller.buyerRegistration.getSnapshot(), hints = current.preview ?? current.raw; controller.registrationResume.prefill({ email: hints.email, bin: hints.bin }); changeEntry("registration-resume"); }} /> : verificationEntry ? <EmailVerificationUi controller={controller} snapshot={snapshot} locale={locale} onBack={() => changeEntry("login")} /> : resetEntry ? <PasswordResetUi controller={controller} snapshot={snapshot} locale={locale} onBack={() => changeEntry("login")} onForgot={() => changeEntry("forgot")} /> : emailEntry ? <EmailEntryUi key={emailEntry} kind={emailEntry} initialEmail={email} controller={controller} snapshot={snapshot} locale={locale} onBack={value => changeEntry("login", value)} onForgot={value => changeEntry("forgot", value)} onReset={() => changeEntry("reset")} onVerify={() => changeEntry("verify")} /> : snapshot.phase === "checking" || snapshot.phase === "working" ? <Loading label={t.loading} /> : <>
      {snapshot.phase === "signed-out" && !snapshot.canLogout && !snapshot.canCheckLogin && <><Text kind="subtitle">{t.login}</Text>
        <FormInput accessibilityLabel={t.email} placeholder={t.email} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
        <FormInput ref={passwordInput} accessibilityLabel={t.password} placeholder={t.password} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" maxLength={128} returnKeyType="go" onSubmitEditing={submit} />
        <Button label={t.submit} disabled={!canSubmit} onPress={submit} /><Button label={registrationResumeCopy[locale].open} onPress={() => changeEntry("registration-resume")} /><Button label={buyerRegistrationCopy[locale].open} onPress={() => changeEntry("buyer-registration")} /><Button label={emailEntryCopy[locale].register} onPress={() => changeEntry("register")} /><Button label={emailEntryCopy[locale].forgot} onPress={() => changeEntry("forgot")} /><Button label={emailVerificationCopy[locale].open} onPress={() => changeEntry("verify")} /><Button label={passwordResetCopy[locale].open} onPress={() => changeEntry("reset")} /><Button label={t.retry} onPress={() => { void controller.restore(snapshot); }} /><Button label={t.changeApiUrl} onPress={changeApi} /></>}
      {snapshot.phase === "signed-out" && snapshot.canLogout && !snapshot.canContinueLogout && <Notice title={t.pendingSession} />}
      {snapshot.phase === "mfa" && !snapshot.canContinueAuthEntry && <><Text kind="subtitle">{t.mfa}</Text><FormInput accessibilityLabel={t.code} placeholder={t.code} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} secureTextEntry textContentType="oneTimeCode" maxLength={128} returnKeyType="go" onSubmitEditing={verify} /><Button label={t.verify} disabled={!code.trim()} onPress={verify} /></>}
      {snapshot.phase === "choose" && snapshot.workspaceEntry && <><Text kind="subtitle">{workspaceEntryCopy[locale].target}: {snapshot.workspaceEntry.organizationName}</Text><Notice title={workspaceEntryCopy[locale][snapshot.workspaceEntry.kind]} body={snapshot.workspaceEntry.kind === "unknown" ? workspaceEntryCopy[locale].independent : undefined} /><Button label={snapshot.workspaceEntry.kind === "known" ? workspaceEntryCopy[locale].continue : workspaceEntryCopy[locale].check} onPress={() => { void controller.continueWorkspaceEntry(snapshot); }} /></>}
      {snapshot.phase === "choose" && !snapshot.workspaceEntry && <><Text kind="subtitle">{t.choose}</Text>{snapshot.canReloadChoices && <Button label={t.reloadOrganizations} onPress={() => { void controller.reloadOrganizations(snapshot); }} />}{snapshot.choices.length ? snapshot.choices.map(item => <Button key={item.organizationId} label={`${t.open}: ${item.organizationDisplayName}`} onPress={() => { void controller.selectOrganization(item.organizationId, snapshot); }} />) : <Notice title={t.empty} />}</>}
      {snapshot.canLogout && !snapshot.canContinueLogout && <Button label={t.logout} onPress={() => { setEmail(""); setPassword(""); setCode(""); void controller.logout(snapshot); }} />}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  form: { padding: theme.space.page, gap: theme.space.medium }, actions: { paddingHorizontal: theme.space.page, gap: theme.space.small },
});
