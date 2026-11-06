# Backend audit batch013

AI8files,approvals5,audit3,billing5 completely read. AI role/capability+permissions
checked before each allowlisted tool; conversations user+org scoped. Operator queues
explicitly require platform authority. LLM only summarizes tool output; write limited
to explicit support confirmation. This boundary does not depend on regex injection
classification. Injection regex claims are not general security guarantees.

B-CAND016: AiAssistantService114 redacts stored user message only. Raw input.content
passes213->run->287->OpenAiResponsesService20 request body to configured provider.
AiSafety.containsPossibleSecret only metadata, never gate/redaction. Example harmless
synthetic token assignment would be sent raw while UI storage redacted. Conditional
AIentitlement+providerkey; no real secret/provider probe performed.
B-CAND017: confirm226-252 reads AWAITING_CONFIRMATION then updates RUNNING without CAS.
Parallel confirmations each run create_support_ticket104 with random number; no unique
execution link/idempotency. Duplicate tickets possible. Post-tool logging failure
marks failed although ticket tx already committed; recovery design absent.
B-CAND018: list_supplier_orders requires order.create (tools15), standard supplier legacy
seed has order.confirm only; confirm current role defaults before promotion.

AI messages take oldest200, no cursor; after >200 history newer content unreachable
through messages endpoint. Blocked conversation denies even messages lookup. Low-impact
behavior notes, not prioritized findings absent UI/requirement trace.

Approval evaluator is explicit evaluate endpoint returning matching policy/ordered steps;
commerce enforcement must be checked later. Invalid stored conditions silently unmatched;
no evidence untrusted policy storage bypass. Writes tenant-scoped with CAS/audit/outbox.
Audit query active org scoped with stable order/pagination but locally defined DTO (core
contract coverage gap). Billing platform writes deny ordinary members even FULL_ACCESS.
B-CAND019: subscription accepts future startsAt but entitlement resolve14 tests only end/
grace and status, not currentPeriodStart<=now; future plan benefits granted immediately.
Concurrent subscribe read37 thencreate42 has no unique live-lifecycle SQL constraint.
Feature write58 then audit59 non-atomic. Billing optional readiness remains distinct
from requested commission settlement logic. No tests/DB/provider execution.
