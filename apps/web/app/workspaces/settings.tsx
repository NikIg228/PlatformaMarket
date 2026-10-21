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
import { SettingsRequisites } from "./settings-requisites";
import { SettingsVat } from "./settings-vat";
import { SettingsSigningAdmission } from "./settings-signing-admission";
import styles from "./account-settings.module.css";
export default function Settings() {
  const { role, organizationId } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const query = useSearchParams(), router = useRouter();
  const tab = query.get("tab") === "signing" ? "signing" : query.get("tab") === "requisites" ? "requisites" : role === "supplier" && ["vat", "warehouses", "sources"].includes(query.get("tab") ?? "") ? query.get("tab")! : "organization";
  return <div className={styles.page}>
    <DmTabList aria-label={role === "supplier" ? "Настройки поставщика" : "Настройки клиники"} selectedValue={tab} onTabSelect={(_, data) => {
      if (data.value === tab || (dirty && !window.confirm("Есть несохранённые изменения. Покинуть вкладку?"))) return;
      router.push(data.value === "organization" ? `/${role}/settings` : `/${role}/settings?tab=${data.value}`);
    }}>
      <Tab value="organization">Организация</Tab><Tab value="requisites">Реквизиты</Tab><Tab value="signing">Подписант</Tab>{role === "supplier" ? <><Tab value="vat">НДС товаров</Tab><Tab value="warehouses">Склады</Tab><Tab value="sources">Источники товаров</Tab></> : null}
    </DmTabList>
    {tab === "signing" ? <SettingsSigningAdmission key={organizationId} onDirtyChange={setDirty} /> : tab === "vat" ? <PermissionBoundary key="vat" required={["catalog.product.view"]}><SettingsVat onDirtyChange={setDirty} /></PermissionBoundary> : tab === "requisites" ? <PermissionBoundary key="requisites" required={["organization.view"]}><SettingsRequisites onDirtyChange={setDirty} /></PermissionBoundary> : tab === "organization" ? <PermissionBoundary key="organization" required={["organization.view"]}><OrganizationSettings onDirtyChange={setDirty} /></PermissionBoundary> : tab === "warehouses" ? <PermissionBoundary key="warehouses" required={["inventory.view"]}><SettingsWarehouses onDirtyChange={setDirty} /></PermissionBoundary> : <PermissionBoundary key="sources" required={["import.manage"]}><SettingsSources onDirtyChange={setDirty} /></PermissionBoundary>}
  </div>;
}
