import { redirect } from "next/navigation";
import Products from "../../workspaces/products";

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<{ editor?: string }>;
}) {
  const { editor } = await searchParams;
  if (editor === "import") redirect("/supplier/products/import");
  if (editor === "new") redirect("/supplier/products/new");
  return <Products />;
}
