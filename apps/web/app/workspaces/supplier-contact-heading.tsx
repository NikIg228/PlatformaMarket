"use client";
import { DmInfoTip } from "@marketplace/ui";
import styles from "./account-settings.module.css";

export function SupplierContactHeading({ index }: { index: number }) {
  const title = index === 0 ? "Официальный контакт" : `Резервный контакт ${index}`;
  return <div className={styles.contactHeading}><h3>{title}</h3><span className={styles.muted}>{index === 0 ? "Публичный · обязательный" : "Для заказов · обязательный"}</span>
    <DmInfoTip label={`Где используется ${index === 0 ? "официальный" : "резервный"} контакт${index ? ` ${index}` : ""}`}>
      {index === 0 ? "Основной контакт вашей компании. Имя представителя, телефон и почта отображаются в каталоге рядом с предложениями поставщика и в заказах. Укажите официальный номер и почту организации, доступные покупателям."
        : "Контакт сотрудника, с которым можно связаться по заказу, если основной представитель недоступен. Его имя, телефон и почта видны участникам заказа и сотрудникам площадки с доступом к заказу. В публичном каталоге эти данные не отображаются."}
    </DmInfoTip>
  </div>;
}
