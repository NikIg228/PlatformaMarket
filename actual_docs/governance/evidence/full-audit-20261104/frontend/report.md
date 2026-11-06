# Frontend exhaustive static review — 2026-11-04

Static reading is complete for the assigned frontend scope: **1136 unique own text files**, every recorded range covers the whole file, and final SHA256 reconciliation has **0 mismatches**. Five catalog JSON datasets were separately reviewed structurally; they are not claimed as full line-by-line reads. See `review-ledger.jsonl`, `coverage-summary.json`, `classification-exclusions.json` and `caller-test-graph.json`.

No product code, configuration, dependencies, working data or Git branch were changed by this worker. The review is against main af7149699aac16c0127df6852b231fb66f00b08b and the preserved initial working tree. Existing unrelated changes remain intact. Audit evidence is new. This completes delegated static work, not overall runtime certification.

## Findings and evidence limits

Subsequent runtime diagnostics were performed by root, not this frontend worker. See [root browser validation](../root/ui-findings-validation.md): mocked reachable-flow reproductions cover FE-FORM-002, FE-NUMBER-001, FE-RECOVERY-001, FE-SESSION-001, FE-FORM-001 and FE-DRAFT-001; Chromium with the original production CSP confirms FE-SIGN-001's connect-src block. The NOT_RUN labels below describe this worker's original static report and are superseded only for those precise diagnostics by root's evidence and its limits. No real backend/provider action or comprehensive visual acceptance is implied.

The separately delegated native snapshot review is complete: [native report](native/report.md),891 fully read text files across913 tracked entries, with zero final provenance/range discrepancies. Its branch differs from main and its runtime remains NOT_RUN.

Detailed triggers, code references and correction requirements are in `findings-in-progress.md`. The following are current-source findings; priorities are audit recommendations, not acceptance decisions.

| ID | Priority | Result | Reachable consumer / missing coverage |
|---|---|---|---|
| FE-SIGN-001 | P1 | Production connect-src excludes NCALayer loopback websocket required by identity signing. | Unified profile → ProfileIdentity → useIdentitySigning → eds-client. FakeSocket unit coverage cannot test CSP. Real production CSP/browser handshake NOT_RUN here. |
| FE-ERP-001 | P1 requirement gap | Supplier ERP connect action creates a GENERAL support ticket; self-service connection is absent from the inspected current flow. | Supplier settings sources and supplier products connection page → SettingsSources. Clinic settings expose no sources tab. SettingsIntegrationTax only updates existing bindings. Requirement precedence is to be reconciled with documentation owner; no external connection attempted. |
| FE-RECOVERY-001 | P2, potentially P1 for blocked order | Lost committed workflow response leaves a retained command that rejects a different next action after polling removes the original action. | Shared OrderWorkflowWorkspace on current order detail. Tracker unit tests retain exact retry but do not prove reachable retry after status transition. Browser dropped-response scenario NOT_RUN. |
| FE-REG-001 | P2 | «Исправить email» reuses original registration key; changed payload conflicts, while a replacement key also meets active-BIN conflict. | Unified register → landing register-screen. Root statically confirmed onboarding service semantics. Existing local auth success/reset tests do not cover correction. |
| FE-SESSION-001 | P2 | Delayed revoke of admin session A can remove newly stored B; receipt ID/status is also not validated. | Unified /admin → OperationsWorkspace settings → IdentitySettings → SessionManagement. Source chain includes available but omitted expected-session guard. Delayed response/runtime NOT_RUN. |
| FE-FORM-002 | P2 | Successful attribute/organization creation reads event.currentTarget after await; cleared React currentTarget throws and renders failure. | /admin catalog → FoundationManagement; organizations → OrganizationQuickCreate. Source call sites confirmed. Browser POST success → false-error sequence NOT_RUN. |
| FE-DRAFT-001 | P2 | Deciding correction A reloads every publication draft and discards unsaved value B. | /admin catalog → ProductCorrectionQueue. Reload explicitly reconstructs all drafts. Multirow browser regression NOT_RUN. |
| FE-NUMBER-001 | P2 | min=0.000001 with omitted step makes ordinary integer quantities native stepMismatch. | /admin access → SupplierControls; DmInput forwards attributes without step default. Browser constraint validity NOT_RUN. |
| FE-FORM-001 | P2 | Invalid damaged quantity or leading-zero actual quantity silently prevents discrepancy save without corresponding feedback. | Shared OrderDiscrepancyForm → panel → OrderWorkflowWorkspace. Shared schema rejects input; UI displays only incomplete subset of validation. Runtime NOT_RUN. |
| FE-PROMO-001 | P2 | Promotion product links omit offer identity; city injection/change can also drop offer and reset advertised variant/package. | ProductDetail → PromotionsStorefront; MarketplaceHeader delivery context → deliveryDestination. Main banner helper is correct; current E2E bypasses selected-offer CTA with direct cart insertion. Runtime NOT_RUN. |
| FE-QUANTITY-001 | P2 | Product quantity UI uses zero-based increment while backend/cart use minimum-offset increment. min3/step2 UI defaults4 and rejects3/5. | ProductDetail → SupplierOffers → organization/personal add. Existing supplier-quantity unit test locks the wrong result. Root pure-function probe reproduced mismatch; this worker did not run it or browser/live offer checks. |
| FE-LOC-001 | P2 | KK notification history and several order/dashboard destinations fall back to RU or drop lang. | Workspace locale-aware bell → untranslated notifications; orders links/reset and dashboard. Explicitly tested EN fallback is not treated as an additional new localization breach. Locale browser NOT_RUN. |

