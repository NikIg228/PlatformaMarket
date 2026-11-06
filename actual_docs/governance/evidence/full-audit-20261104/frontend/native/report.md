# Native frontend audit — immutable source snapshot

The delegated native source review is complete for `6d2e8c9a2a13816e78384468c5acedd8c2a7579c`: **913 tracked entries, 891 own-text files fully read, 22 separately classified entries** (17 binary assets, two locks, three structured contract JSON files). Final reconciliation re-read immutable Git bytes and verified every ledger SHA256, blob, ref, byte count, line count and continuous range union: **zero discrepancies**. The parent read the 100 files listed in `root-assigned.json`; both readers contributed to the append-only ledger. No source checkout, installation, build, native execution or product modification was performed.

Evidence: [coverage summary](coverage-summary.json), [review ledger](review-ledger.jsonl), [classification](classification.json), [caller/contract map](caller-contract-map.json). Classified JSON and binaries are not claimed as full line-by-line reads. This is source review, not Android/iOS acceptance.

## Confirmed source findings

### NATIVE-COPY-001 — P2: real command panels retain synthetic-port claims

`GoodsReturnCommandUi.tsx:10–13` and `ShipmentReceiptCommandUi.tsx:10–13` build native copy by spreading `withoutTestLabel` over fixture labels, overriding only the form description and boundary title. `native-command-copy.ts:3` removes the literal suffix ` (тест)` only. The retained RU body says that the client request is being checked on a substituted port; the KK body makes the same claim. The native panels select this copy when `command.runtime === "native-session"` and render `t.body` in their Notice (`GoodsReturnCommandUi.tsx:18–20`, `ShipmentReceiptCommandUi.tsx:18–20`). `MarketReadApplication` mounts these panels for order and draft routes, with native commands bound by the session/controller composition.

The user is therefore shown a test-only explanation on a surface that can send the real request. This is misleading command feedback; it does **not** establish that the request is simulated or that authorization is absent. Native copy should explicitly describe the actual action and its unknown/result states rather than mechanically reuse fixture explanations. Verify both locales and the native-session command branches after correction.

The same incomplete separation leaves the cart quantity route title as `cartCommandCopy[locale].editor` (`MarketReadApplication.tsx:904`), whose RU/KK labels retain ` (тест)` (`CartCommandUi.tsx:9–10`), although the native alternative exists. This is grouped with the same copy defect rather than counted separately. `CartQuantityDraftUi`'s local-draft hint alone was not promoted: it accurately describes a local draft before sending.

### NATIVE-RELEASE-001 — release configuration is still a local build profile

`mobile/market/android/app/build.gradle:97–120` uses `dev.platforma.market.local`, version `0.0.0`/code1 and debug signing even for the release build type. The iOS project also retains the local bundle identifier. These are concrete source limits on a store/production release claim, not a defect in an explicitly local development build. No signing credentials, release package or store submission was inspected or changed. A distributable production configuration and matching artifact/device proof remain unverified.

Android's source manifest has only the launcher intent filter (`android/app/src/main/AndroidManifest.xml:21–24`); its HTTPS `queries` entry declares outbound visibility, not an inbound callback. iOS declares URL schemes. Record this platform difference when specifying email/reset/payment return-link acceptance; it does not by itself prove that a user cannot complete an existing manual flow. No external callback/device test was attempted.

## Callers, contracts and main compatibility

The map records6467 literal import/re-export edges:4833 resolve inside the reviewed native scope;27 distinct source targets resolve outside it. Of those targets,23 have exactly the same Git blob as reviewed main `af7149699aac16c0127df6852b231fb66f00b08b`. Four differ: `packages/schemas/src/core-api.ts`, `packages/schemas/src/index.ts`, `packages/schemas/src/trust-commerce.ts`, and `packages/ui/src/component-contract.json`. Bare package imports and unresolved targets are retained explicitly (926edges), not declared covered.

The native core/index schema snapshot contains substantial additions compared with main. Native `createVerifiedReviewSchema` requires all review dimensions, whereas main permits partial dimensions and defines order review state schemas absent from the native snapshot. The component contract on the native ref lacks main's notification-card block. These differences mean that reading or testing native against its own branch cannot certify compatibility with the current main API or current visual contract. They are not blanket evidence that every native operation fails. The map preserves exact target blobs and callers so root/backend can reconcile the affected server operations without merging or switching branches.

The earlier `source-anchors.json` classifier compared declared anchors to the preserved main filesystem and found15 of18 anchor records unequal; multiple records point to the same schema/client file. This is historical anchor drift, not15 independent defects. Do not reuse those anchors as current acceptance. A static import graph is not proof of navigation reachability, native module availability or server behavior.

Reviewed source covers the native shell and adapters; session/login/refresh/recovery/MFA; catalogue/media/filter/comparison; cart/reprice/checkout/unknown outcomes; order composition, cancellation, receipts, returns, disputes and manual payment; conversations/support; organization/profile; documents/archive metadata; RU/KK copy; Android/iOS configuration; fixture/replay/protocol harnesses and tests. The ledger retains per-range notes. Synthetic replay reports consistently distinguish source compatibility from real authorization/effect; reading those tests is not executing them.

## Rejected candidates and remaining acceptance

- Checkout scrolling concern was disproved: the reachable children supply ScrollView/FlatList containers. No overflow finding is asserted.
- Support draft-only wording describes the in-memory draft separately from sent status/ticket number; no contradictory send claim was established there.
- Russian source city names are explicitly disclosed as source names; not counted as an untranslated UI label.
- Separate new-cart continuation after an unknown checkout is intentionally guarded and preserves the old outcome/key; not counted as automatic replay.
- Keyboard insets on profile/organization forms, small-screen layout, touch targets, screen-reader navigation, font scaling and native focus require actual device acceptance. No source-only visual PASS is claimed.

Runtime, native test execution, release build, installation, real API sessions, private-file download, signing, push/deep-link round trips and device screenshots are **NOT_RUN** in this delegated review. Earlier source/Jest claims and an older APK are not acceptance of this immutable source. The historical iOS third-attempt failure described in BACKEND_CONNECTION remains a failure; no fourth attempt was made and no retry counter was reset. Root owns runtime aggregation and the full audit conclusion. No owned runtime process remains.
