import BuyerWorkspace from "./buyer-workspace";
export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; offset?: string }> }) {
  return <BuyerWorkspace searchParams={searchParams} />;
}
