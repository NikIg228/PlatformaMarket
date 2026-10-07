# FILTER-TAB-STATES-2026-10-07

Owner requests remove active filter underline across consumers, remove clipped
side focus borders from Settings tabs, document distinction in design system.
Base main0e41377. Preserve three existing handoff metadata changes. One executor.
Scope: shared CSS + orders local override removal + filter TabList markers.
No backend/data or selection logic changes. Risk shared focus/keyboard visibility.
Checks: inspect orders/settings/products/notifications consumers, desktop/mobile
pointer and keyboard visual checks, UI contract guard, web/UI types, scoped lint.
Build required at completion; do not run concurrently with canonical Next dev.
Existing CI/Security failure blocks publication; do not repair unrelated CI.


Implemented: removed orders local active underline; shared aria-pressed tab
filter styling; marked products/notification page/notification bell filter TabLists.
Navigation Tab focus suppresses Fluent shadow and generic outline with adequate
specificity; interior background + dotted text focus retains selected underline.
Manual Chrome: orders active border0/background brand.soft; products and bell
filter pseudo-elements display:none; Settings ArrowRight focus outline/shadow none,
selected organization underline preserved; 390px Settings no page overflow.
Initial browser locator evaluation hit two tool/CDP timeouts; read-only page DOM
evaluation succeeded, not an app failure. Initial CSS specificity left outline;
fixed selector, recomputed root and pseudos none, mobile screenshot inspected.
PASS: web/UI typecheck, scoped eslint, verify:ui-contract (final329 files), diff check.
Build PENDING: canonical Next dev from primary remains running; shared .next
prohibits concurrent build, and AGENTS forbids stopping another task's process.
No commit/push until required completion gate; existing CI/Security FAILURE also
remains. No data writes. All changes remain in canonical working tree.
Next: coordinate canonical dev pause/build/restart with primary ownership, then
review own scope for commit; do not stage handoff metadata or repair CI implicitly.

Owner follow-up: make design-system authority and shared reuse explicit for all
future tasks. Updated DESIGN_SYSTEM and AGENTS: no local control copies/overrides,
including token-based overrides; feature composition allowed; missing variants
require scoped shared extension and consumer checks. Docs-only, no new runtime
changes; previous build/publication blocker retained. Diff hygiene PASS.

Publication authorization: owner explicitly requested push in direct response to
the reported build blocker. Publish reviewed scope with build still NOT_RUN and
previous CI/Security failures disclosed; no claim of release readiness. Existing
web/UI types, lint, UI guard and browser evidence reused for unchanged inputs.
Foreign handoff metadata excluded. Fetch confirmed origin/main is ancestor.
