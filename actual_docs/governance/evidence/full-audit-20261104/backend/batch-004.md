# Backend audit batch 004

10 more platform security files read fully; cumulative53/613 app files plus6 root files,
3514 total read lines. No new local execution. Root independently ran original-source VM
serverless probe: .tmp/full-audit-20261104/serverless-diagnostic-1.log read here.
B-CAND001/002 now CONFIRMED_CODE_BEHAVIOR: two cold requests create2 apps; readiness
initialization failure200 versus expected503. Stubs/no DB/no live Vercel; root owns stable IDs.
Root also reviewed catalog sync script: only --apply plus DATABASE_URL/industry guards;
no target/profile guard. B-CAND003 supported statically; DB impact NOT_RUN.

Uploads: name NFKC/basename/control-character rules, extension vs magic validation,
checksum, quarantine storage then uploadAsset row, scan then CLEAN; rejection deletes
object and marks REJECTED. Hourly cleanup100 unlinked >1h assets. Test source verifies
size bounds/type family and scan-failure delete, not database-create compensation.
ClamAV uses INSTREAM64KiB chunks/15s deadline; production guard forbids disabled mode.
Failed scanner gives503 and does not publish CLEAN. Scanner writes ignore socket
backpressure but upstream upload bound limits buffer; not independently demonstrated issue.
ZIP preflight forbids multidisk/ZIP64/overlap/origin ambiguity/encryption; checks entry
and total inflated bytes, ratio, actual stream output and consumed bytes. Tests cover
truncation, forged size, hidden end signature, concatenated packages and aliases.

Outbound adapter: HTTPS443 only, no credentials, all DNS answers must be public;
connects pinned address with hostname SNI; allowedHosts optional. Removes transport
headers, forces identity encoding, rejects compressed responses, total deadline across
DNS/redirects, max4MiB response. Same-origin read redirects only/max3; writes never
redirect/retry automatically. Tests cover private/literal/DNS changes, timeout, header
rejection, limits and request+response destruction. No security dynamic reproduction.

Rate limit: atomic Lua count/blockTTL, production503 on Redis error, nonproduction local
fallback. Connection lazy; ensureConnected calls connect whenever notready/nonend.
New candidates requiring caller/lifecycle corroboration:
- B-CAND004 file-upload-policy.service.ts80-81: storage.put succeeds then DB asset create
  throws outside compensation try; object orphan cannot be found by row-based cleanup.
- B-CAND005 :101 then release:92-95: selects unlinked asset, later delete does not recheck
  metadata; possible concurrent link loses file. Need check caller link timing/transactions.
- B-CAND006 rate-limit.storage.ts171-176: concurrent first requests can call connect while
  connecting, causing production503. Need dependency behavior; not yet runtime confirmed.

Next storage/jobs/outbox/observability, then all remaining own sources/schema/migrations.
