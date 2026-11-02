# Shared synthetic mobile read contracts

This directory contains a synthetic fixture corpus, scope/identity assertions, and read adapters for the mobile clients. It does not establish live backend, device, provider, payment, or file-delivery acceptance.

The source reference and immutable schema anchors are recorded in `source-anchors.json`. Scenario descriptions are in `scenarios.json`; payloads are in `fixtures.json`. No customer dataset is included.

Existing standalone fixture command, from the repository root:

```sh
node --test contracts/mobile-read/corpus.test.mjs
```

The React Native client and its Jest configuration are in `mobile/market`. Swift and JVM read-core tests in `apps/market-ios` and `apps/market-android` are host-level tests, not device UI tests. Local execution history, machine paths, caches and private configuration are intentionally not published.
