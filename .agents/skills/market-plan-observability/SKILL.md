---
name: market-plan-observability
description: "Design or review PlatformaMarket API, worker, outbox and provider observability for actionable signals and safe telemetry."
---

# PlatformaMarket Observability

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read [observability](../../../actual_docs/operations/observability-runbook.md) and the affected runtime path. Define the user impact, diagnostic question, existing signal and recovery owner before introducing telemetry. Review requests produce proposals, not implicit production changes.

Trace request/organization context across NestJS API, PostgreSQL transaction, outbox/BullMQ worker and external adapter. Keep durable business/audit facts distinct from operational logs. Use bounded metric labels; do not place customer text, credentials or unbounded entity IDs in labels.

Capture latency, failures, retry backlog and ambiguous provider outcomes where they explain the selected flow. Health/readiness must reflect serving dependencies and not claim a durable operation succeeded from an HTTP response alone. Preserve existing profile/production guards.

Reuse safe request/correlation IDs and sanitize logs, exception context and third-party payloads. Alerts need a concrete threshold/window, owner, diagnostic path and recovery step; do not invent SLA/RPO targets while owner decisions are open.

For authorized implementation, verify controlled failures emit useful signals without leaking data, then select checks from [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Report observed signals, privacy/cardinality boundaries and remaining blind spots.
