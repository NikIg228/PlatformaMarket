import products from "../../data/product-page-preview.json";

/** Owner-authorized local content preview; never enabled by URL or a client flag. */
export function localProductPreview(product: { id: string; name: string }, environment = process.env.NODE_ENV) {
  if (environment !== "development") return null;
  return products.find(item => item.id === product.id && item.sourceName === product.name) ?? null;
}

export function previewDocumentLinks(product: NonNullable<ReturnType<typeof localProductPreview>>) {
  return product.documents.map(document => ({
    name: document.name, description: document.description, format: "PDF",
    href: `/dev/product-documents/${product.id}/${document.key}`,
  }));
}
