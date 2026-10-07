# DESIGN-SYSTEM-2026-10-07

Owner request: единый источник истины параметров компонентов и дизайн-токенов.
Executor: PlatformaMarket UI; docs/rules-only authorization, primary product ownership unchanged.
Base: main75dab02. Preexisting handoff changes in project-session.json,
PROJECT_HANDOFF.md and PRIMARY-SESSION.md preserved and excluded from staging.

Plan: consolidate normative rules in DESIGN_SYSTEM.md, retain two disjoint JSON
value contracts, preserve historical audit, route legacy links and correct light-only.
Risk: stale duplicated rules or broken links. No runtime/token/API changes.
Checks: link existence, manual source consistency, preserved audit, diff hygiene.

LOCAL_DOCS_PASS: 142 local Markdown links checked using Node; git diff --check PASS.
Compared component-contract.json, semantic-light.json, provider.tsx and font layout.
Old theme audit retained verbatim under historical scope. App/build/browser/DB
checks NOT_RUN: documentation-only. Existing CI/Security FAILURE on base commit
(runs37654735114/37654735057, recorded by primary) remains unresolved, not PASS.
Publication BLOCKED by existing failed gates; no CI repair in this task.
Commit only these docs, no primary registry/handoff or product changes.
Next step for publication: resolve existing CI/Security failures in an authorized
primary task and verify applicable gates, then publish reviewed outgoing scope.
