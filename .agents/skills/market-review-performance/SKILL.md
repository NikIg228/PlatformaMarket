---
name: market-review-performance
description: "Measure and improve PlatformaMarket API, Prisma, worker or Next.js performance while preserving tenant, money and transaction correctness."
---

# PlatformaMarket Performance

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Trace the affected flow and read its contracts before optimizing. Record representative latency, query count/plan, payload, queue lag, rendering or bundle evidence. Missing load evidence is not proof that a rewrite is needed.

Scope Prisma queries before aggregation, pagination and caching. Diagnose N+1 work, unbounded exports/imports, expensive serialization and indexes against real filters. Preserve exact totals, freshness/reprice, authorization and idempotency when changing cache or batching behavior.

In `apps/web`, follow imported feature callers and server/client boundaries; measure waterfalls, duplicate fetches and rendering with the correct build/profile. Preserve shared UI and loading/error states. Use virtualization only when the measured workload justifies it.

Use bounded synthetic data and isolated services for expensive tests; production load requires a separately authorized target. Compare the same inputs and cold/warm assumptions before/after. Prisma index changes still require migration/validate/upgrade checks.

Choose affected gates via [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md); do not run full load/release suites for every optimization. Report measurement, cause, minimal delta, correctness checks and limits; no invented speed claims.
