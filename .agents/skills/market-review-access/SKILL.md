---
name: market-review-access
description: "Review PlatformaMarket NestJS and Prisma access paths for tenant isolation, actor binding, role permissions and protected data. Use for endpoints, jobs, exports or cross-organization links."
---

# PlatformaMarket Access Review

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read [security](../../../actual_docs/security/security.md), the relevant organization/access contract and actual guards/services. Trace organization and actor from authenticated context through list/detail, related IDs, aggregates, exports, background jobs and file/document delivery. Never treat an untrusted tenant/actor header as authority.

Verify permissions before the Prisma query and again at sensitive execution boundaries. Check clinic, supplier and operator exceptions separately; platform scope does not imply participant access. Inspect related-entity ownership, field filtering, agreement/signing authority and current membership where the selected flow depends on them.

Check scoped bulk actions and non-enumerable denials. UI hiding cannot enforce access. Distinguish explicit development/test profiles from production guards; do not relax JWT, MFA or tenant checks to make fixtures work.

For implementation requests only, fix through existing guards/services and verify allowed, forbidden, cross-tenant, stale/revoked and replay paths as applicable. Report concrete findings with entry point, trigger, impact and minimal correction; keep unknown coverage separate from confirmed defects.
