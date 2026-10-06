# SUPPORT-UX — support workspace redesign

Publication update06.10: owner authorized commit/push of all remaining WIP;
see PUBLISH-WIP-2026-10-06.md. Earlier dependency/publication restrictions below
describe their task boundaries and are superseded only for this combined delivery.
Existing backend/attachments gates retained; shared UI76/client3 tests PASS.

## Text send and bell alignment — 06.10.2026 (active)

New owner request: replace circular send icon with vertically centered text action
in the same composer position; center notification bell in its hover surface.
Canonical main@2fe8c1f and preserved dirty/staged baseline confirmed; both Market
threads idle. Scope: composer JSX/CSS and bell icon-slot margin only. Low visual
risk, shared header clinic/supplier; no notification behavior/API changes.
Use existing support fixture desktop/mobile visual and keyboard checks, web types/
build once at completion, scoped lint/diff. No new CSS-mirroring E2E or backend tests.
Existing development-toolkit, web-interface-guidelines and UI Designer practices
reused. Max3 attempts/gate,20min checks/15min diagnosis. No baseline publication.

Implemented subtle text send with centered label and existing submit/busy semantics;
removed Send icon and fixed width/circle radius. Bell gets icon-slot margin:0,
because the absolute badge child made Fluent reserve the icon-to-text margin.
Existing compact support browser1 PASS2 (1440/390) without new test files.
Ad-hoc fixture inspection: supplier1440/count0 and clinic390/count7 icon centers
dx=0,dy=0; hover screenshots inspected; keyboard Enter/Escape PASS for both.
Inspection1 clinic waited on exact heading without its counter; corrected selector
and readiness in inspection2 PASS, no product fix needed. Scoped ESLint1/diff PASS.
Canonical owned dev5968/web8112 paused for required go_live build1; running.
Logs .tmp/support-text-{browser1,visual1,visual2,build1}.log; screenshots
output/playwright/support/text-send-bell-{supplier,clinic}.png.

Final `DEPLOYMENT_PROFILE=go_live npm run build --workspace @marketplace/web`
PASS including TypeScript; scoped ESLint and `git diff --check` PASS. Existing
compact browser PASS2 and hover/keyboard inspection PASS2. No backend/DB/full E2E
checks warranted for these visual-only changes. Generated web next-env restored.
Dev restored via canonical npm run dev launcher18660, API11428:4012/web19412:3000;
unified readiness confirmed. Both requested visual fixes locally complete.
HEAD main@2fe8c1f unchanged; no commit/push because underlying support and inbox
files remain preexisting unpublished WIP. Current task did not stage that scope.

## Compact page follow-up — 06.10.2026 (active)

New explicit side-conversation request: remove reload controls, compact ticket
heading, dismissible transient success feedback, page-wide list/chat without
outer card, unified compact input with icon attachment/send controls.
Primary and other Market thread inspected idle; canonical main@2fe8c1f.
Preserve all preexisting staged support/backend and unrelated WIP; no publication
of that earlier unfinished scope. Current edits limited to support presentation,
optional compact file-picker mode and focused browser regression coverage.
Risk: focus, toast dismissal, short/mobile viewport scroll, upload/retry controls.
Checks: existing isolated support browser fixtures + new dismissal test, visual
desktop/mobile, scoped web/UI/e2e types and lint; web build if canonical dev can
be safely paused. No backend/DB/full E2E for unchanged contracts. Max3 attempts,
20min per check /15min diagnosis. Review incremental diff before completion.

Implemented page-wide layout, 16px ticket title, compact auto-growing composer,
optional icon-only picker, named send icon, success toast with close/6s timeout.
Refresh controls removed; polling and error retry retained. Browser1 PASS7/8;
recovery Escape failed. Browser2 PASS2 compact cases, recovery still failed after
explicit focus check. Removed newly added Fluent Tooltip Escape interception,
retaining native title + accessible hint: recovery browser3 PASS1 (limit reached).
8 distinct scenarios PASS across runs; mobile height corrected by6px and both
compact cases rechecked in browser2. Screens inspected desktop1440/mobile390.
Web/UI/e2e types1 and scoped lint1 PASS; final changed UI/e2e checks pending.
Canonical dev root15400 -> launcher18132 -> web13060/17412 provenance verified;
paused that tree for go_live web build1, currently in progress. Restore dev after.
No DB/backend/full-suite runs. Existing staged support implementation remains
separate unfinished work; no staging/publication of that baseline is authorized
by this compact-page follow-up. Development Toolkit, Web Interface Guidelines,
Agency UI Designer applied for hierarchy, existing tokens and keyboard/viewport QA.

