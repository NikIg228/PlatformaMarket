"use client";

import { useSearchParams } from "next/navigation";
import { AddOfferWizard } from "../../../supplier-web/app/features/supplier-workspace/add-offer-wizard";
import { ProductProposalForm } from "../../../supplier-web/app/features/supplier-workspace/product-proposal-form";
import { PermissionBoundary } from "./permission-boundary";
import { useWorkspace } from "./workspace";
import styles from "./workspace.module.css";

export function AddProductPage() {
  return <div className={styles.stack} aria-label="Добавить товар"><PermissionBoundary required={["catalog.offer.edit", "catalog.product.view"]}><AddProduct /></PermissionBoundary></div>;
}

function AddProduct() {
  const { api, organizationId } = useWorkspace();
  const request = useSearchParams().get("request") === "1";
  return request ? <ProductProposalForm api={api} /> : <AddOfferWizard api={api} supplierId={organizationId} />;
}
