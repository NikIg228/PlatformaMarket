import { readFile } from "node:fs/promises";
import path from "node:path";
import products from "../../../../../../buyer-web/app/data/product-page-preview.json";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; document: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const { productId, document } = await params;
  const product = products.find(item => item.id === productId);
  if (!product?.documents.some(item => item.key === document)) return new Response(null, { status: 404 });
  try {
    const file = await readFile(path.resolve(process.cwd(), "../buyer-web/app/data/product-preview-documents", `${product.id}-${document}.pdf`));
    return new Response(new Uint8Array(file), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${document}-${product.id}.pdf"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 404 }); }
}
