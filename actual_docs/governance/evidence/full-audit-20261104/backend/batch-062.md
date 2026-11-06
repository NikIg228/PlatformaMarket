# Backend audit batch062

Final six VAT files fully read. Supplier-only declarations including operator denial;
current confirmed requisites and dated tax profiles, explicit modes/rate validation;
preview binds actor/profile/date/offer versions/current price hash. Apply serializable,
locks ordered offers, preserves gross/freshness, tax-only new price/history plus outbox
and replay atomically. Default affects new prices only, legacy unknown remains unknown.
Potential dated-price caution: prepare92 selects latest created ACTIVE without validFrom/
validTo filter, so future scheduled price may be selected then new tax price validFrom=now132.
Need actual scheduling support/callers before issue; do not claim reachable current defect.
Earlier frontend hardcoded legacy12 is not validated against this new declaration path:
without explicit snapshot old fields can remain legacy unknown; trace exact caller.
Unit tests and cross-service actor specs read, NOT executed. All613 assigned API files
now fully read and ledgered, plus6 delegated root handlers/config. Dynamic certification
and final candidate triage remain parent-owned; full-read does not mean all gates PASS.
