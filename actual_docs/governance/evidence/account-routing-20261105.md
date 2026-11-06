# Account routing — 05.11.2026

Owner requested role-correct account navigation and an audit of the complete
entry flow. Canonical main@5161af7, ahead7 at start. Existing staged/unstaged
work is preserved; no account, membership, working DB or permission changes.

## Scope and audit

The owner-identified user was inspected in the local marketplace DB using a
read-only transaction: one active SUPPLIER membership. Its display name is a
user name, not an organization type. No credentials or account data exported.

Found and addressed:

1. HeaderAccount preferred personal purchase mode over a verified supplier
   workspace. `usePurchaseContext` legitimately selects personal purchasing when
   there is no BUYER workspace; this must not select the account destination.
2. Personal fallback preceded verification errors, hiding a failed organization
   lookup behind a cart link. Recovery now takes precedence over navigation.
3. A direct supplier URL does not establish a workspace session after a public
   supplier login: the public-return branch intentionally does not exchange the
   supplier handoff in the buyer store. Header links now request the canonical
   role path through the existing login continuation and workspace handoff.
4. Saved personal mode blocked clinic entry even at the right URL. Successful
   BUYER handoff selects organization mode. A small clinic entry boundary also
   selects it on a fresh direct entry, before mounting workspace consumers. It
   does not continuously override later failure/switching states.
5. Canonical account-entry URLs must map to the root of the corresponding
   legacy application. The handoff builder now handles `/clinic`, its allowed
   root query, and `/supplier` while retaining scoped paths in the unified app.
   Unsupported return filters fall back to the explicit clinic role instead of
   silently dropping the requested role. The existing return allowlist is not
   expanded; unsupported locale/filter queries may be omitted on this fallback.

Server-verified active workspace determines BUYER/SUPPLIER navigation. A dual
capability organization uses the existing choice screen. Multiple organizations
remain explicitly selectable in the existing login flow. Local buyer storage
does not override the current sign-in identity. No token is inserted into a
query string; existing one-use handoff and membership/capability checks remain.
Personal identity without an organization uses the existing `/personal/cart`.
A new full personal account, checkout or denial of explicit personal shopping
to organization members is not part of this change.

## UI boundary

Existing public header and clinic shell retained; no CSS/tokens/assets changed.
User screenshot: personal cart with user-name link (provided05.11). Runtime
inspection remains unavailable after the existing Computer Use failures.
Contracts: market-components-v1 and platforma-semantic-light-v1; existing
account link min-height44px, field radius8px, space2 padding, semibold text,
720px mobile breakpoint. New transient entry uses shared LoadingState.
Required browser coverage: supplier/clinic/personal, saved personal preference,
fresh public supplier login, dual role choice, failed lookup/retry, direct clinic
entry, RU desktop/KK mobile and keyboard activation/focus. No screenshot or
computed-style PASS is claimed.

## Verification status

Local implementation, build/types and focused tests PASS; browser acceptance OPEN.
Focused tests cover rendered destinations, active workspace vs stale buyer
state, loading/error/personal fallback, dual capability, clinic entry without
overriding later fail-closed state, verified handoff and safe role return.
React tests use a hook harness and mocked controls; they do not prove browser
hydration, focus or actual authentication integration.

One interim buyer typecheck failed with TS6053 because build was concurrently
regenerating `.next/types`. This was a verification scheduling error; final
typechecks must run after builds. No application fix or waived gate follows.

One intermediate header test caught `lang=kk` being rejected by the existing
return allowlist, causing a bare login link. Fixed by falling back to `/clinic`
before constructing the login URL; subsequent focused tests pass. This does
not claim preservation of that unsupported return parameter.

Final focused suites: buyer22 + request lifecycle1, clinic entry2, landing auth23,
session client14 — 62 tests PASS. Earlier passes are superseded only for changed
inputs. An additional cancellation-race hypothesis was NOT confirmed: the
existing abort guard already protects readiness; its new regression test passes
without changing runtime code.

- `npm exec --workspace=@marketplace/buyer-web -- vitest run app/features/marketplace-header/header-account.test.tsx app/features/marketplace-header/navigation.test.ts app/buyer-context.test.ts`
- `npm exec --workspace=@marketplace/buyer-web -- vitest run app/features/marketplace-header/header-account-lifecycle.test.tsx`
- `npm exec --workspace=@marketplace/web -- vitest run app/clinic/clinic-entry.test.tsx`
- `npm exec --workspace=@marketplace/landing-web -- vitest run app/auth-client.test.ts`
- `npm exec --workspace=@marketplace/api-client -- vitest run src/workspace-session.test.ts src/session-handoff.test.ts`

Scoped ESLint PASS. React review: destination derived from verified data, pure
resolver with type-only schema import, existing control adapters, stable mount
effect with idempotent preference change, no backend permission bypass or new
dependency. The clinic boundary is not a replacement for server verification.

Final commands `npm run build --workspace=@marketplace/{buyer-web,landing-web,web}`
and `npm run typecheck --workspace=@marketplace/{buyer-web,landing-web,web}`
were run separately for each named workspace and passed. Buyer bundle budget
check included in its build also passed. No new dependencies or full-project
suite. Build outputs are the default pilot artifacts, not go_live certification.
Logs: `.tmp/account-routing-20261105/buyer-web-final-build.log`,
`landing-web-accepted-source-build.log`, `web-accepted-source-build.log` and
corresponding type logs. Final buyer/web types and lifecycle lint also PASS after
adding the test-only file; unchanged production builds were not repeated for it.
Initial successful artifacts were superseded where later source corrections
changed inputs. Final diff hygiene PASS. Generated web next-env imports restored
byte-for-byte from the pre-build snapshot; buyer/landing next-env unchanged.

Changed implementation/test files:
`apps/buyer-web/app/features/marketplace-header/{account-destination.ts,header-account.tsx,header-account.test.tsx,header-account-lifecycle.test.tsx}`,
`apps/landing-web/app/{auth-client.ts,auth-client.test.ts}`,
`apps/web/app/clinic/{clinic-entry.tsx,clinic-entry.test.tsx,layout.tsx}`.
README/BUYER-CONTEXT roadmap record the owner decision; no B2C acceptance is
promoted and prior staged documentation remains untouched in the index.

Original owned dev session34526 was stopped before builds. Requested `npm run dev`
has been restarted as session83000, log `.tmp/account-routing-20261105/dev-resumed.log`;
API readiness4012 and public catalog3000 both returned HTTP200; serving API PID18068
and frontend PID19636. This is server availability, not authenticated browser
acceptance. No working data changes, account impersonation,
test credentials injected into browser, or remote publication.

Browser acceptance remains BLOCKED: preceding getTab failed `undefined timeoutMs`
even after a tool-session reset; native access was stopped because URL policy
verification could not establish the current URL. No new attempts or alternate
browser/launch bypass in this implementation task. No overall acceptance,
commit/push, CI or deploy claimed before required browser verification.
