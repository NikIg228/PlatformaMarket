# Browser validation of selected frontend findings

Current canonical dev, desktop1440px, fresh isolated Chromium contexts. All API
requests were fulfilled by synthetic fixtures; unknown APIs returned503, and all
nonlocal/nonGET requests outside API fixtures were blocked. No real login,
authorization, organization/order write or provider call. These are component/flow
diagnostics, not production-build or backend acceptance.

- FE-FORM-002: clicking Create sent exactly one mocked POST /organizations,
  received201, then rendered “Организация не создана” with a null/reset exception.
  The screenshot was visually inspected. Raw result-1 captures the form text;
  feedback is portalled outside that form and is visible in the screenshot.
- FE-NUMBER-001: original quantity input with min0.000001 and no step rejects20
  with native stepMismatch. Original price input with min0 accepts20 (control).
  First attempt's numeric stage stopped on an ambiguous selector; second attempt
  reran only that stage using the exact accessible label. No product change.
- FE-RECOVERY-001: control ACCEPT_COMPOSITION acknowledged then CANCEL sent two
  commands and reached CANCELLED. With a simulated commit followed by an aborted
  response, polling observed CONFIRMED and removed the accept button. Cancellation
  then failed locally with “Результат предыдущего действия неизвестен…”; only the
  first POST reached the mock. The original backend ACCEPT transition was separately
  source-traced. This is not an actual lost TCP response after a database commit.

Evidence: ui-admin-probes/result-{1,2}.json and screenshots;
ui-workflow-recovery/result-1.json, control.png and lost.png. Source hashes are
embedded. Unrelated shell/widget failures in screenshots result from deliberately
unimplemented fixture endpoints and are not counted as findings. Browser processes
were closed. Production CSP, responsive/mobile/localized states and other routes
remain outside these three diagnostics.

FE-SIGN-001 additionally reproduced with native Chromium enforcing CSP returned by the original proxy function under production NODE_ENV. Same-origin fetch PASS, then offline mode before websocket creation; explicit connect-src enforce violation for NCALayer. No service contact/signing. First harness attempt used Playwright WebSocket interception, which bypasses native CSP; timeout retained as harness failure, not product result. Evidence csp-signing-probe-{1,2}.json.

FE-SESSION-001: current operator Settings UI confirmed with mock receipt validated by shared schema. A revoke held pending, synthetic B stored and read back, then A completion cleared B and navigated to inert login target. Same-current A control cleared A as expected. No real login/session revocation; test models session storage replacement, not a complete second-login flow. Attempt1 malformed sessionId receipt retained separately; valid id receipt in attempt2 confirms race. Evidence ui-session-race/result-2.json.

FE-FORM-001: reachable shipment discrepancy dialog with schema-valid synthetic shipment silently blocks damaged=-1 and actual=01. Both cause no POST, no changed form text, no aria-invalid or form alert, native validity remains true. Valid1/0 emits one schema-valid CREATE (deliberate mock409 proves boundary). Screenshot silent-validation.png inspected; shell errors stem from unmatched mocks, excluded. Evidence ui-discrepancy-validation/result-1.json.

FE-DRAFT-001: /admin catalog, two synthetic corrections. B was edited to Unsaved edited B and verified; approving A sent correct payload (control), reloaded pending queue, and replaced B with Suggested Product B. B comment remained, making silent partial draft loss concrete. Screenshot after-decision.png inspected; unrelated503 sections and full-page fixed-header capture excluded from findings. Evidence ui-draft-recovery/result-1.json. No real moderation action.
