# Root findings and operational boundaries — in progress

No product changes. Priorities below describe audit risk, not an authorized repair
plan. Backend/frontend findings retain their own IDs; do not count duplicated
cross-module observations as separate defects.

| ID | Priority / result | Trigger and evidence | Boundary / acceptance needed |
|---|---|---|---|
| ROOT-RUNTIME-001 / B001–002 | Medium, reproduced | api/index.js initializes without a shared pending promise; simultaneous cold requests initialize twice. Initialization failure maps every /api/health prefix to HTTP200, including readiness. Original-source VM diagnostic:2FAIL/1PASS. | Serverless path only; no live deployment probe. Fix acceptance needs concurrent cold-start and failed-dependency readiness, preserving normal request handling. |
| ROOT-OPS-001 | Medium, source confirmed | package.json exposes verify:supplier-cycle:csv/pdf/medstom directly. These scripts default to localhost:4012 and start a registration/write sequence without proving an isolated target. CSV lines94–118 create a registration then complete-development. | Modern jwt/go_live guards may stop later operations; the script itself is not isolated. These commands were not executed. Any future diagnostic must reject an unverified target before the first write. This does not condemn intentional operator seed/preparation commands as tests. |
| ROOT-IMAGE-001 / prior AUD-INF-01 | Medium, source confirmed | Dockerfile:22 copies the whole context. .dockerignore excludes outputs, .tmp and actual_docs but not output or root test-results. Existing output contains audit/stand materials. | No container built, no actual secret leak claimed. Local untracked files are not excluded merely by Git status. Validate a corrected inclusion policy with a synthetic canary and required-assets control in a separately authorized change. |
| ROOT-IMAGE-002 / prior AUD-INF-02 | Low hardening | Dockerfile has no USER directive; production compose retains no-new-privileges/read_only/cap-drop but does not select a nonroot user. | Effective image/runtime not executed. Review writable mount ownership and startup/migration behavior before changing identity. Not a standalone demonstrated exploit. |
| ROOT-DATA-001 | Medium provenance consistency |389 active catalog media entries combine aiGenerated, exactProductPhoto and SOURCE_UNVERIFIED; rendering selector checks only exact flag and URL shape. One sample's alt text calls it a category illustration. | Metadata inconsistency is confirmed; actual generation, rights and wrong-product identity are not. See assets-analysis.md. Do not replace/remove media without a separate decision. |

Additional conditional observations remain in analysis.md rather than being
inflated into confirmed findings: API/worker migration startup ordering, legacy
import/seed mutation semantics, uncaptured operational reports, historical generators
that overwrite documents, and provider/load/cloud prerequisites. A retained old
script is not automatically an active production path.

Current production dependency command npm audit --omit=dev --json exits1 with
10 moderate dependency records,0high/critical, one distinct minimatch advisory.
The two flagged installed nodes are3.1.5 and5.1.9; both lack the two-phase
optimization mechanism described in the [primary advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Bounded8-segment probe has1globParts each and normal positive/negative controls PASS.
This is evidence against that specific mechanism in those legacy implementations,
not proof of all-pattern safety or request-path absence. Scanner remains nonzero;
no dependency changes made. Exact command, lock/source hashes and limitations:
root/dependency-audit.json and root/minimatch-production-probe-1.json (paths relative
to audit directory). Earlier all-dependency artifact11records retained separately.

Requirements conflict DOC008 is owned by documentation: external13A15min/4h versus
repository5min/2h. Neither RTO/RPO target is silently selected here. Restore/load
execution remains blocked by the existing test-role CREATEDB limitation.

B-CAND026 applicability refinement: migration20260717162000_pdf_supplier_import inserts three ACTIVE rules for medical-device-low-risk, medical-device-implantable and medical-equipment, all with the affected requiredCredentialAnyOf. Original evaluator with those exact conditions/disclosures and synthetic otherwise valid lot facts returns PASSED for all3 missing-alternative cases; credential-present and missing-registration controls6PASS. Evidence compliance-seeded-rules-2.json. Actual deployed rule activation and real product classification were not queried; this is enforcement of configured application requirements, not a statutory/legal conclusion.
