# Orders and notifications UX — 06.10.2026

Owner: side conversation 01a10c68-833b-7523-9be1-a556a7c51ab8, explicitly authorized
by user after primary finished. Primary 01a0fd63-0ae1-71e2-a4d4-271515cf0d40
verified idle; product working tree clean. Sole current writer for this scope.
Baseline canonical main@0a384e894b67634e6568c65615d36e28f6a62e68.
Preserve foreign governance5, legacy next-env4 and output artifacts.

## Scope and design

Implement approved supplier orders list/detail and clinic/supplier notification
popover + history using generated desktop/mobile references. Shared order UI
must preserve clinic behavior. List toolbar contains analytics and refresh beside
freshness; server-backed quick groups, separate payment/fulfillment states,
mobile cards. Detail: identity, actual current status/next action, truthful stages,
structured items, grouped payment/shipment/documents/history; terminal states
must not promise further payment/shipment. Preserve existing command permissions,
versions, idempotency and money arithmetic. No invented data or images.
Notifications: contextual popover anchored to bell, mobile adaptation, clear
localized business events, unread/category controls, specific links, compact
history, truthful unread scope. No auto-read on opening; no commercial mutation
from navigation. Use existing Fluent primitives and current DmSearch conventions.
References: output/imagegen/orders-references-2026-10-05/*.png and generated
notification popover exec-4a9226a6-4503-4fc6-9e79-a1051f245de1.png in Codex images.

## Risk and verification plan

Contract-first for bounded reads/notification writes. Focused API tests after each
coherent service change, schema/client regressions, dependent order UI consumers.
Read filters must apply before pagination and preserve organization boundaries.
Focused browser fixtures: list filters/navigation, cancelled/partial/paid order
states, notification opening/closing/read/retry/new events, clinic/supplier,
desktop1440/mobile390, keyboard/focus, no horizontal overflow or lost form input.
Inspect actual screenshots against all approved references. Final scoped lint,
types and canonical web/API builds as affected, runtime smoke for API changes;
isolated DB/migration checks only if persistence changes require them. Never
write/seed working business DB. No full-project gate absent cross-cutting reason.
Max3 attempts per gate; 20min check /15min diagnosis budget; record failures.
No agents or worktrees. Verify running process provenance before any stop/build.
DoD: all authorized UI implemented, focused required gates and self-review PASS,
owned paths only conventional commit + push main, verify remote SHA and CI.

## Progress

Read-only recovery and scope preflight complete. No implementation/tests yet.
Next: inspect current order/notification contracts and server read paths.

06.10 progress: shared order group schema + SQL filters before paging, bounded
payment/return hints added; notification inbox contract, business-event allowlist,
localized presenter, tenant-scoped feed + snapshot-bounded bulk read implemented.
Legacy organization-wide read semantics explicitly retained, not misrepresented as
personal. No migration or business transaction changes. API/service tests first:
workspace-orders4 + workspace-offers3 PASS1. After corrected payment review enum,
orders4 + inbox6 + existing notifications9 PASS1 (19 total); schemas build PASS.
Shared order presentation model and5 regression tests authored (not run yet).
Orders list rewritten with URL filters, split statuses, toolbar and mobile cards;
UI unverified. Detail and notification components next; no completion claims.
No runtime restarted, no DB writes, no commit/push yet. All scoped types/build,
client/schema tests, browser and visual QA remain pending.

06.10 implementation continued: detail overview/items/payment/document sidebar,
truthful terminal status and persistent tab panels; supplier confirmation moved
to hero, existing workflow command/upload/retry logic retained. Payment review
settings remain accessible inside payment tab. Shared styles and presentation.
Bell popover + history, category/unread filters, server count, explicit read/readall,
new-event banner and request cancellation implemented. No auto-read. Document
notification deep-link opens existing inspector. Product events route to matching
section, with truthful section action label. Notification read race corrected.
Verification: UI types1 PASS, web types1 PASS, API types1 PASS; presentation5+
workflow-command5 PASS; client inbox1+workspace2 PASS. PostgreSQL inbox isolation/
snapshot/idempotency1 + notifications9 + inbox6 + orders4 PASS (20 tests) via
npm run db:test -- exec --workspace @marketplace/api -- vitest run ... .
API build1 PASS but runtime1 FAIL on bottom-position schema import (CommonJS TDZ),
canonical browser1 failed at same API startup; no browser cases ran. Moved import
to top; API build2 PASS, runtime2 currently running (.tmp/orders-runtime2.log).
Web build1 FAIL env mismatch (only public go_live specified); web build2 PASS
with both DEPLOYMENT_PROFILE/NEXT_PUBLIC_DEPLOYMENT_PROFILE=go_live. After final
hook/tooltip/duplicate invoice polish, web build3 currently running
(.tmp/orders-web-build3.log). Scoped lint1 PASS. e2e types1 PASS. New orders-ux
7 browser cases authored, unexecuted pending API runtime success and final build.
Canonical dev launcher16772 tree provenance verified and stopped for builds;
restore npm run dev after checks. Foreign files remain; own generated web
next-env change must restore only its baseline content before staging.
Next: inspect runtime/build outcomes, run targeted browser2 and visual QA; then
existing payment/retry/confirmation/refund critical consumers adapted for tabs,
final review/types/docs/owned commit+push/CI. No publication yet.

06.10 local verification: runtime2 PASS after import-order fix; final API build3
PASS after action-based inbox categories. PostgreSQL category predicate tested
against real JSON payloads (CANCEL=orders, REPORT_TRANSFER=payments) PASS. No DB
schema/migration changes. Client types1 PASS. Web builds after reference-driven
layout polish PASS; final-inputs build PASS; prior successful builds not treated
as retries of a failed blocker. Lint2 and e2e final types PASS. Remaining code
change is focused document-dialog keyboard correction below.
Browser2 canonical20/20 PASS: supplier+clinic desktop/mobile, payments/retry,
partial amounts, returns/reorder, confirmation, offline/search, inbox/history.
Visual review corrected sidebar whitespace and summary empty header, compact
notification filters/history, bell badge and mobile vertical timeline. All four
order references + notification reference inspected. Final desktop/mobile shots
in output/playwright/orders-ux inspected (animations disabled, scroll reset).
Browser3 on polished inputs11/12 PASS. New document deep-link case first attempt
FAIL at Escape after retry: focused retry button disappears and focus is lost.
All prior inbox/order cases PASS; HTTP403 recovery and read-on-navigation worked.
Fix: keep focus inside open document dialog after loading/error/content changes.
Focused lint PASS; web build running .tmp/orders-web-document-focus.log. Next:
check build, run only new document deep-link test attempt2. No broad rerun.
Final source review also preserved readall snapshot across pagination and releases
write busy state after filter changes. Read on notification link does not block
navigation. General notification read scope explicitly organization-wide.
Remote preflight origin/main==HEAD0a384e8; no outgoing commits or other source
writer. gh not on PATH; use github_fetch connector to query Actions by head_sha
(the fetch_commit_workflow_runs wrapper filters PR runs and is unsuitable).
Application contracts and UI standard updated; Acceptance Matrix/delivery record
still pending final test. Dev remains stopped; restore after test before delivery.

06.10 combined publication follow-up: owner explicitly authorized publishing all
remaining WIP; see PUBLISH-WIP-2026-10-06.md. Document deep-link attempt2 PASS
after the existing focus correction; isolated inbox/order/notification21 tests,
API types and client3 tests PASS on publication inputs. Canonical dev was already
restored by the subsequent UI task and used for the fixture check. Earlier
pending/stopped notes above are historical, not instructions to restart dev.
