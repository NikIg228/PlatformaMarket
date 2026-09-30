import type { ReactNode } from "react";
import { DeliveryProvider } from "../../../buyer-web/app/features/marketplace-header/delivery-context";
export default function MarketplaceLayout({ children }: { children: ReactNode }) { return <DeliveryProvider>{children}</DeliveryProvider>; }
