import { redirect } from "next/navigation";
import { marketplaceCatalogUrl, readMarketplaceCatalog } from "../../../../buyer-web/app/catalog/marketplace-url";

export default async function ClinicCatalog({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  redirect(marketplaceCatalogUrl(readMarketplaceCatalog(params), "/catalog"));
}
