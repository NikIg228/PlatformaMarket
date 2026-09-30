import { connection } from "next/server";
import { Manrope } from "next/font/google";
import { MarketplaceProvider } from "@marketplace/ui";
import "@marketplace/ui/styles.css";
import type { ReactNode } from "react";
const font = Manrope({ subsets: ["cyrillic", "latin"], variable: "--font-sans" });
export const metadata = { title: "PlatformaMarket", description: "Закупки для клиник и поставщиков" };
export default async function Layout({ children }: { children: ReactNode }) {
  await connection();
  return <html lang="ru"><body className={font.variable}><MarketplaceProvider>{children}</MarketplaceProvider></body></html>;
}
