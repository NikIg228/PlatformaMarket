"use client";
import { Tab } from "@fluentui/react-components";
import { DmTabList } from "@marketplace/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "./workspace";
import { OrganizationSettings } from "./settings-organization";
import { SettingsWarehouses } from "./settings-supplier";
import { SettingsSources } from "./settings-sources";
import { PermissionBoundary } from "./permission-boundary";
import { SettingsDocuments } from "./settings-documents";
import styles from "./account-settings.module.css";
export default function Settings() {
  const { role } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const query = useSearchParams(), router = useRouter();
  const tab = role === "supplier" && ["warehouses", "sources", "documents"].includes(query.get("tab") ?? "") ? query.get("tab")! : "organization";
  return <div className={styles.page}>
    {role === "supplier" ? <DmTabList aria-label="Настройки поставщика" selectedValue={tab} onTabSelect={(_, data) => {
      if (data.value === tab || (dirty && !window.confirm("Есть несохранённые изменения. Покинуть вкладку?"))) return;
      router.push(data.value === "organization" ? "/supplier/settings" : `/supplier/settings?tab=${data.value}`);
    }}>
      <Tab value="organization">Организация</Tab><Tab value="warehouses">Склады</Tab><Tab value="sources">Источники товаров</Tab><Tab value="documents">Договор и документы</Tab>
    </DmTabList> : null}
    {tab === "documents" ? <SettingsDocuments /> : tab === "organization" ? <PermissionBoundary key="organization" required={["organization.view"]}><OrganizationSettings onDirtyChange={setDirty} /></PermissionBoundary> : tab === "warehouses" ? <PermissionBoundary key="warehouses" required={["inventory.view"]}><SettingsWarehouses onDirtyChange={setDirty} /></PermissionBoundary> : <PermissionBoundary key="sources" required={["import.manage"]}><SettingsSources onDirtyChange={setDirty} /></PermissionBoundary>}
  </div>;
}
