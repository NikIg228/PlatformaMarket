import { Tag } from "@fluentui/react-components";

import { formatDocumentAmount } from "./document-upload-model";

export const categoryLabels: Record<string, string> = {
  CONTRACT: "Договоры",
  ORDER: "Заказы",
  PAYMENT: "Оплата",
  SHIPMENT: "Отгрузка",
  CLOSING: "Закрывающие",
  COMPLIANCE: "Разрешительные",
  OTHER: "Прочее",
};

export const kindLabels: Record<string, string> = {
  MARKETPLACE_SUPPLIER_AGREEMENT: "Договор с площадкой",
  MARKETPLACE_BUYER_TERMS: "Условия для покупателя",
  FRAMEWORK_SUPPLY_AGREEMENT: "Рамочный договор поставки",
  CONTRACT_ADDENDUM: "Дополнительное соглашение",
  ORDER_SPECIFICATION: "Спецификация",
  ORDER_CONFIRMATION: "Подтверждение заказа",
  INVOICE: "Счёт на оплату",
  PAYMENT_PROOF: "Квитанция о заявленном переводе",
  PAYMENT_CONFIRMATION: "Подтверждение оплаты",
  REFUND_CONFIRMATION: "Подтверждение возврата",
  WAYBILL: "Накладная",
  ACCEPTANCE_ACT: "Акт приёма-передачи",
  ACCOMPANYING_DOCUMENT: "Сопроводительный документ",
  TAX_CLOSING_DOCUMENT: "Закрывающий документ",
  INSTALLATION_ACT: "Акт монтажа",
  TRAINING_ACT: "Акт обучения",
  WARRANTY: "Гарантия",
  COMMISSIONING_ACT: "Акт ввода в эксплуатацию",
  REGISTRATION_CERTIFICATE: "Регистрационное удостоверение",
  LICENSE: "Лицензия",
  CERTIFICATE: "Сертификат",
  OTHER: "Прочий документ",
};

export const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  GENERATING: "Формируется",
  GENERATED: "Готов",
  AWAITING_SIGNATURE: "Ожидает подписи",
  PARTIALLY_SIGNED: "Подписан частично",
  SIGNED: "Подписан",
  REJECTED: "Отклонён",
  EXPIRED: "Истёк",
  SUPERSEDED: "Есть новая версия",
  ARCHIVED: "Архивирован",
  FAILED: "Ошибка",
  NOT_APPLICABLE: "Не требуется",
  PENDING_REVIEW: "На проверке",
  REVIEWED: "Проверен",
  RECONCILED: "Сверен",
  DISPUTED: "Есть расхождение",
};

export const formatDate = (value: string, timeZone?: string) =>
  new Intl.DateTimeFormat("ru-KZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));

export const formatMoney = formatDocumentAmount;

export function DocumentStatus({ value }: { value: string }) {
  const tone = ["SIGNED", "GENERATED", "RECONCILED", "REVIEWED"].includes(value)
    ? "success"
    : ["FAILED", "REJECTED", "DISPUTED", "EXPIRED"].includes(value)
      ? "danger"
      : ["AWAITING_SIGNATURE", "PARTIALLY_SIGNED", "PENDING_REVIEW"].includes(
            value,
          )
        ? "warning"
        : "brand";
  return (
    <Tag
      appearance="outline"
      className={`dm-document-tag dm-document-tag-${tone}`}
    >
      {statusLabels[value] ?? value}
    </Tag>
  );
}
