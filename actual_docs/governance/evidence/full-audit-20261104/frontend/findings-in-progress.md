# Frontend findings, in progress

Audit only; no remediation. Current source af714969 plus preserved WIP.
Runtime remains NOT_RUN, so static conclusions below do not claim browser acceptance.

## FE-LOC-001, medium candidate: KK history and navigation revert to RU

`apps/web/app/workspaces/notification-bell.tsx` reads workspace locale, translates
its labels and passes locale to NotificationItems. Its history link preserves
`?lang=kk`. But `notifications.tsx` reads only role, renders Russian controls and
calls NotificationItems without locale; its default is ru, including date format.
Thus the KK shell's history destination cannot render the corresponding KK history.
`orders.tsx` similarly drops lang on detail/analytics links and reset uses pathname
alone. `dashboard.tsx` uses plain RU text and paths. Consolidate all locale consumers
before final severity/scope; do not claim every page is localized from shell evidence.

Reproduction planned: both roles, open notifications with lang=kk, compare bell to
full history, follow order and analytics links then reset filters. RU baseline and
EN fallback also required. EN fallback is an explicitly tested current behavior
(`workspace-locale.test.ts`), not automatically a new breach of previously deferred EN.

## FE-ERP-001, high requirement gap candidate: ERP connection remains a support request

Fully read `settings-sources.tsx`:1C/MoySklad cards state assisted connection,
open ConnectionRequest, and POST a GENERAL support ticket via createSupportTicket.
The settings sources tab routes directly here. `settings-integration-tax.tsx`
only edits existing tax bindings and does not connect ERP. Explicit source-of-truth
rule requires self-service connection in clinic/supplier cabinets and excludes
support request as regular connection. Trace remaining integration consumers before
finalizing breadth; no runtime observation yet.

## Design source consistency to reconcile

## FE-SIGN-001, high candidate: production CSP blocks required NCALayer connection

Full current-source chain: profile.tsx renders ProfileIdentity; useIdentitySigning
creates NcalayerClient with no websocket URL override; eds-client defaults to
wss://127.0.0.1:13579/. Unified proxy.ts connect-src permits only self in production
for profile routes. ws:/wss: are enabled only outside production. Therefore normal
production origin cannot open the local NCALayer websocket. Browser verification
must observe CSP violation without relaxing policy or bypassing security. Existing
EDS unit tests inject FakeSocket and cannot detect this integration failure.

## Design source consistency to reconcile

DESIGN_SYSTEM's later15.10 underline category rule supersedes retained07.10 fill
rule in final section. Later notification state rule says no second compact network
indicator; retained08.10 section still says an indicator remains. Use newest dated
decision, report documentation ambiguity, do not infer permission to change tokens.

## FE-SESSION-001, medium static: admin session revocation clears a newer login

packages/ui/src/session-management.tsx revoke awaits Promise<unknown>, never checks returned id/status and calls onCurrentRevoked when captured selected matches captured currentSessionId. apps/admin-web/app/identity-settings.tsx callback calls clearAdminSession() without expected identity; admin-auth.ts implements an expected-session guard but this caller omits it. If a later login is stored while revoke response is pending, the old callback removes the new session and redirects. Unlike workspace logout/session stores, this path does not recheck current identity. Current route reachability through admin settings import to verify fully with shell; no runtime claimed. A malformed successful response also incorrectly displays success or invokes current-session removal. Planned focused delayed-response test: select current session A, initiate revoke, store B, resolve A receipt, expect B retained; plus wrong receipt ID/status.

## FE-FORM-001 — discrepancy draft silently refuses invalid damaged quantity (static, P2 candidate)
- packages/ui/src/order-discrepancy-form.tsx:21,24,32–34: whole statement safeParse gates onSave, but only actualQuantity/reason receive feedback. damagedQuantity input has no error state/message; no summary renders parsed.error.
- packages/schemas/src/order-discrepancy.ts:3,10 requires strict nonnegative decimal (max6 fractional digits, no leading zeros).
- Reproduction: open reachable order discrepancy draft, valid reason/actual quantity, enter damaged quantity `-1` or `abc`, press Save. No onSave and no visible error. Also actual quantity `01` passes local displayed regex but fails shared schema silently.
- Caller: order-discrepancy-panel.tsx:76, order-workflow-workspace.tsx:718. Runtime NOT_RUN; proposed targeted browser check, no remediation.

## FE-RECOVERY-001 — unknown committed workflow outcome strands next action (static, P1/P2 candidate)
- order-workflow-command.ts:10–15,20–25 preserves command on network/5xx and rejects any different signature.
- order-workflow-workspace.tsx:254–280 catches error but does not expose pending command/retry; error recovery at508 only refreshes GET. Background polling refreshes every5s.
- After ACCEPT_COMPOSITION commits and response is lost, GET advances status; action at564–567 disappears. Any later different workflow action hits local tracker rejection, and there is no reachable replay control. Remount clears memory but is not offered as recovery.
- Existing tracker unit tests prove exact-command preservation, not UI reachability after committed state transition. Targeted browser test must simulate dropped committed response then polling and next action. Runtime NOT_RUN.