Follow-up local completion: final UI/e2e typecheck + changed-file eslint PASS;
`DEPLOYMENT_PROFILE=go_live npm run build --workspace @marketplace/web` PASS,
including final web types. `git diff --check` PASS. Browser commands used
`npx --no-install playwright test --config apps/e2e/playwright.support.config.ts`
with compact/attachment/mobile/refresh greps; logs .tmp/support-compact-browser1–3.log.
Build log .tmp/support-compact-build1.log. No further runtime edits after PASS.
Dev restored via canonical npm run dev, launcher5968; API5964:4012/web15108:3000,
unified readiness confirmed. Generated web next-env returned to initial content.
Branch main, HEAD2fe8c1f unchanged; no commit/push or CI for this follow-up because
its new support files depend on the preexisting staged unpublished support slice.
Do not silently stage/publish that earlier scope. Requested UI is locally verified;
publication remains part of the separately owned original support delivery.

## Reference refinement and attachments — 06.10.2026 (active)

Current side-conversation request approves the generated unified list/conversation
reference, removes the visible reply label, replaces manual textarea resize with
an auto-growing composer, and adds PNG/JPG/JPEG/PDF/Word DOCX/Excel XLSX uploads
for clinic and supplier, readable by support operators. This is new authorized
work; earlier publication steps are not resumed independently. Primary inspected
idle. Canonical main@2fe8c1f; preexisting staged support and foreign Orders /
Notifications / governance WIP preserved. No agents, worktrees or working DB writes.

Behavior: attach up to 10 files, 10 MB each using existing private object storage,
signature checks and scanner; upload/retry/remove, atomic message linkage,
authorized downloads and image previews, operator access, first-request and replies.
No document parsing/AI extraction, external services or legacy DOC/XLS conversion.
Risk: cross-tenant asset injection/download, internal notes, rejected/quarantined
assets, cleanup/link races, duplicate commands, lost text/files and responsive focus.
Focused gates after backend unit: schema/client tests, upload policy/body boundary,
support service and new attachment tests; isolated PG claim/rollback/replay/tenant.
Completion: representative supplier/clinic/operator browser attachment flow,
desktop/mobile/keyboard/reference inspection, affected types/lint/API+web builds,
runtime smoke, diff/own-scope review. No full release/E2E. Max 3 attempts/gate.
Pending file metadata may survive reload within the existing session-scoped draft;
unsubmitted uploads expire after one hour; sent files follow message authorization.

Implementation now includes the approved unified panel, label-free auto-growing
composer and shared file picker/viewer; clinic/supplier first request and replies,
operator download, authenticated image preview, private storage/scanner reuse,
atomic claims and expiry cleanup without Prisma changes. Word/Excel mean DOCX/XLSX.
Development Toolkit backend/frontend/security/review and Agency UX Architect /
Code Reviewer practices applied to hierarchy, contracts, races and private files.
Schema build1 PASS; contracts4 and client2 PASS. Backend1 PASS36 (service, upload
policy, HTTP body limits, attachments); attachment service2 PASS6 after real-DB
finding. PG1 found absent Prisma message->ticket relation; authorization changed
to explicit scoped ticket read. PG2 PASS; PG3 PASS after adding real policy->asset
upload/scan/link/download integration (memory storage/test scanner, isolated DB).
Baseline workflow PG PASS in first run; no working DB writes or files created there.
API/web types1, UI/client/admin types1, e2e types1 and focused lint1 PASS.
Browser1 PASS11/14: generic textarea CSS overrode resize and late-installed fake
clock did not control existing intervals. Browser2 CSS/cases PASS4, same clock gate
FAIL; browser3 real 15s polling PASS (3/3 limit used, no further rerun needed).
Final attachment-focused browser PASS3 with image decoding, Escape/focus return,
file chooser keyboard, broken preview and retry/reload; supplier/clinic attachment
cases used 3 attempts, recovery case2. 14 distinct scenarios PASS across runs.
Desktop1440/mobile390 screenshots inspected in output/playwright/support.
Logs .tmp/support-files-*. Pending completion: final changed types/lint, API/web
builds/runtime smoke, dev restart and review/publication limited to this support scope.
Final web/UI/e2e types and changed-file lint PASS. API build1 and go_live web build1
PASS; runtime1 PASS. Verified canonical dev tree10032 (API14844/web3112) stopped
only for final builds. Generated web next-env restored to its initially clean HEAD
content; legacy next-env WIP preserved. Dev restart launched hidden, readiness
pending. Fresh origin/main == HEAD2fe8c1f; no earlier outgoing commits. Shared
OpenAPI/client/UI index contain foreign additions: stage only support hunks.

## Baseline support implementation evidence (before reference refinement)

Owner: current support side conversation, explicitly authorized by the owner on
06.10.2026 after the primary task's main work. Primary thread inspected idle;
no new agents/worktrees, no transfer/archive or changes to the primary registry.
Canonical root C:/Users/user/Desktop/dentmarket-kz-main, main@2fe8c1f.
Preserve existing Orders/Notifications, governance, legacy next-env and output WIP.

## Scope and verification plan

