"use client";

import { MarketplaceProvider } from "@marketplace/ui/provider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
