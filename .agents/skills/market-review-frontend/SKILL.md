---
name: market-review-frontend
description: "Implement or review PlatformaMarket Next.js interfaces using shared Fluent UI controls, typed API clients, localized states and browser evidence."
---

# PlatformaMarket Frontend

Read [AGENTS.md](../../../AGENTS.md) and the task-relevant [Workflow](../../../actual_docs/governance/DEVELOPMENT_WORKFLOW.md). Preserve the current request, personal rules, existing evidence and unrelated work. Review-only requests stay read-only. A skill does not authorize new phases, delegation, live effects or another source checkout.

Read the affected app's AGENTS.md, [UI standard](../../../actual_docs/ui-ux/UI_UX_IMPLEMENTATION_STANDARD.md), [design system](../../../actual_docs/ui-ux/DESIGN_SYSTEM.md) and its two JSON contracts. Follow the personal UI skill routing; preserve approved design and previous fixes. A small copy change does not authorize a redesign or repeated approval.

Trace the canonical `apps/web` route to imported features in buyer/supplier/admin/landing apps. Reuse `packages/api-client` and Zod contracts instead of local undocumented DTOs. A functional flow must expose the real authorized backend result and recovery.

Compose Fluent UI v9 through `packages/ui` adapters/tokens. Feature CSS may arrange layout; it must not clone standard controls or override their geometry, typography, colors or focus. Inspect consumers before a shared variant change; obtain only genuinely missing decisions on shared parameters.

Use shared `LoadingState` with a localized action/object. Preserve the shell and same-context data on refresh, form input on errors, and safe repeat actions. Check empty/forbidden/error/success/conflict states, reprice differences, labels, keyboard, focus return, responsive layout and affected locales. Do not transplant CRM terminology rules over Market's approved clinic/supplier/operator vocabulary.

Capture and visually inspect screenshots plus computed styles for the affected surface; exercise changed controls. Build/types and screenshots alone do not prove the complete flow. Use [verification](../market-run-verification/SKILL.md) for completion gates. Report observed UI/API behavior, personal skill requirements applied, evidence and unverified limits; unavailable browser acceptance is not PASS.
