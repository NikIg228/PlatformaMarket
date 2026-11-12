---
name: market-change-commerce-domain
description: "Implement or review PlatformaMarket order, pricing, inventory, payment, agreement or document behavior across NestJS services, Prisma transactions and shared API contracts."
---

# PlatformaMarket Commerce Changes

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Locate the existing flow using the [domain index](../../../actual_docs/domains/README.md), relevant ADR and task evidence. Record the observable result, affected actors, transaction/version boundary, audit/outbox effects and required UI before implementation. Separate a code gap from missing evidence or an unresolved policy.

For a core API change, update Zod in `packages/schemas`, request/response/error contracts, OpenAPI and `packages/api-client` with the server. Keep NestJS controllers as orchestration and business invariants in existing domain services; preserve the modular monolith.

Authorize tenant and actor before reading or writing organization data. Use the existing exact money representation in minor units; do not calculate exact money with JavaScript `number`. Revalidate price, stock and availability before checkout and show a material diff before accepting a changed version. Keep supplier admission/common terms distinct from optional buyer-supplier agreements.

Use transactions, version checks and durable idempotency for concurrent stock, reservations, payment and state transitions. A provider timeout is not proof of failure: reconcile the prior operation before creating another. Preserve compensation, audit/outbox and immutable document/version evidence.

Prisma schema changes require an intentional migration, validate and upgrade-path checks; never edit applied migrations. Test mutations only on verified disposable data. Required user actions and recovery belong to the same DoD as backend logic.

Run focused tests after each coherent service/API behavior before dependent work, then use [verification](../market-run-verification/SKILL.md). Report contracts, permissions, money/stock invariants, migration/env effects, checks and remaining acceptance.
