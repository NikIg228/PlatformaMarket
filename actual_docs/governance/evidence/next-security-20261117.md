# Next security update — 17.11.2026

Scope: owner-requested `next upgrade --agent=security`, same-major 16.4.3 → 16.4.6. Canonical root PlatformaMarket, main base d4268703. No CRM, API/schema/UI behavior edits, deployment or working-data writes.

The CLI was first attempted at repository root (no app); app-scoped run supplied exact target and instructions. No codemod/Future Defaults. Six manifest pins aligned, lock changes limited to 16 Next-related package/workspace entries; all other fields verified identical after normalizing version/integrity. Preserved proxy body cap, CSP, imports and deployment profile; set supported experimental.agentUpgrade=security as instructed. Open PR lookup twice returned no duplicates; owner workflow uses direct main, no PR/worktree.

Verification PASS: npm install --ignore-scripts; installed/resolved Next16.4.6 in all workspaces; unified go_live production build (5 tasks); web typecheck; next.config ESLint; existing frontend profile tests6; clinic entry2; auth-client24. Production dependency audit: Next absent, 0high/0critical, 2moderate remain (not full security certification).

Real local dev smoke1440/390: catalog54/search1/detail loads to terminal empty-offers state/login; no pageerrors or horizontal overflow. Same-origin current-session returns null for guest; organization access denied401/403; nonce CSP and no-store verified. Four screenshots captured and inspected, product initial loading captures replaced with settled full-page captures. No new UI design; no claim of authenticated purchase or production browser release acceptance. Logs and scripts: `.tmp/p04-20261117/next-*`; images: `output/playwright/next-security-20261117/` (local artifacts, not published).

Attempt history preserved: initial smoke PASS; strengthened smoke1 failed harness missing baseURL; smoke2 expected exact production cache string while dev returns no-store; smoke3 checks semantic non-cacheability and PASS. No product workaround/guard change. Existing stale-price empty offer state preserved; no working catalog refresh/reseed.

Full release/DB suites not rerun: dependency patch with no schema/business/composition change. Existing dev kept running for owner; no live deploy. Reviewed explicit 8-file source scope and diff hygiene. Publication/CI recorded after commit; local checks do not establish CI PASS.
