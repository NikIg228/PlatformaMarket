# UI-CONTRACT — единые компоненты Market

Владелец: PlatformaMarket UI / 01a0e834-6e44-7a81-a438-ea859da9728b.
Основание: владелец утвердил все три этапа после read-only аудита06.10;
отдельно подтвердил, что поддержка/уведомления остановлены. Один writer.
Baseline: canonical main@2fe8c1fdb91496c1fa32293e81f71a0dcc14f59e.
Чужой staged/unstaged Support, Orders/Notifications, governance и next-env
сохраняется. Baseline patches: .tmp/ui-contract/baseline-{un,}staged.patch.

## Scope / план проверок

1. Исправить отсутствующие CSS tokens, единая светлая тема и шрифт, один focus.
2. Контракт44/32px, radius8 для controls,12 для card,16 для dialog; общие
   кнопки/поля/selectors/контейнеры, адаптация потребителей без смены business API.
3. Документация, dev-only страница образцов, автоматический guard и целевые
   regression/browser проверки, правила будущих UI изменений.

Риски: focus/ref, native form semantics, dropdown keyboard/portal, disabled,
длинные подписи/mobile, все потребители shared UI. Не менять данные/авторизацию,
доменные операции, маршруты кабинетов, dependencies или shared CRM palette.
Цветовой JSON v1 сохраняется; геометрия — отдельный контракт Market.
Тесты: focused UI tokens/guard/unit; scoped ui/web/e2e types и lint; targeted
fixture browser1440/390 для образцов, документов, public catalog и supplier
consumers. Рабочие mutations перехватываются fixtures. Финальный go_live web
build после остановки только проверенного canonical dev; затем восстановление.
Полный npm test/E2E/backend/DB suites не нужны без изменения доменной логики.
Макс3 попытки/gate;20min checks/15min blocker diagnosis. PASS переиспользуется
для неизменённых входов. Review, diff hygiene, own-scope commit/push если
не зависит от неопубликованного чужого WIP; remote SHA и CI отдельно.

Состояние: LOCAL_UI_PASS / PUBLICATION_BLOCKED. Skills development-toolkit/frontend/verification/review,
web-interface-guidelines; Agency UI Designer/Frontend Developer прочитаны.

## Реализация / evidence06.10
Shared controls extracted with React19 ref/form/link props; direct Fluent imports
migrated to adapters (21 consumers), density44/32 and danger/icon variants.
Missing tokens repaired, provider light-only, shared font, focus single outer.
Dev /dev/ui-kit plus COMPONENT_CONTRACT and ESLint import boundary added.
Types ui1/web1/e2e1 PASS; lint apps+UI+scripts1 PASS.
UI token/theme gate1 PASS5 (component-contract + light-theme).
Browser samples1 FAIL2: ambiguous option locator matched native and Fluent
options; fix scopes to listbox, no product failure. Samples2 next.
Remaining: samples/real consumers/visual review, dependent UI tests, final types
where changed, web build, owned diff publication and CI. Foreign index untouched.

Samples2 FAIL return focus: standalone controlled example lacked trigger binding.
Sample now uses existing onClosed callback + ref, samples3 PASS2 desktop/mobile.
Consumers1 PASS5 supplier focus/validation/checkbox + clinic/supplier documents.
Public1 PASS3 catalog1440/390 + persisted dark preference remains light.
UI dependent1 FAIL incomplete preexisting Fluent mock after Support export;
added makeStyles/tokens mock, dependent2 PASS3. Modality1 PASS3.
Sample screenshots1440/390 inspected; no overflow/clipping; consistent controls.
Final build and scoped review/publication next.

## Расширение scope владельцем06.10
После первичных adapters владелец явно поручил полный визуальный аудит всего
приложения и немедленное исправление расхождений: локальные стили/контейнеры/
страницы/controls должны подчиняться общему контракту. Это продолжение текущей
задачи, без backend/business redesign. Dev пока НЕ остановлен; build отложен
до завершения расширенного scope. Git/index/foreign WIP сохранены.
План: inventory всех CSS/TSX styling + связей consumers; классификация
controls/surfaces/type/spacing/focus/semantic colors; нормализация и запрет
новых несанкционированных overrides; затем representative browser матрица
public/clinic/supplier/admin desktop/mobile, legacy imported entries, states
и final scoped types/lint/canonical build. Не выдавать coverage исходников
за browser приёмку каждого сценария. Реестр находок в COMPONENT_CONTRACT_AUDIT.

