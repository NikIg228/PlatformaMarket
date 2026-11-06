# Backend audit batch022

Remaining12documents files fully read; all41documents own text complete (fontOFL
previously reviewed). Shipment waybill previews supplier-only with shipment.manage+
document.issue, locks order/requisites, revalidates after rendering reservation,
explicitly marks stale; no signing/issue promise. PDF renderer/tests preserve RU/KK,
long table cells and page labels. Signature configured gateway has15s abort and no
raw document payload. Gateway result SIGNED is trusted remote result; MOCK/SIMPLE
always use mock, external method missing URL only blocks in NODE_ENVproduction.
Runtime deployment-profile guard reviewed earlier; do not equate dev go_live with
production mock permission without tracing overall policy. No new confirmed finding.

Generic signature completion B-CAND028 still needs agreements callback trace. Generic
nonagreement signed count includes repeated same-party signatures884; agreement
parties require distinct actualEDS signatures883–887. Template.signatureMethods not
consulted by generic createSignatureSession789; requested method resolved directly.
Whether nonagreement SIMPLE signing allowed by product contract needs reconciliation.
