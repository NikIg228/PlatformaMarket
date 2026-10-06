"use client";
import { Option } from "@fluentui/react-components";
import { DmFluentDropdown as Dropdown } from "@marketplace/ui/controls";
import { dmDropdownPositioning } from "@marketplace/ui";
import { useDeliveryContext } from "./delivery-context";
import styles from "./header.module.css";

export default function CityPicker() {
  const delivery = useDeliveryContext();
  return <Dropdown inlinePopup positioning={dmDropdownPositioning} className={styles.cityDropdown} listbox={{ className: styles.cityListbox }}
    aria-label="Город доставки" placeholder="Выберите город" value={delivery.city?.nameRu ?? ""}
    selectedOptions={delivery.city ? [delivery.city.id] : []}
    onOptionSelect={(_, data) => delivery.choose(data.optionValue ?? "", delivery.inCity)}>
    <Option value="">Без выбранного города</Option>
    {delivery.cities.map(city => <Option key={city.id} value={city.id}>{city.nameRu}</Option>)}
  </Dropdown>;
}
