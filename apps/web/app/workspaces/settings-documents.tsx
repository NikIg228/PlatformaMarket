"use client";
import { SupplierTermsPanel } from "../../../supplier-web/app/supplier-terms-panel";
import { Credentials } from "./credentials";
import { PermissionBoundary } from "./permission-boundary";
import { useWorkspace } from "./workspace";
import styles from "./account-settings.module.css";
export function SettingsDocuments() {
  const { apiContext } = useWorkspace();
  return <div className={styles.page}>
    <SupplierTermsPanel apiContext={apiContext} />
    <PermissionBoundary required={["compliance.view"]}><Credentials /></PermissionBoundary>
  </div>;
}