Implement the proposed support experience for supplier and clinic: compact first
ticket form; searchable/filterable list and conversation; authors, category,
clear validation/error recovery; responsive list/detail navigation and deep links;
draft protection, periodic refresh without losing history or typed input.
Inspect and complete bounded backend support for public-reply notifications and
explicit reopening of resolved/closed requests, preserving operator notes/privacy,
tenant permissions, transactional audit and idempotent retries. Reuse existing
upload/read semantics only when they can honestly support the proposed experience;
never invent unread counts or SLA promises. No external integrations or work DB writes.

Risks: tenant/linked-object exposure, duplicate writes, missed replies, stale data,
lost drafts, closed lifecycle and shared working snapshot. Contracts first;
focused service/schema/client tests after each backend unit before dependent UI.
Then targeted fixture browser supplier/clinic desktop1440/mobile390, keyboard,
create/reply/retry/filter/deep-link/closed/error/read-only states, visual inspection;
scoped lint/types, canonical web/API builds and runtime smoke as affected.
Use isolated PostgreSQL for changed transactions, replay and tenant isolation.
No broad release or unrelated full E2E. Max3 attempts/gate; checks20min/diagnosis15min.
Review own diff/hunks, preserve all baseline WIP. Commit/push own verified changes
under standing authorization only if independent publication is safe; verify SHA
and CI separately. Never publish another task's unfinished files/dependencies.

## Progress

Preflight complete; primary idle and owner-authorized scope confirmed. No changes
to application code yet. Existing API/create/operator queue inspected; gaps include
unlabelled authors, missing message events, no query search and closed replies.
Development Toolkit, Web Interface Guidelines and Agency UI Designer practices
selected for focused contracts, existing Fluent tokens and state/accessibility QA.

Implemented compact first form, category/inline validation, recent search/status
list with incremental loading, responsive deep-linked conversation, author labels,
draft/retry-key tab storage scoped to org+session (8h), polling with preserved
scroll/history, explicit reopening and transactional public-reply events. Existing
shared notification projector reused, with action-aware support copy only; preserve
foreign inbox methods/imports. No new uploads/personal-read persistence or picker;
those proposed later scenarios are explicitly distinguished from this redesign.
Contract: applications/support-workspace.md. Self-review applied Agency Code Reviewer:
tenant/private notes, operator management right, uncertain commit/retry across refresh,
scope of shared dirty files, no fake counts or SLA promise.

Evidence: service1 PASS10 + conversations4; schema2/client1 PASS1; isolated PG1
PASS (concurrent replay, tenant isolation, private notes, reopening, outbox rollback).
Schema build1, API/web/client types1 PASS; e2e types1+2 PASS. Lint1+2 PASS.
Browser1 PASS4/8:3 tests failed ambiguous Next route-announcer alert selector;
clinic fixture lacked profile. Browser2 PASS9/10: clinic actual flow passed but
unexpected city reference GET missing in fixture. Added named city fixture;
browser3 clinic+mobile2/2 PASS.10 unique cases PASS; no product failures in these
assertions. Browser2 also proves reload+same retry key, pagination beyond50 and
background message arrival preserving scroll. Visual desktop1440/mobile390 inspected
in output/playwright/support; compacted mobile toolbar, verified in browser3.
Logs .tmp/support-browser{1,2,3}.log. Required budgets/attempts retained.
Dependent notifications9/outbox6 PASS1. Final review added operator-manage guard
for reopening and action-aware notification copy: service11+support projection2+
notifications9 PASS2, isolated PG2 PASS with new operator denial. No UI rerun needed
for backend-only guard/copy. Own browser fixtures never reach the work DB.

Canonical dev launcher7484 tree (API3172/web1436) provenance verified and stopped
for final builds; no other project processes stopped. API build1 + go_live web
build1 PASS. API rebuild/runtime smoke after final guard/copy, dev restore, own
diff/staging review and publication remain pending. Primary inspected idle again;
Orders/Notifications/governance/legacy next-env WIP still preserved.

Final API build2, backend lint3 and runtime smoke1 PASS after review guard/copy.
Commands: npm exec --workspace @marketplace/api -- vitest run <support service,
support notifications and notifications service specs>; npm run db:test -- exec
--workspace @marketplace/api -- vitest run src/modules/support/support-workflow.postgres.spec.ts;
npx --no-install playwright test --config apps/e2e/playwright.support.config.ts
(final targeted clinic/mobile grep in attempt3); scoped npm run typecheck for
web/API/api-client/e2e, scoped eslint, npm run build for schemas/API/web (go_live
for web), node scripts/verify-runtime-split.mjs. No schema migration/core-purchase
contract change; full release/whole E2E NOT_RUN by proportional scope.
Web build generated next-env restored to its verified initial HEAD content only.
Fresh origin/main equals HEAD2fe8c1f; outgoing range empty. Canonical npm run dev
restoration launched hidden; readiness pending. Remaining: own-hunk stage review,
commit/push main, remote SHA and actual CI status. Do not stage foreign inbox
imports/methods in notifications service or client; only own changed support lines.
