# Backend audit batch049

All nine promotions files fully read; truncated middle engine/tests/controller/module/service
header reread separately. New versioned promotion lifecycle uses supplier-offer then promotion
locks, expectedVersion, request hash idempotency advisory lock, revision/moderation audit.
Checkout limit claim/release row-locked and release rechecks receipt flag. Gift lookup accounts
for same balance/lot paid quantity; old legacy promotion engine separate from versioned path.
Storefront149–158 tests existence of a fresh base price but not equality to approved baseAmountMinor;
quote checkout16 rejects changed current price. Possible stale advertised promotion after price
change, depending other price-change invalidation consumer; trace pending. Storefront main balance
filter157 omits active warehouse unlike gift152/quote22; possible misleading availability.
Pure amount helpers BigInt, tests include >Number safe and complete thirty-day aggregate.
Promotion buy/gift divisibility44 uses n/increment, distinct from cart (n-min)/increment semantics;
minimum is separately represented. Scope rule needs acceptance reconciliation before finding.
No runtime tests or product edits.
