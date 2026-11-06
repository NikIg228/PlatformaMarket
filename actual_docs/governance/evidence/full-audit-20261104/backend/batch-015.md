# Backend audit batch015

Fourteen commerce files fully read: cart correction/recovery, checkout snapshot tests,
analytics controller/service, metric facts/tests, commerce rules/tests/module/controller,
and create-active-cart implementation/tests. First output truncated checkout111–137
and analytics controller; both reread fully before coverage recorded.

Recovery locks source and runs serializable, stable UUID identity, checks unresolved
local/external holds, preserves old snapshot for subsequent consent, handles races.
Analytics explicitly restricts tenant/role, uses exact minor-unit BigInt and SQL numeric,
RepeatableRead UTC. Count conversion only uses Number. Commission analytics hardcodes
1000bps HALF_UP; commerce calculateAllocation defaults200bps; callers not yet read.
This is a discrepancy candidate pending actual financial flow; root notified of source.

Create-active-cart P2002 race branch returns existing active cart without checking
requested currency (unlike ordinary existing branch). Concurrent differing currency
requests could receive another currency cart; actual allowed createCartSchema and UI
currencies pending. No double charge/write demonstrated. Checkout mocks cover price,
VAT, packaging and legacy consent plus idempotent replay but do not prove DB isolation.
Controller supplied IDs generally rely service checks; supplierOrders checkoutId query
is unparsed despite declared schema, malformed UUID likely maps database error; inspect
service/error filter before treating as report finding. No runtime tests by worker.
