---
name: market-handle-incident
description: "Diagnose PlatformaMarket deployment, database, queue or provider incidents. Live containment and recovery mutations require explicit target and effect authorization."
---

# PlatformaMarket Incident Response

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read [incident response](../../../actual_docs/operations/sla-incident-response.md), relevant runbook and current evidence. Establish affected participants, symptom/time, data or money risk and recent changes. Begin with read-only health, safe logs, queue/provider status and transaction evidence.

Separate facts from hypotheses. Determine whether a timeout represents unknown completion before replaying payment, reservation, signing or delivery actions. Preserve tenant boundaries, durable event identities and audit evidence.

Propose the smallest effective containment and rollback. Disabling providers, replay/purge, database restore, credential rotation, deployment and working-data correction require explicit authorized targets/effects; do not infer authority from this skill or a runbook command. Preserve evidence before destructive actions and do not stop others' processes.

Verify authorized recovery through the affected participant flow plus queue/provider/data invariants and a bounded monitoring window. One successful health request is insufficient. Apply Workflow retry limits; preserve failures and continue independent authorized work when only one path is blocked.

Report impact, facts, proposed versus executed actions, authorization, recovery proof, risks and next step. Do not invent ownership transfers, automatic follow-up tasks or production readiness.
