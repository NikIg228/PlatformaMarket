# Static resource and catalog provenance review

All 3401 inventoried static resources were checked for current existence/size.
Sharp metadata parsed 3201 images without errors. The other 200 resources have
inventory/size evidence only. There are 566 identical-hash groups; duplication
across legacy apps, archives and screenshots is not automatically unused content.
Details: static-resource-review.json. No files were transformed or removed.

Method limitations: metadata parsing does not decode every pixel or verify rights,
supplier authenticity, exact product identity, accessibility or browser delivery.
The baseline SHA remains distinct from current size/existence checks. The final
drift check must compare relevant content, not treat unchanged size as unchanged SHA.

The active public-catalog-media.json contains 389 records combining
aiGenerated=true, exactProductPhoto=true and rightsStatus=SOURCE_UNVERIFIED.
catalog/catalog-media-source.ts:4–9 accepts exactProductPhoto and selected URL
patterns; it does not inspect either of the other flags. catalog-fallback.server.ts
imports this dataset and attaches media by exact normalized product identity.
This proves inconsistent provenance metadata reaches an eligible rendering path;
it does not establish that all 389 images were generated or depict wrong products.

One local sample was visually inspected:
apps/buyer-web/public/catalog/products/8f560123-c63f-42fd-b75c-110e74bf9113.webp.
It displays an isolated implant component; exact dimensions/model and provenance
cannot be authenticated from appearance. Its alt text says category illustration,
while metadata says supplier-product-photo and exactProductPhoto. Treat this as a
catalog provenance/label consistency issue requiring source receipts and a chosen
publication policy, not a confirmed clinical misidentification or copyright claim.

No supplier website was contacted, no rights status altered, and no images generated.
Current browser visibility and all product-image correspondences remain unverified.
