"use client";
import { Option } from "@fluentui/react-components";
import { DmField, DmFluentDropdown, DmInput } from "@marketplace/ui";
import type { OrganizationProfileFields } from "@marketplace/schemas";
import type { SettingsCity } from "./settings-organization";
import styles from "./account-settings.module.css";
export function SettingsAddresses({ fields, cities, disabled, errors, onChange }: { fields: OrganizationProfileFields; cities: SettingsCity[]; disabled: boolean; errors: Record<string, string>; onChange: (kind: "legalAddress" | "deliveryAddress", key: "cityId" | "line1" | "postalCode", value: string) => void }) {
  return <div className={styles.addresses}>{([['legalAddress', 'Юридический адрес'], ['deliveryAddress', 'Адрес получения']] as const).map(([kind, title]) => <div key={kind} role="group" aria-label={title} className={styles.address}>
    <h3>{title}</h3>
    <DmField label="Город" required validationState={errors[`${kind}.cityId`] ? "error" : "none"} validationMessage={errors[`${kind}.cityId`]}>
      <DmFluentDropdown aria-label={`${title}: город`} placeholder="Выберите город" disabled={disabled} value={cities.find(city => city.id === fields[kind].cityId)?.nameRu ?? ""} selectedOptions={[fields[kind].cityId]} onOptionSelect={(_, data) => onChange(kind, "cityId", data.optionValue ?? "")}>
        {cities.map(city => <Option key={city.id} value={city.id} text={city.nameRu}>{city.nameRu}{city.region ? ` · ${city.region.nameRu}` : ""}</Option>)}
      </DmFluentDropdown>
    </DmField>
    <DmField label="Адрес" required validationState={errors[`${kind}.line1`] ? "error" : "none"} validationMessage={errors[`${kind}.line1`]}>
      <DmInput aria-label={`${title}: адрес`} value={fields[kind].line1} disabled={disabled} maxLength={500} placeholder="Улица, дом, помещение" onChange={(_, data) => onChange(kind, "line1", data.value)} />
    </DmField>
    <DmField label="Почтовый индекс"><DmInput aria-label={`${title}: почтовый индекс`} value={fields[kind].postalCode ?? ""} disabled={disabled} maxLength={20} onChange={(_, data) => onChange(kind, "postalCode", data.value)} /></DmField>
  </div>)}</div>;
}
