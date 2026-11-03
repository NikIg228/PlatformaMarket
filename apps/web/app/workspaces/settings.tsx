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
import { SettingsStorefront } from "./settings-storefront";
import { SettingsCalendar } from "./settings-calendar";
import styles from "./account-settings.module.css";
import { workspaceText } from "./workspace-locale";
export default function Settings() {
  const { role, organizationId, locale } = useWorkspace();
  const [dirty, setDirty] = useState(false);
  const query = useSearchParams(), router = useRouter();
  const t = (text: string) => workspaceText(locale, text);
  const tab = query.get("tab") === "signing" ? "signing" : query.get("tab") === "requisites" ? "requisites" : role === "supplier" && ["calendar", "storefront", "vat", "warehouses", "sources"].includes(query.get("tab") ?? "") ? query.get("tab")! : "organization";
  return <div className={styles.page}>
    <DmTabList lang={locale} aria-label={t(role === "supplier" ? "Настройки поставщика" : "Настройки клиники")} selectedValue={tab} onTabSelect={(_, data) => {
      if (data.value === tab || (dirty && !window.confirm(t("Есть несохранённые изменения. Покинуть вкладку?")))) return;
      const params = new URLSearchParams(query.toString());
      if (data.value === "organization") params.delete("tab"); else params.set("tab", String(data.value));
      router.push(`/${role}/settings${params.size ? `?${params}` : ""}`);
    }}>
      <Tab value="organization">{t("Организация")}</Tab><Tab value="requisites">{t("Реквизиты")}</Tab><Tab value="signing">{t("Подписант")}</Tab>{role === "supplier" ? <><Tab value="storefront">{t("Витрина")}</Tab><Tab value="calendar">{t("Рабочий календарь")}</Tab><Tab value="vat">{t("НДС товаров")}</Tab><Tab value="warehouses">{t("Склады")}</Tab><Tab value="sources">{t("Источники товаров")}</Tab></> : null}
    </DmTabList>
    {tab === "calendar" ? <PermissionBoundary key="calendar" required={["organization.view"]}><SettingsCalendar key={organizationId} locale={locale} onDirtyChange={setDirty} /></PermissionBoundary> : tab === "storefront" ? <PermissionBoundary key="storefront" required={["organization.view"]}><SettingsStorefront key={organizationId} onDirtyChange={setDirty} /></PermissionBoundary> : tab === "signing" ? <SettingsSigningAdmission key={organizationId} onDirtyChange={setDirty} /> : tab === "vat" ? <PermissionBoundary key="vat" required={["catalog.product.view"]}><SettingsVat onDirtyChange={setDirty} /></PermissionBoundary> : tab === "requisites" ? <PermissionBoundary key="requisites" required={["organization.view"]}><SettingsRequisites onDirtyChange={setDirty} /></PermissionBoundary> : tab === "organization" ? <PermissionBoundary key="organization" required={["organization.view"]}><OrganizationSettings onDirtyChange={setDirty} /></PermissionBoundary> : tab === "warehouses" ? <PermissionBoundary key="warehouses" required={["inventory.view"]}><SettingsWarehouses onDirtyChange={setDirty} /></PermissionBoundary> : <PermissionBoundary key="sources" required={["import.manage"]}><SettingsSources onDirtyChange={setDirty} /></PermissionBoundary>}
  </div>;
}
