import { notFound } from "next/navigation";
import SupplierStorefrontPage from "../../../../../../buyer-web/app/features/catalog/supplier-storefront";

export default async function Page({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId)) notFound();
  return <SupplierStorefrontPage key={supplierId} supplierId={supplierId} />;
}
