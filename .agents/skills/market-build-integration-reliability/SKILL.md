---
name: market-build-integration-reliability
description: "Implement or review PlatformaMarket ERP, import, payment, signing or delivery adapters for authentication, idempotency, recovery and provider evidence."
---

# PlatformaMarket Integrations

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read the selected [integration contract](../../../actual_docs/domains/integrations.md), [readiness registry](../../../actual_docs/integrations/connector-readiness.md) and provider-specific runbook. Determine actor, organization binding, source authority, credential scope and supported configuration before adding mapping or calls.

Reuse NestJS integration/provider services and shared schemas. Preserve authenticated webhooks, encrypted credentials, masked errors/logs, outbound request controls and bounded timeouts. Normalize provider-specific data before invoking domain services; do not let a callback bypass money, stock, tenant or agreement rules.

Use stable idempotency identities, transaction/outbox boundaries and replay-safe compensation. Test duplicate/out-of-order callbacks, ambiguous timeout, partial success, retry/reconcile and revocation. For ERP, preserve field-level price/stock authority, UOM, freshness and local/external reservation accounting without double subtraction.

Participant ERP setup is self-service in clinic/supplier cabinets; the required setup and error/recovery UI belongs to the feature. Existing support-ticket behavior is not the target contract. Do not invent clinic exchange policy or promise every 1C configuration.

Ordinary automated checks mock external providers. Separately authorized live acceptance must name target, effects and real evidence; INTERNAL_READY is not LIVE_VERIFIED. Access to a credential does not authorize activation or a paid call. Select gates through [verification](../market-run-verification/SKILL.md), then report provider/config boundary, effects, receipts and limits.
