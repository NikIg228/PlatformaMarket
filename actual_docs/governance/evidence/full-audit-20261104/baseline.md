# Full Market audit — baseline and execution plan

Status: IN_PROGRESS. Owner confirmed the full 19-section audit brief on 2026-11-04.
This expands the previous 2026-11-03 audit; previous PASS is evidence only when
relevant inputs are proven unchanged. No completeness claim before reconciliation.

- Canonical root: `C:/Users/user/Desktop/dentmarket-kz-main`.
- Branch: `main`; HEAD: `af7149699aac16c0127df6852b231fb66f00b08b`.
- Four local commits ahead of origin/main; publication forbidden for this audit.
- No submodule entries; one registered worktree, the canonical root.
- Existing modified files: PRIMARY-SESSION.md and apps/web/AGENTS.md.
- Existing untracked output: CRM_ALERT_COMPONENTS_SPEC_2026-11-02.md;
  catalog-controls-20261031, roadmap-coverage-review-20261029.md,
  security-remediation-20261028, stand-access-20261029, stand-access-live,
  storefront-review-20261031. These remain part of the baseline, not audit ownership.
- Tools: Node24.18.0, npm12.0.1, Git2.54.0.windows.1. Lock digests in inventory.
- Desktop status inspection: this Market thread active, separate CRM audit active,
  other Market Security chat notLoaded. This is observation, not a guarantee of
  immutability. No messages sent to other chats. Existing local subagents completed
  prior work; three explicitly reassigned to this audit by owner-authorized delegation.
- CRM is read-only and limited to cross-project contracts. Hash its actual inputs.

## Scope and protection

Account for every tracked/untracked/ignored/hidden file, link and actual external
source. Fully read every own text source/test/config/migration/script/document,
including archive and legacy. Installed dependencies/build/cache/data get explicit
categories and review methods, never silent omission. Secret values are not output.
Audit-created files are accounted separately to avoid recursive self-coverage.

No product/config/dependency fixes, working DB writes, real external side effects,
push/merge/deploy, infrastructure purchases or other-chat messages. Separate local
audit scripts/docs and isolated diagnostics allowed. Experimental snapshot only
if necessary and explicitly distinguished from original product. Do not overwrite WIP.

## Plan and gates

1. Freeze manifest, Git state, safe config identities, toolchain and file categories.
2. Read all owned text with hash-bound range ledgers; build modules, routes, API/jobs,
   roles, requirements, processes and transitions maps. Reconcile prior findings.
3. Derive tests from all processes/guards; execute isolated real PG/API/browser and
   available failure/load/recovery scenarios. Every route opened or concrete blocker.
4. Independent security/dependency/manual threat passes; validate severe findings.
5. Review operations/mobile/CRM contracts/docs, record unavailable prerequisites.
6. Reconcile manifests, coverage and links automatically; final state drift check.

Risks: auth/tenant/money/stock/concurrency, external effects, fixture contamination,
running dev/build collisions and moving WIP. Use disposable dentmarket_audit_20260914
only after identity check; no working data clones. Runtime/build coordination by root.
Per-gate defaults: probes2min/startup5min/build20min/suite45min; max3 attempts,
with preserved earlier blockers and concrete changed premise before retry. No global
task deadline. Unavailable independent gates do not stop available audit work.

## Ownership

- backend worker: all own apps/api text, Prisma, backend API/jobs/states maps.
- frontend worker: other apps and packages, all own text/tests/config, routes/actions.
- documentation worker: own docs outside apps/packages, entire archive/history,
  requirements and existing findings reconciliation.
- root: exhaustive manifest, scripts/infra/tooling/data/static assets/external refs,
  dynamic orchestration, cross-module validation, merged evidence and completion.

Outputs under this directory; diagnostics `.tmp/full-audit-20261104/`.
Each worker owns its subdirectory only. No product-task ownership is transferred.
