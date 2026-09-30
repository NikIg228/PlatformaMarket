import type { ReactNode } from "react";
import { OrganizationGate } from "../../../buyer-web/app/organization-gate";
import { DeliveryProvider } from "../../../buyer-web/app/features/marketplace-header/delivery-context";
import { Workspace } from "../workspaces/workspace";
export const metadata = { robots: { index: false, follow: false } };
export default function ClinicLayout({ children }: { children: ReactNode }) { return <Workspace role="clinic"><OrganizationGate><DeliveryProvider>{children}</DeliveryProvider></OrganizationGate></Workspace>; }
