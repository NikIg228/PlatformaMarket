# Backend audit batch051

Remaining search service1080 lines and three helpers39 lines fully read.
B-CAND043: compare()367 calls loadProducts713 which includes all ACTIVE offers with
PUBLISHED/RESTRICTED publication740-754 but never checks allowedBuyerIds or
allowedCityIds. compare382-510 maps every loaded offer, exposing supplier/price/
warehouse availability to another authenticated buyer. search toSearchItem829-843
DOES apply allowedBuyerIds/city guard. assertBuyer85 only guards caller organization,
not supplier publication audience. Exact route/fixture validation pending; source
path is direct, no runtime test. Potential high tenant confidentiality risk.
Projection stale cached price affects normalized-price filtering/sort195-215 but
response989 recomputes visible aggregates; do not claim stale displayed summary.
Storefront availability minimum uses increment multiples consistent current backend
commerce quantity rule; owner intent discrepancy separately tracked FE-QUANTITY-001.
No test execution or product changes.
