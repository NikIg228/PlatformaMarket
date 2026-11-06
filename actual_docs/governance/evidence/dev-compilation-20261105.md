# Dev compilation — supplier routes, 05.11.2026

Owner reported slow page transitions, requested log review, then explicitly
«приступай» after proposal to profile supplier dashboard/products and narrow
unnecessary imports. Scope: measured frontend compilation improvement preserving
UI/design/contracts. No cache deletion, dependency upgrade, data mutation,
Webpack switch or unrelated cleanup. Leave the requested dev running at end.

Canonical main@5161af7 ahead7, earlier cleanup/A07/product staged+unstaged WIP
preserved. Current owned dev launched by `npm run dev`, exec session61896,
log `.tmp/dev-request-20261105.log`; frontend PID6956, API2552 at initial review.
Successful dev3000 launch does not retroactively pass earlier A04/A07 fixture gates.

## Baseline and plan before edits

Actual initial dev log: /16.9s(next16.5), /supplier15.5s(next14.4),
/supplier/products12.0s(next11.5). Subsequent supplier971ms; recent API9–96ms,
no observed500. Not a CPU flamegraph and not evidence of exact slow compiler task.

Current warm HTTP samples (3 sequential per route), HTML initial script URLs,
local source maps from exactly those dev chunks: `.tmp/dev-compilation-before.json`.
/supplier16,645,394rawbytes/1372sources/77UI/431Fluent;
/supplier/products16,623,707rawbytes/1370sources/77UI/431Fluent.
Both include conversation editor/history, order workflow, document registry and
member management although those screens do not use these functions.
Measured dev JS contains development/debug overhead; not production payload.
Dashboard warm867/129/511ms, products273/68/68ms (unauthenticated shell HTTP).

Read installed Next16.4.3 docs local-development, optimizePackageImports and
Turbopack. UI package already listed in optimizePackageImports; Fluent root
packages are not. First bounded hypothesis: add Fluent packages to the supported
optimizer, remeasure same HTML/source-map inputs. If no change, do not retain
ineffective tuning; inspect explicit module entrypoints/barrel boundaries.
Secondary confirmed source coupling: ConversationCounter lives in the full
ConversationWorkspace module; Products eagerly imports OfferPanel and editors.
Do not change loading lifecycle until necessary and tested.

Risks: shared client import boundaries, styles/provider/permissions, overlay
focus/loading/recovery if splitting components. Checks chosen by final diff:
before/after module/payload evidence and warm samples (cold-time comparisons must
state cache differences), web/UI types, scoped component regressions where code
changes, final unified build/bundle and lint; representative supplier dashboard,
products and shared consumer in browser including keyboard/mobile if UI lifecycle
changes. No full-project DB suites for import-only frontend changes.
Development Toolkit performance/frontend/verification, existing design system,
Taste app-screen preservation and existing antislop DURING apply; no art direction,
tokens, new assets or visual redesign authorized.

## Hypothesis1

Added Fluent components/icons to optimizePackageImports, dev auto-restarted.
`.tmp/dev-compilation-fluent-1.json`: byte/module counts exactly unchanged on
both routes. Removed this ineffective config edit; pre-existing standalone stays.
First supplier request7568ms after restart vs original cold15500ms is NOT a
comparable speedup (filesystem cache and request history differ). Do not claim it.

## Implemented bounded import change

13 reachable shell consumers now use explicit public UI entrypoints; six exports
added without dependency/version changes. ConversationCounter moved verbatim to
its own client module, with a type-only ConversationApi import and compatibility
re-export from conversation-workspace. Polling, visibility, failure, copy, styles
and permissions are unchanged. No lazy editor lifecycle change was needed.

Same initial HTML script/source-map measurement after direct imports: supplier
15,408,584 bytes/1301 sources/31 UI; products15,387,227/1299/31. After separate
counter: supplier13,428,665/1074/24; products13,407,439/1072/24. About19.3% fewer
raw initial dev bytes and298 fewer source modules. These are unauthenticated
initial-shell script lists, NOT all authenticated route chunks, production bundles
or CPU profiling. Final warm samples supplier158/164ms, products116/104ms;
small sample and cache differences do not prove cold compile speedup.

Checks: four workspace typechecks(ui/web/buyer/supplier) PASS1; existing counter
RU/KK SSR tests2 PASS1 (requested conversation-workspace.test.tsx does not exist,
only counter test was selected); scoped ESLint PASS1. Three application builds
running, log .tmp/dev-compilation-build.log.

Browser gate BLOCKED: CUA Chrome create/getTab/nameSession calls failed three
times before page access with internal undefined timeoutMs. No permission denial,
no browser assertion/screenshot/computed-style PASS. No more attempts against
this unchanged blocker. Authenticated routes and shared buyer consumer remain
unverified in browser. Do not claim complete acceptance or commit/push yet.

## Completion checks

All3 builds PASS1: npm run build --workspace @marketplace/buyer-web --workspace
@marketplace/supplier-web --workspace @marketplace/web. Buyer and supplier scripts
include their bundle gates; unified build completed all routes. Build-generated
web next-env imports restored to pre-task HEAD baseline (clean before build).
Source comparison proves counter function body unchanged; source-map check proves
order workflow/document registry/member management/conversation editor absent
from measured initial scripts. git diff --check PASS.

Implementation locally prepared; browser gate remains BLOCKED, no full acceptance.
No commit/push, no staged changes, no data writes/deploy/new dependencies. Existing
WIP preserved. Requested dev stays running. Next exact step: when browser control
works, verify authenticated supplier dashboard/products and representative buyer
shell, keyboard navigation and console errors; then scope review and Git closure.
