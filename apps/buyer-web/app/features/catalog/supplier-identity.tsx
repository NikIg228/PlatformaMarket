"use client";
import { Avatar } from "@fluentui/react-components";
import { DmButton } from "@marketplace/ui/actions";
import styles from "./supplier-storefront.module.css";

export function supplierLogoSource(id: string, hasLogo: boolean) {
  return hasLogo ? `${(process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "")}/catalog/suppliers/${encodeURIComponent(id)}/logo` : undefined;
}
export function SupplierIdentity({ supplier }: { supplier: { id?: string; organizationId?: string; name: string; logoUrl?: string | null } }) {
  const id = supplier.organizationId ?? supplier.id;
  if (!id) return <strong>{supplier.name}</strong>;
  return <DmButton as="a" appearance="subtle" href={`/catalog/suppliers/${encodeURIComponent(id)}`} aria-label={`Витрина поставщика ${supplier.name}`}>
    <span className={styles.identity}><Avatar name={supplier.name} image={{ src: supplierLogoSource(id, Boolean(supplier.logoUrl)) }} size={32} aria-hidden="true" /><span>{supplier.name}</span></span>
  </DmButton>;
}
