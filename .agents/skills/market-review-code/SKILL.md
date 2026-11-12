---
name: market-review-code
description: "Review a PlatformaMarket diff or scoped implementation for correctness, contract compatibility and regressions. Review requests do not authorize edits."
---

# PlatformaMarket Code Review

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Establish intended behavior from the task and current contracts. Inspect the actual diff plus callers, schemas, permissions and tests that determine its effect; preserve others' WIP.

Prioritize tenant/actor boundaries, exact money, concurrent stock, state/version rules, idempotency and compensation. Check audit/outbox durability, document/signature integrity, migrations and provider failures where affected. Verify Zod, OpenAPI, typed client and reachable UI agree.

For Next.js changes, inspect the affected app's local AGENTS.md and installed framework guidance. `apps/web` composes features imported from buyer/supplier/admin/landing apps: those directories are not unused merely because their standalone entrypoints are legacy.

Check that required risk-based evidence exists for the actual candidate inputs. Missing environment evidence calls for verification, not a speculative rewrite. Report reproducible actionable findings with file/line, trigger, impact and correction direction; separate hypotheses and untested paths. If none are found, state the coverage boundary.
