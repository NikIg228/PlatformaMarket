# Backend audit batch021

Fifteen invoice/resupply document files fully read. Specialized invoice flow rejects
PARTIALLY_CONFIRMED, expired reserve, inconsistent totals/unknown tax/incomplete
requisites, locks order+org/requisites, creates stable number/version and resumes
failed renderer from same preparation. Confirmation revalidates snapshot+preview
checksum inside workflow transaction; bytes stored under new content hash preserving
old preview. No generic retry gap applies to this specialized path.

Resupply drafts role/tenant scoped; all facts from agreed discrepancy and linked
replacement, settlement only fully received, never legal signature/completed closure.
Source document checksum rechecked and both parties see working draft; repeat key
bound to input/context. Failed outbox rollback deletes only definitely unreferenced
file. Download verifies checksum. Generic signing/version paths explicitly blocked.

Legacy prepareOrderDocuments/document-pack controller remains reachable with
permission document.issue; specialized invoice behavior does not remove B-CAND027
or legacy PARTIALLY_CONFIRMED generation observation. No new runtime tests.
