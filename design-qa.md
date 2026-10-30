# Supplier storefront reference — visual QA, 31.10.2026

final result: passed

Scope: approved supplier-storefront composition within existing Market design
contracts. This is not a pixel-identical reproduction of the illustrative raster.

Source: output/storefront-review-20261031/approved-reference.png (1505×1045).
Rendered comparison: output/storefront-review-20261031/implementation-comparison.png
(1505×1045 CSS pixels, deviceScaleFactor 1), same desktop/default/guest state.
Both images opened together; desktop1440 and mobile390 captures also inspected.

No remaining P0/P1/P2 issue in the scoped composition. Compact identity and
details action, single toolbar, supplier-products heading and five product cards
follow the approved hierarchy. Cards expose image/title, availability, real sale-unit
price and Details. Missing profile details are handled in the dialog.

Typography: existing Manrope, heading28/35; body and controls retain shared values.
Spacing: desktop32px edges, regular card gaps and aligned actions; mobile wraps
identity/actions and toolbar into rows with two product columns, no overflow.
Colors: existing semantic surfaces, muted text and green brand/action tokens.
Images: all five exact-identity catalogue photos loaded, contained without stretch.
Copy: actual supplier/products/prices replace illustrative reference content.

Intentional contract differences: shared controls44px/radius8, surface12 and
avatar48 make the page denser than the generated raster. DmSearch has no magnifier
under the existing design contract. Product packaging and minimum-price prefixes
remain visible for accurate sale-unit interpretation. No fabricated products,
names or prices were inserted to mimic the raster. No local control overrides.

Desktop text and controls were readable at full-size inspection; additional
cropped comparisons were unnecessary. Browser evidence covers details/Escape/focus
return, filters, product/back, empty search/recovery, RU/KK responsive layout and
normal-catalog consumers. Final restart confirms five images and full-width search.
Main content follows lang=kk; the pre-existing common toolbar remains Russian.
Full translation and screen-reader certification are outside this visual task.

Earlier implementation fixes: search now fills its storefront column through the
shared opt-in adapter; generic promotions are excluded from the supplier grid.
Final captures include both fixes. No extra P3 polish cycle is required.
