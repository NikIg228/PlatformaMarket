# Unified loading states — 06.11.2026

Owner approved the proposed loading scenarios and explicitly required the same
spinner + subject label for future pages/components. Canonical main at
5161af7f83f909ad90901de403daa3f7fde0e928, ahead7. Earlier staged/unstaged work kept.

## Plan, scope and risk

One shared LoadingState with block/inline presentations. Initial cabinet
preparation uses stable cabinet wording; page/component reads retain subject
labels; background refresh keeps same-context data. Risks: exposing protected
children before context/session readiness, a permanent spinner on error,
duplicate status announcements, invalid button markup, and legacy consumer
regressions from the shared adapter. Preserve authentication and request rules.

Focused verification: real shared-spinner SSR semantics/button embedding,
clinic-entry ordering, header destinations, login restoration, refresh feedback,
component contract and representative metrics consumer. Completion: affected
UI + five frontend types/builds, scoped lint, UI contract, diff/link hygiene and
targeted browser screenshot/computed/keyboard at desktop/mobile RU/KK. No new
dependency, data write, API/schema/migration or deployment work.

## Implementation

- `packages/ui/src/loading-state.tsx`: required label; block uses existing
  mp-state/Fluent medium, inline uses span/Fluent tiny. One polite status with
  an associated label; no focusable control. Fluent reduced-motion preserved.
  Root/primitives exports remain compatible; new loading-state subpath available.
- ClinicEntry always renders the existing Workspace shell, with `preparing`
  closing its protected content until organization mode is established. Session
  and role checks still run. It no longer replaces the entire shell with a
  separate transient spinner. Workspace, rights and profile gates share one
  cabinet caption; canonical clinic gates and login have RU/KK captions.
- Removed all `Проверяем вход` loading renderings from current and legacy TSX
  consumers. Public account link gets inline cabinet status; purchase control
  says `Готовим покупку…`, retaining disabled/authorization behavior.
- Plain read-status text in price/settings/delivery editors, search, cities,
  filters, promotions and registration continuation now uses shared spinner.
  Existing subject-specific LoadingState consumers retain their subjects.
- Document panels/registry/archive, personal/buyer surfaces and integration
  readiness use the same adapter. Load-more buttons name their content.
  Registry initial loading does not duplicate its footer status.
- Conversations show named list/message loading instead of blank placeholders;
  refresh retains the list and has an inline status. New draft conversations
  do not get a false perpetual message loader; error feedback remains separate.
- ResourceStatus distinguishes refresh from initial loading and errors without
  removing current children. Existing useResource scope/reset rules unchanged.
  Platform metrics keep their previous successful values during refresh.
- All 28 lazy admin sections now name the actual section being loaded.
- Action pending states (save/upload/sign/logout) remain action-specific. No
  sweeping redesign, caching or alteration of business-request semantics.

Future rule is recorded in AGENTS, DESIGN_SYSTEM / Единые лоадеры,
UI_UX_IMPLEMENTATION_STANDARD and existing roadmap R7. JSON component contract
records the adapter variants. Accepted policy is not production acceptance.

Exact source scope: `.tmp/loading-unification-20261106/source-scope.json`.
Selected pre-edit snapshots are in its `before/` directory; they are review
snapshots, not another development checkout. Docs and component-contract.json
are additional rule changes. Do not stage earlier WIP as part of this task.

## Verification and limits

Targeted tests: 59 PASS — shared loader4, component contract2, clinic entry2,
ResourceStatus3, header13, auth-client23, login restoration11, metrics model1.
Commands use `npm exec --workspace=@marketplace/<workspace> -- vitest run`:

- ui: `src/loading-state.test.tsx src/component-contract.test.ts`
- web: `app/clinic/clinic-entry.test.tsx app/workspaces/resource-status.test.tsx`
- buyer-web: `app/features/marketplace-header/header-account.test.tsx`
  and `app/features/marketplace-header/header-account-lifecycle.test.tsx`
- landing-web: `app/login/login-restoration.test.tsx app/auth-client.test.ts`
- admin-web: `app/platform-assurance-view-model.test.ts`

First loader/ResourceStatus/login test imports failed on known Tabster ESM/CJS
interop; reused existing createRequire test setup, then affected suites passed.
Loader final test uses DmButton after native-widget lint failure; final4 PASS.
These are test-environment/fixture fixes, not bypasses of application failures.

Final completion types ui/web/buyer/supplier/admin/landing PASS after all builds.
First web types caught an out-of-
scope locale in a module-level dynamic fallback; fixed with ProfileLoading
component, then types passed. Scoped lint PASS after fixing the test control;
UI contract PASS; diff hygiene PASS. These do not prove browser behavior.

Buyer/supplier/landing/unified web builds PASS with bundle checks where configured.
Admin first build PASS but overlapped final section-caption edit: superseded;
final admin build PASS. No acceptance boxes promoted.
Logs: `.tmp/loading-unification-20261106/*-{build,types}.log`, lint and UI-contract.

Browser acceptance remains OPEN due previously recorded CUA timeoutMs failures.
RC review 06.11 additionally identified a source-level KK gap: the new inline
refresh label in `apps/web/app/workspaces/resource-status.tsx` is always Russian
and the component has no locale/translation input. This remains OPEN together
with the browser acceptance; the subsequent production frontend launch was
rejected by policy. See [RC evidence](stand-rc-20261106.md), without replacing
the historical attempts below.

Later explicit owner continuation on06.11: the ResourceStatus source gap is
locally corrected. It reads the current URL locale through the existing
workspaceLocale/workspaceText helpers; refresh/offline/previous-version copy
has KK translations, while server error text is preserved. Seven rendered-state
tests cover RU/KK/default/unknown locale, retained content, one status, idle and
initial loading, and offline/error precedence. Scoped lint, web types and UI
contract PASS. Browser acceptance still pending the production launch policy
resolution; this source correction is not a browser PASS. Logs:
`.tmp/stand-rc-kk-20261106/`.
No new retry or alternate-browser/access-policy bypass. Required real flows:
initial supplier/clinic/personal/admin entry; rights/profile errors; page vs
inline status; refreshing same-context rows; document/dialog keyboard and
mobile RU/KK screenshot/computed styles. No commit/push while this gate is open.

Prior owned dev session11190 stopped for builds. All five next-env files restored
byte-for-byte from pre-build snapshots, then requested `npm run dev` restarted.
Final source fingerprints are recorded in the task's `source-sha256.json`.
Restarted dev session66355 remains ON (API4012/PID19628, web3000/PID15956).
Anonymous HTTP probes of login, supplier, clinic?lang=kk, personal/cart and admin
all returned200; SSR HTML contains Fluent Spinner and no `Проверяем вход`.
This confirms server-rendered loading output, not authenticated transitions,
hydration, screenshot/computed styles or keyboard acceptance.
