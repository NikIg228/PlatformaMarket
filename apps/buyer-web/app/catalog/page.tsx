// Both entry URLs share the same catalog, filters and authenticated workspace.
import BuyerWorkspace from "../buyer-workspace";

export default function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
  return <BuyerWorkspace searchParams={searchParams} />;
}