## Coverage and caller reconciliation

`caller-test-graph.json` records 3743 import/re-export/literal dynamic import edges, including relative and workspace package exports; 2132 resolve directly to reviewed files. External/unresolved edges are retained rather than silently called covered. Per-file reverse callers and directly importing tests are attached. A static import graph is not a runtime call graph: framework route conventions, CSS use, dynamic identifiers, API mocks and tests that read source as text require the manual findings mapping above and the per-file ledger notes.

Read scope includes unified route/shell/features, all imported legacy app sources and legacy entrypoints, all assigned E2E specs/fixtures/config, schemas and tests, API client and tests, shared UI and tests, EDS client and tests, 1C agent and tests, CSS, package/build/security configuration, templates, generated auth CSS, and both design JSON contracts. Installed dependencies/build caches/binary assets are classified separately and not represented as full authored-source reads.

Current /admin page re-exports OperationsWorkspace. Its access/catalog/settings/organizations branches explicitly mount the affected controls. Unified supplier order detail directly imports OrderConfirmationPanel and ShipmentPanel; ProductCorrectionsPanel is imported by current supplier product pages. SupplierTermsPanel is mounted through supplier documents (not SettingsSources). SupplierTrustPanel and the supplier root workspace are legacy entrypoint consumers, so their incidental deficiencies were not promoted to production findings without a current route.

Runtime, typecheck, build, test execution, screenshots and computed-style acceptance are **NOT_RUN by this frontend worker**; root owns execution and final evidence aggregation. Source tests read in full do not count as passed tests. Earlier historical PASS is not reused as current acceptance.

## Residual candidates and boundaries

- Supplier shipmentPlanning subtracts/sums Number quantities; decimal0.3−0.1 can produce0.19999999999999998. Root was asked to connect this to backend precision validation before promotion; no separate confirmed finding yet.
- Admin supplier-controls async selection can leave previous price decision visible or accept old load result; runtime and full state identity proof pending. Do not call it a tenant authorization bypass.
- Legacy supplier root refresh resets edits and can mask post-write refresh failure; current unified caller was not found, so kept as legacy observation.
- Legacy landing nonce propagation, mutable evidence uploader concurrency, signed-URL download bounds and 1C external-effect retry were sent to root/backend for cross-boundary validation. They are not frontend-confirmed findings here.
- Source design-rule contradictions (dated fill/underline and second network indicator) are documentation consistency items, not permission to redesign. Generated auth CSS also retains local shared-control selectors; visual contract failure needs viewport/computed-style validation and applicable-date reconciliation.
- Exhaustive text reading does not certify data correctness, browser reachability for all states, external services, visual accessibility or absence of vulnerabilities.

## Verification performed

Final local ledger reconciliation:1136 rows=1136 unique,0 SHA mismatches,0 incomplete full ranges. Remaining authoritative queue consists only of the5 separately classified JSON datasets. `git diff --check` is used for audit evidence hygiene; no app build/database/browser suite is implied by writing this report. No owned runtime process remains.
