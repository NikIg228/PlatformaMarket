"use client";
import { Tab, TabList } from "@fluentui/react-components";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "./workspace";
import { OrganizationSettings } from "./settings-organization";
import { SettingsWarehouses, SettingsSources } from "./settings-supplier";
import { PermissionBoundary } from "./permission-boundary";
import styles from "./account-settings.module.css";
export default function Settings() {
  const { role } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const query = useSearchParams(), router = useRouter();
  const tab = role === "supplier" && ["warehouses", "sources"].includes(query.get("tab") ?? "") ? query.get("tab")! : "organization";
  return <div className={styles.page}>
    {role === "supplier" ? <TabList className={styles.tabs} aria-label="Настройки поставщика" selectedValue={tab} onTabSelect={(_, data) => {
      if (data.value === tab || (dirty && !window.confirm("Есть несохранённые изменения. Покинуть вкладку?"))) return;
      router.push(data.value === "organization" ? "/supplier/settings" : `/supplier/settings?tab=${data.value}`);
    }}>
      <Tab value="organization">Организация</Tab><Tab value="warehouses">Склады</Tab><Tab value="sources">Источники товаров</Tab>
    </TabList> : null}
    {tab === "organization" ? <PermissionBoundary key="organization" required={["organization.view"]}><OrganizationSettings onDirtyChange={setDirty} /></PermissionBoundary> : tab === "warehouses" ? <PermissionBoundary key="warehouses" required={["inventory.view"]}><SettingsWarehouses onDirtyChange={setDirty} /></PermissionBoundary> : <PermissionBoundary key="sources" required={["import.manage"]}><SettingsSources /></PermissionBoundary>}
  </div>;
}