## Полный визуальный проход — IN_PROGRESS
315 CSS/TSX sources inspected (69 stylesheets inventory, incl legacy imports).
3150 declarations normalized in66 CSS files: versioned type/weight/line/spacing/
radius tokens;70 literal colour corrections;37 inline style corrections.
361 local normal-control declarations removed in18 stylesheets. Native widgets
now shared DmAction/FileInput/Checkbox/Select/Input; boxed CTA anchors adapted.
Explicit shared composer variant preserves multiline/support semantics. Five
root layouts put Manrope variable on html so root font token resolves correctly.
Catalog category measurement now reads CSS gap instead of hardcoded8px.
Guard scripts/lib/ui-contract-policy*.mjs + verify-ui-contract.mjs; root lint
invokes guard, ESLint rejects raw widgets/direct Fluent base controls.
Guard1 PASS3 policy regressions +315files/9382declarations/5684JSX elements.
Audit inventories and per-declaration corrections: .tmp/ui-contract/*audit*.json,
normalization-report.json, color-normalization.json, inline-normalization.json,
control-centralization.json. Durable audit summary still to write.
Expanded web types2 FAIL missing DmFileInput import in supplier-compliance;
fixed. Web types3 currently running session6153; expanded lint2 session57332.
prepare:web PASS1 (generated auth CSS refreshed; dev only prepared once at start).
Old browser PASS is earlier narrower snapshot; full normalization still needs
new matrix validation. No final build/commit/push yet. Dev launcher8976/web3236
verified canonical via process chain; has NOT been stopped. No agents/worktrees.
Expanded web types3 and lint2 PASS. Guard extended to CSS-module control classes:
first scan found6 overrides; removed (search fixed height, legacy icon colour and
auth disabled duplication), policy4 tests +315sources PASS. prepare:web workspace
PASS; one root invocation was invalid (no root script), no product failure.
Expanded browser public/samples1 PASS5. Consumers1 PASS10/FAIL1: mobile promotions
TabList overflow after font standardization. Shared horizontal TabList constrained
to parent with internal scroll; targeted consumers2 PASS6 (mobile six pages,
focus/auth validation and clinic/supplier document search). Support fixtures and
full shared UI unit suite running. No backend/DB writes; dev retained.
Support1 PASS4; shared UI suite1 PASS76/14files. Final lint3 PASS.
Final types UI/e2e/admin/landing PASS; buyer1/supplier1 FAIL missing adapter
imports in legacy-only components. Supplier2 PASS after DmFileInput import.
Buyer2 started before import was applied and repeated same missing import;
buyer3 PASS after DmSelect import. All scoped types now PASS.
Visual matrix1 PASS2/FAIL2: test selected hidden desktop menu control and hidden
mobile sidebar entry; corrected locators (no product change). Affected matrix2
PASS2. Auth/products desktop/mobile + admin error layout screenshots saved under
.tmp/ui-contract/visual{,-fixed}; inspected representative auth/import/products,
support composer1440/390 and admin390. Existing side defect: LiveMetrics uses
response.json without response.ok;503 payload gives String(payload.length)
display as undefined counts. Recorded only; HTTP/data recovery is separate scope.
Diff hygiene initially8 codemod blank-line whitespace issues; removed; now PASS.
Canonical launcher8976 tree verified and stopped for go_live web build1/session73358.
Dev restoration is REQUIRED after build. Baseline alternate Git index construction
running session92721; no working-tree copy, no original index mutation.

## Финальный локальный результат06.10

Go_live web build1 PASS. Full source guard4 regressions +315sources PASS.
Final eslint4 PASS after covering JSXSelfClosingElement as well as opening tags.
Commands: npm run verify:ui-contract; npm run test --workspace @marketplace/ui;
npm run typecheck --workspace @marketplace/{ui,web,e2e,buyer-web,supplier-web,admin-web,landing-web}
(each selected workspace); targeted npx --no-install eslint apps/... packages/ui
scripts/verify-ui-contract.mjs scripts/lib/ui-contract-policy*.mjs --max-warnings=0;
DEPLOYMENT_PROFILE=go_live npm run build --workspace @marketplace/web.
Browser configs: ui-contract (5 public/samples +4 visual matrix); workspaces
(11 selected consumers, mobile overflow fixed and affected6 PASS); support
(4 fixture-only cases). Exact case regex/results above.
Review: adapters retain native semantics/ref, business APIs untouched, static
normalization reports inspected, representative screenshots reviewed.
No full backend/DB/release suites: unchanged domain behavior for this task.

Publication separation attempt1: reconstructed baseline index from saved patches;
full own-tracked.patch produced. Applying own patch to HEAD-only alternate index
conflicts in apps/web/app/workspaces/{orders,support}.tsx, packages/ui/src/
{index.tsx,order-workflow-workspace.tsx,styles.css}. Three adapted Support files
are new foreign files absent from HEAD. Their foreign business implementation
is NOT authorized by this UI task. Therefore no partial commit or push. Original
index tree independently verified unchanged a57124f8b8684ad0cdb90a313a28859b2556c6a1;
main HEAD remains2fe8c1fdb91496c1fa32293e81f71a0dcc14f59e. No actual-index conflicts.
CI NOT_RUN (no commit/push). Next step: separately finish/accept and commit the
preserved Support/Orders work, then re-separate and publish UI scope. Do not
restart completed local UI checks unless their relevant inputs change.
Final e2e type recheck for new visual tests PASS (session72296).
Dev restore1: API200/root200, but login/supplier routes404 after production build.
Existing source/route manifest intact. Stopped verified launcher20184 tree and
moved generated apps/web/.next/dev to .next/dev-before-ui-restore (retained).
Dev restore2 via hidden cmd18792 npm run dev canonical root PASS: API health/ready,
/login200, /supplier/orders200, /dev/ui-kit200. Auth JWT/go_live retained.
No source/data changes for cache recovery; no further checks pending.

06.10 publication update: owner explicitly authorized commit/push of all remaining
WIP. Prior own-scope separation blocker is superseded by the combined authorized
scope in PUBLISH-WIP-2026-10-06.md.131 tracked UI sources match the final patch;
shared UI76 tests pass again. No new UI implementation or broad acceptance claimed.
