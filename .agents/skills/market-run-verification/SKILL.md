---
name: market-run-verification
description: "Select and report PlatformaMarket checks for docs, NestJS APIs, Prisma, Next.js UI, integrations or release candidates. Uses the current Workflow instead of a duplicated gate list."
---

# PlatformaMarket Verification

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read the current task scope and [Workflow risk matrix](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md#4-матрица-проверок). Inspect actual `package.json` aliases and prerequisites before executing them. Use npm and the canonical checkout; test isolation means disposable DBs/ports, not another worktree.

Select by behavior and blast radius. Docs/rules need links, examples, consistency, new-file review and working/index/actual committed-range diff hygiene, not app installs/builds/DB/browser suites. Strict read-only analysis writes no evidence files. Rule-only maintenance reports in the final response without product-status or other-task checkpoint edits.

Backend changes need focused isolated tests after each coherent service/API/state transition before dependent work; completion adds affected/dependent suites, API types/build and applicable Prisma validate/migration/upgrade checks. Include happy/invalid, role/tenant, exact money/stock, rollback, concurrency, idempotency and recovery where affected.

UI changes need affected build/types and actual reachable behavior. Capture and visually inspect screenshots/computed styles, exercise controls and applicable states/locales/keyboard/viewports under the personal UI rules and project design system. Shared changes require representative consumers; browser absence remains unverified.

Keep mandatory purchase-contract, PostgreSQL, runtime-split, production-config and composition gates from Workflow when their risk applies. Full E2E/release is for the explicit candidate/cross-cutting boundary, not routine completion or a large file count. Do not pass unsupported filtering flags or bypass alias prerequisites.

Verify source/profile, fixtures, disposable DB target and existing processes before costly runs. Never reseed working data, alter freshness/auth or enable providers to obtain PASS. Ordinary tests isolate external effects; live acceptance needs its own authorized target and receipts.

Reuse PASS only for unchanged relevant source/dependencies/config/fixtures. After a failure preserve exact evidence, change the hypothesis/inputs as required by Workflow retry limits, and recheck the affected fix. Do not weaken acceptance or reset attempt counts by changing tools.

Report commands/results/skips, exact candidate/dirty boundary, proven acceptance and blockers. Local verification, commit, push, CI and deployment are separate claims. After authorized implementation, follow AGENTS section 8 for task-only commit and normal push; foreign outgoing commits or failed gates block publication, not permission to include unrelated work.
