# Backend audit batch030

Final five integration files fully read; first output truncation repaired by explicit
integrations.service 241–349 and payment-captured spec reread. All integration sources
complete. Connection CRUD uses supplier permission and version CAS, tax uses serializable
transaction. Reconciliation claims updatedAt/status, supports same decision replay.
PaymentCaptured fanout deduplicates connections and uses order/payment idempotency key.
Reservation scope tests cover tenant/connection/payload mismatch and retries, not executed.

Potential configuration-secret gap: protectConfiguration40–54 only recognizes delimited
snake/kebab secret names, does not descend arrays; camelCase apiKey/accessToken and array
objects remain in public configuration selected by list/get. Need schema/provider config
contract reachability before promotion; credentials field is separately encrypted.
Onboarding readiness is heuristic (any order or reservation release satisfies control order,
latest independent source/connection chosen); does not prove full reserve-confirm-cancel.
Server partial reservation release is explicitly expected RELEASED in test165–169, whereas
agent partial release remains ACTIVE158; examine downstream use before classifying.
No runtime commands or product changes.
