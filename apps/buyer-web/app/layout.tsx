import type { Metadata } from "next";
import { connection } from "next/server";
import { Manrope } from "next/font/google";
import { MarketplaceProvider } from "@marketplace/ui";
import "@marketplace/ui/styles.css";
import "./globals.css";
import { OrganizationGate } from "./organization-gate";
import { SupplierCatalogSession } from "./supplier-catalog-session";
import { DeliveryProvider } from "./features/marketplace-header/delivery-context";

const manrope = Manrope({ subsets: ["cyrillic", "latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "PlatformaMarket для клиник",
  description: "Каталог и закупки для стоматологических клиник",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A request-scoped render is required for Next.js to attach the CSP nonce to
  // its bootstrap and hydration scripts.
  await connection();
  return <html lang="ru"><body className={manrope.variable}><MarketplaceProvider><SupplierCatalogSession><OrganizationGate><DeliveryProvider>{children}</DeliveryProvider></OrganizationGate></SupplierCatalogSession></MarketplaceProvider></body></html>;
}
