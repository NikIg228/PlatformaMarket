import type { ReactNode } from "react";
import { OrganizationGate } from "../../../buyer-web/app/organization-gate";
import { DeliveryProvider } from "../../../buyer-web/app/features/marketplace-header/delivery-context";
import { ClinicEntry } from "./clinic-entry";
export const metadata = { robots: { index: false, follow: false } };
export default function ClinicLayout({ children }: { children: ReactNode }) { return <ClinicEntry><OrganizationGate><DeliveryProvider>{children}</DeliveryProvider></OrganizationGate></ClinicEntry>; }