## FE-FORM-002 — committed attribute creation reports failure (static, P2)
- foundation-management.tsx:128–155 reads React event.currentTarget.reset after awaited request. currentTarget is cleared after event dispatch; successful POST then throws, catch shows error and skips load/success.
- Reachable current operator catalog composition operations-workspace.tsx:169 uses FoundationManagement catalogOnly. Role creation100 has same pattern but role UI not current caller.
- User impact: created attribute absent from local choices until reload, false failure encourages retry/duplicate conflict. No product fix made. Runtime NOT_RUN.
- Same confirmed current pattern: organization-quick-create.tsx:73 resets event.currentTarget after fetch; operations-workspace.tsx:192 exposes it in Organizations. Successful create is reported as failure; next retry conflicts on existing BIN.

## FE-DRAFT-001 — correction decision silently discards other edited values (static, P2)
- apps/admin-web/app/product-correction-queue.tsx load sets drafts to Object.fromEntries of server proposedValue for every row (66–68); decide awaits load after any accepted/rejected row (106).
- Reachable operations-workspace.tsx:169 catalog. Edit publication values in rows A/B, decide A: refresh overwrites unsaved B with supplier proposal. Comments survive but acceptedValue edits do not. Error retry also resets all drafts.
- Needed behavior: preserve drafts for untouched pending IDs or warn before replacement. Runtime NOT_RUN; no product changes.

## FE-NUMBER-001 — native quantity validity blocks operator price forms (static, P2 candidate)
- supplier-controls.tsx:394,399,427,448 uses type=number min=0.000001 with no step. Native default step1 is based at min, so ordinary integers/defaultValue20 fail stepMismatch. DmInput controls.tsx:18 forwards props without assigning step.
- Reachable access section operations-workspace.tsx:168. Tier creation, contract creation and price resolver quantity are affected; actual browser validity probe pending. No runtime claimed.
- Related selection integrity candidate: decision set only by resolver, never cleared when supplier/offer changes, so prior price remains beneath a new selection. load has no generation/abort and may overwrite offers/lots from older supplier request; permission checks must prevent cross-supplier writes but UI consistency still unproved.

## FE-PROMO-001 — advertised variant/package lost during product navigation (static, P2 candidate)
- Reachable product-detail.tsx:136 renders PromotionsStorefront; promotions-storefront.tsx:63,67 links only /products/{productId}, dropping terms.offerId. model.ts:32–37 needs offer query to derive advertised variant/package; default product picks selectedVariantId/first variant and first package (product-detail.tsx:55–58). Choosing a campaign for a nondefault variant can open unrelated purchase choices. Main PromotionBanner correctly uses promotionProductHref.
- Separate trigger on correct banner links: delivery-context.tsx:40–42 injects saved/profile city on first product load when returnTo lacks deliveryCityId, calls deliveryDestination and dispatches popstate. navigation.ts:23–28 preserves variant/packaging only, dropping offer; ProductDetail popstate then resets selected variant/package from URL. A link with offer only loses advertised selection automatically. User changing city also triggers this loss until explicit variant/package chosen.
- Runtime NOT_RUN. Test nondefault promoted offer with saved city, verify variant/package remains; test product promotions section destination includes advertised offer.

## FE-QUANTITY-001 — product purchase UI rejects valid supplier quantities and submits invalid ones (static, P2)
- supplier-quantity.ts:12–20 rounds initial minimum to zero-based multiple of step and validates n/step. For minimum3/increment2 defaults4, allows4/6, rejects3/5.
- Backend confirmation from functional_audit: commerce-rules.ts:60–67 validates (quantity-minimum)/increment; personal-cart.service.ts:81 and resolve-cart-offer.ts:94–101 use it. PersonalCartItem follows same correct minimum-offset rule.
- Reachability: ProductDetail:121 -> SupplierOffers:46–48,90–94,134 -> API personalAddItem/addCartItem. For offset minimum all UI-accepted values conflict with backend increment; correct quantities disable purchase. supplier-quantity.test.ts:17–22 explicitly locks wrong expectation.
- Runtime NOT_RUN; fix not performed. Target regression minimum3/step2 ->3/5 accepted and initial3;4 rejected, personal/organization add path.
- Root later reproduced FE-QUANTITY-001 via original AST pure functions: ../root/quantity-probe-1.json, min3/step2 no common accepted integers1..100; control1/1 all100 accepted by both. Source hashes/ranges captured. Browser/live offer availability not claimed.

## FE-REG-001 — исправление email повторяет прежний запрос регистрации (static, P2)
- apps/landing-web/app/register/register-screen.tsx:65,124–132 stores one idempotency key for the component lifetime. After successful registration, «Исправить email» at187–192 clears only registeredEmail/feedback, not the key or existing registration intent.
- Editing email then submitting calls /onboarding/registrations with changed payload and the prior key. Root independently checked apps/api/src/modules/onboarding/onboarding.service.ts:115–125: changed email/BIN/capability throws409. A new key alone is insufficient after successful intent creation: same BIN meets active intent conflict at144–163.
- The same first-stage-success/second-stage-failure flow prevents correction of first-stage fields while retrying; preserving the key is correct only for identical retry input.
- Reachability: unified /register re-exports landing register screen. Existing local-auth.spec.ts checks success/reset, not correction after initial registration. Runtime NOT_RUN; root backend cross-check is static, not a live registration test.
- Required resolution must define an authorized correction/resume path, not simply reset the key. No product change performed.
