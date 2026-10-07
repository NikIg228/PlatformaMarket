# DOCUMENTS-REDESIGN — реестр закупок и продаж

Owner: UI continuation01a11795-17a2-7f52-9e7d-b3314bf87ed7.
State: LOCAL_PASS. Publication/CI receipt is recorded in the final task response;
the source snapshot is the Git commit containing this checkpoint.
Explicit owner approved references and implementation08.10;
wait for primary completed: main5d24ae5507cef32574d6ff9e3b1a2a95063a9d66,
primary idle/completed verified. Canonical root only; no agents/worktrees.
Baseline dirty: three historical handoff metadata and Next-generated web
AGENTS.md/CLAUDE.md, preserve/exclude. Registry ownership unchanged.

Scope R7.1/R7.2 slice: clinic/supplier Documents registry, search/counterparty/
period/extra filters, grouped states, real related documents by supplier order,
right detail panel/mobile dialog, upload/download/history/accounting retained.
Move supplier agreement and organization credentials to Settings with old-link
compatibility. No fake signing, PDF preview, bulk/export/delete or integrations.
Reference is composition guidance; DESIGN_SYSTEM and both JSON contracts win.

Plan/risk: additive read-only archive group filter, identical to existing summary,
contract/schema before server/UI; preserve tenant access and cursor pagination.
Focused schema/service/client tests before UI. Reuse shared adapters and tokens;
extract new registry/detail components, preserve legacy entry compatibility.
Completion: affected types/lint/UI-contract, targeted fixture browser both roles
1440/390 incl keyboard, empty/error/retry, filters/paging, related links, upload
draft and accounting permission/recovery; inspect screenshots/computed styles;
API/web build and relevant dependent suites. No DB writes/migration/full E2E.
Max3 attempts per blocker. Record attempts/evidence below. Own reviewed commit/
ordinary push to origin/main after PASS, verify remote SHA and CI snapshot.

Current: implementation and required checks complete; ordinary publication authorized.

Implementation: schema query.view + server intersection with tenant/search/cursor;
OpenAPI ApiCoreQuery derives same schema; client typed generic transport tested.
Schemas build1 PASS; schema4/client1/server55 tests PASS (commands: npm run test
--workspace @marketplace/schemas -- document-archive-query.test.ts; analogous
api-client document-relations.test.ts; API documents.service.spec.ts,
document-reference-isolation.spec.ts, document-consolidation-security.spec.ts).
New canonical DocumentRegistry/detail/counterparty components; legacy archive UI
unchanged apart from additive types/exports. Supplier legal/credentials moved to
Settings documents tab; notification/dashboard/old organization link updated.
Web types1 FAIL Option text required, fixed; types2/API1/UI/client/e2e1 PASS.
Scoped ESLint1 and UI-contract1 PASS. Browser registry1 two tests FAIL ambiguous
button selector; corrected. Registry2 same two FAIL omitted cities fixture;
corrected. Registry3 PASS7/8: both roles1440/390, groups/paging/empty/list error,
related/detail denial/retry, accounting draft/retry, legacy Settings link.
Upload scenario first execution failed label exact-match required-star; upload
focused attempt2 PASS. Mobile screenshot showed animation in progress; added
settled visual proof, first attempt exposed full100vw shifted15px due scrollbar.
Fix panel composition to left0/width100%; mobile visual attempt2 running.
Evidence output/playwright/documents-registry-{1,2,3,final,mobile-2}.
Remaining: mobile visual acceptance, final relevant types/lint/guard, API/web build,
runtime check, reference manifest, scope/security review, docs and commit/push.
Dev canonical verified tree root17436 with Next absolute source path; preserve
until final browser complete, stop exact tree for build then restore npm run dev.

Final UI: upload retry2 PASS; registry7+upload1+settled mobile1 =9 unique cases.
Mobile visual2 fixed origin but retained scrollbar gap; width100vw anchored left0,
attempt3 PASS position/width/opacity, Escape/return focus. Screenshot inspected:
`output/playwright/documents-registry-mobile-3/` (final); desktop/bothroles in
registry3, earlier animation screenshot not accepted as final mobile evidence.
Accounting returns committed record directly, avoids treating summary refresh
failure as failed save; focused accounting recovery rerun PASS. UI-control
computed evidence upload44px/min, radius8px, font14px. API build1 PASS;
UI-contract2 PASS342 sources, final changed-scope ESLint2 PASS. Web go_live build1
in progress. Runtime/OpenAPI and final affected types pending collection.
No production/live DB writes; API migration/schema unchanged.

Read contract: `GET /documents/archive?view=AWAITING_SIGNATURE|ATTENTION|ARCHIVED`
intersects (AND) tenant predicate and all existing filters. Awaiting includes
partially signed; attention includes FAILED/REJECTED/EXPIRED or accounting
PENDING_REVIEW/DISPUTED, matching summary. Cursor/limit unchanged; unknown group
400. Counterparty selector performs bounded existing archive search (100) and
asks to refine when more results exist. Related section independently paginates
the same authorized endpoint by supplierOrderId. No browser-only fake filtering.
Legacy buyer/supplier entry UI preserved; new registry only used in apps/web.
Reference passport/prompts/images: output/imagegen/documents-redesign-2026-10-08.

Completion: API build1 PASS; go_live web build1 PASS (including TypeScript),
runtime split1 PASS, OpenAPI3 PASS. Final UI/client/e2e and web types PASS;
scoped lint/guard final PASS. `git diff --check` PASS. No dependencies installed.
Commands: `npm run build --workspace @marketplace/api`; `$env:DEPLOYMENT_PROFILE=
'go_live'; npm run build --workspace @marketplace/web` (log .tmp/documents-web-build-1.log);
`node scripts/verify-runtime-split.mjs`; `npm run test --workspace @marketplace/api
-- src/platform/openapi/runtime-swagger.spec.ts`; `npm run typecheck --workspace
@marketplace/web` and `--workspace @marketplace/ui --workspace @marketplace/api-client
--workspace @marketplace/e2e`; explicit changed TS/TSX list via `npm exec -- eslint
<owned paths> --max-warnings=0`; `npm run verify:ui-contract`.
Browser: `npm exec --workspace @marketplace/e2e -- playwright test --config
playwright.workspaces.config.ts tests/documents-registry.spec.ts`, scoped retries
`--grep 'upload retains|settled visual'`, then `'settled visual|accounting draft'`.
No remaining failed acceptance: initial attempts retained above, only affected
cases retried. Self-review: no additional required findings, no independent agent.
Source remains sole writer; primary confirmed idle. Fetch origin/main=5d24ae5,
outgoing baseline0/0. Historical metadata/generated instruction files excluded.
Dev restore1 direct launcher refused missing npm environment (no runtime started);
restore2 through canonical npm run dev started, awaiting readiness.

Restoration2 PASS: canonical launcher7128 (npm wrapper17516), ready message;
HTTP200 API4012 readiness and clinic/supplier Documents3000. No working data changed.
Next-generated next-env returned to baseline; three historical handoff files and
web AGENTS/CLAUDE preserved/excluded. Owned25 staged paths reviewed; secret-pattern
and Markdown-link checks PASS. Remote baseline verified fast-forward0/0.
No unfinished implementation remains. CI is a separate post-push snapshot;
do not infer CI PASS from local checks or automatically start its repair.
