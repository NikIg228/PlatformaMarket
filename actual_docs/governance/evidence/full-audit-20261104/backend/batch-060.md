# Backend audit batch060

Six recommendation files full-read; unit/security tests read NOT executed.
B-CAND045 recommendation commercial eligibility diverges from search: product offers27
only status/publication; no SupplierTermsService/activeSupplierIds, supplier/organization
status or price freshness. Thus suspended/unadmitted supplier or expired-freshness price
can be recommended although catalog/checkout deny. Promotion query59 lacks APPROVED,
approvedRevision, quantity remaining, coupon and per-offer base binding used search242;
discount88-90 may advertise unapproved/exhausted/coupon promotion, treats unknown delivery
as zero. Need current UI reachability/feature status before final severity. Direct API
POST recommendations/smart remains declared. Source historical implementation maturity gap.
Other related caution: replay46 checks buyer only, not exact request; same key changed
quantity/address returns saved prices/destination. Tenant foreign key collision fails unique
on create rather than explicit conflict. Number money81/90 violates exact arithmetic;
ranking itself approximate, but rendered landedCost includes values. Group rather than
inflate separate findings until runtime/contract validation. Audience filtering39 is present
and saved results remove revoked offers; do not claim B-CAND043 applies here.
