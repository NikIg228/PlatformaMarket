# Backend audit batch034

All seven moderation files fully read. Candidate approval/reject claims PENDING with CAS
inside transaction; manual approval produces active master+packaging and DRAFT unpriced
supplier offer, imported approval validates compliance/VAT and leaves publication draft.
Operator capability checked in addition to permission. Queue/import limited100 without cursor;
manual queue and own submissions have scoped keyset cursors. Import readiness omits explicit
VAT readiness and uses selected highest quantity balance, so heuristic only.

B-CAND037: ProductCorrectionsService pendingRequest95–100 is outside transaction; approve
updates master111 before unconditional decision143, reject unconditional163. Concurrent
approve+reject both pass pending check; final request can be REJECTED with applied product
change and both terminal outbox events, or two approvals apply twice. No CAS/row lock/status
predicate. Parallel distinct requests for same field also overwrite stale accepted values
without checking request.currentValue against actual product field. Source-confirmed, not probed.
CANONICAL_NAME correction replaces entire search text126 with name, potentially drops other
search terms until projection refresh; trace ProductCorrectionApproved consumer before finding.
