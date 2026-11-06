# Backend audit batch027

First11 integration files fully read. Registry maps MOYSKLAD/CUSTOM_API/MOCK, ONE_C
external agent. Outbound requests use gateway host/IP/resource policy; adapters bound
2MB response and configurable timeouts. Upstream user-facing messages are preserved
by adapters; exact sensitive upstream reflection not demonstrated. Numeric price
normalization converts external string to Number (custom227) before persistence;
trace execution's bounds to establish loss-of-precision finding. MOYSKLAD release
explicitly unsupported367–373; readiness declares PARTIAL/CONNECTOR_NEEDED.

B-CAND032 direct external reservation creation omits idempotency key: external-
reservations38–39 stores DB idempotencyKey but jobPayload41 only copies original
payload23–37 and recordId. Direct adapter48 receives no idempotencyKey, whereas
custom77–93/Moy386–395 generate outbound header only from payload key. Crash between
external success and DB update49 leaves PENDING which ensure19 returns unchanged.
ONE_C enqueued key43 exists separately; execution may inject it later (next batch).

Agent authenticate90–95 checks agent token/revoked status but not connection status;
heartbeat32–33 unconditionally sets connection ACTIVE/ERROR. Need connection revoke
implementation to decide whether revocation cascades to agent and whether heartbeat
race can resurrect paused/revoked state. Enroll15–24 checks one-use token before
unconditional transaction update; concurrent enroll can rotate first returned token.
Readiness update global provider data protected integration.manage only; role catalog
and operator requirement need reconcile before asserting tenant privilege issue.
