# Backend audit batch018

All6compliance files fully read. B-CAND026 confirmed by original evaluator in-memory
transpilation, no database/network/source change. Missing all requiredCredentialAnyOf
alternatives yields PASSED; ordinary requiredCredentialTypes missing yields expected
REVIEW_REQUIRED; existing alternative yields PASSED. Exit1 records1FAIL2PASS.
Exact full inputs/outputs/sourceSHA in compliance-anyof-probe-1.json; command
`node .tmp/full-audit-20261104/backend/compliance-anyof-probe.cjs`.

Cause: evaluator73 reason starts uppercase Требуется but regex93 only lowercase
требуется, and any-of does not populate missingCredentials. Service185 invokes evaluator;
assertOfferAllowed129–135 blocks only BLOCKED/REVIEW_REQUIRED, called by checkout
CommerceService536. Publication138–148 same gate. No live external impact claimed.

B-CAND024 status concern remains: compliance only verifies seller existence155,
warehouse ownership161, lot association164; does not validate organization/product/
variant/warehouse active status. Inventory reserve still pending.

Other source risks pending prioritization: rule activation retires current rule before
future replacement effectiveFrom and rechecks only500unpaged offers; old reviewed
check233 can republish offer without fresh rule/credential facts. Credential review64
unconditional update after read may approve concurrently replaced credential contents.
Not separately validated or assigned severity. Logs/evidence do not establish legal
compliance requirements; this audit tests code-declared business predicates only.
