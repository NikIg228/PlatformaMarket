# Backend audit batch026

Imports18/18 fully read, including1349line service. Bounded CSV/XLSX rows5000,
columns100; XLSX safe ZIP preflight; PDF100page loop + text budgets. Money exact
string/minor conversion, VAT preview binds rows/mapping/actor/date and price/profile
versions when supplied. Each import row transaction locks catalog adoption and offer;
inventory changes preserve reserved/safety and use balance version CAS. Matching
memory must respect conflicting GTIN; automatic ambiguous candidates rejected.
Rollback Serializable, rejects preexisting offers/used orders/reservations and
outside-batch dependencies; retains evidence and idempotently repairs search projection.

B-CAND030: import-file.parser.ts143 reads Math.min(document.numPages,100), returns
success with requiresReview:false if any table found196 and metadata full pages197,
no truncation warning. PDF page101 onward silently omitted. Pure fixture101-page PDF
with one distinct row on101 would demonstrate; no runtime invocation here.

B-CAND031: imports.service.ts581–588 commits PROCESSING before rows; only MAPPED
accepted548–551. Row-error persistence613/921, Promise.all941 or final transaction942
failure escapes with no batch recovery; crash also leaves PROCESSING. Retried queue
job then conflicts instead of continuing; rollback997 requires COMPLETED variants.
Need repository recovery writer search before confirmation. Some rows may already
commit, so reupload is not atomic recovery and source item links may supersede prior.

Additional follow-up: manual confirmMatch1235 only changes mapping/row and emits
SupplierItemMatched, not offer/price/inventory; trace consumer before calling function
incomplete. Import read responses expose first200rows/100external items with no cursor
in these endpoints; diagnostics conflictCount counts sliced200, not total341–360.
Processing captures raw exception.message into persisted diagnostics915–928; can expose
Prisma/internal errors in supplier UI; exact exception probe pending parent.
