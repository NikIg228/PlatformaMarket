import type { ReactNode } from "react";
import { Workspace } from "../workspaces/workspace";
export const metadata = { robots: { index: false, follow: false } };
export default function SupplierLayout({ children }: { children: ReactNode }) { return <Workspace role="supplier">{children}</Workspace>; }
