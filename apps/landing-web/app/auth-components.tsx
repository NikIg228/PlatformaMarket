"use client";
import { DmAction } from "@marketplace/ui/controls";


import { DmButton } from "@marketplace/ui";
import type { AuthCapability, AuthFeedback } from "./auth-client";
import styles from "./auth-brand.module.css";

export function AuthBrand({ href = "/" }: { href?: string }) {
  return (
    <a className={`brand ${styles.link}`} href={href} aria-label="Platforma Market">
      <img className={styles.logo} src="/brand/platforma-logo.webp" width={56} height={56} alt="" />
      <strong className={styles.name}>
        Platforma Market
      </strong>
    </a>
  );
}

export function AuthRolePicker({
  value,
  onChange,
  disabled = false,
  registration = false,
}: {
  value: AuthCapability;
  onChange: (value: AuthCapability) => void;
  disabled?: boolean;
  registration?: boolean;
}) {
  return (
    <div className="rolePicker" role="group" aria-label="Тип кабинета">
      <DmAction variant="choice"
        type="button"

        data-selected={value === "BUYER"}
        aria-pressed={value === "BUYER"}
        disabled={disabled}
        onClick={() => onChange("BUYER")}
      >
        <b>Клиника</b>
        <span>
          {registration ? "Закупки, бюджеты и документы" : "Магазин и закупки"}
        </span>
      </DmAction>
      <DmAction variant="choice"
        type="button"

        data-selected={value === "SUPPLIER"}
        aria-pressed={value === "SUPPLIER"}
        disabled={disabled}
        onClick={() => onChange("SUPPLIER")}
      >
        <b>Поставщик</b>
        <span>
          {registration ? "Каталог, заказы и договор ЭЦП" : "Продажи и товары"}
        </span>
      </DmAction>
    </div>
  );
}

export function AuthNotice({ feedback }: { feedback: AuthFeedback }) {
  return (
    <div
      className={`authNotice authNotice-${feedback.kind}`}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      <strong>{feedback.title ?? (feedback.kind === "error" ? "Нужно исправить" : "Готово")}</strong>
      <span>{feedback.message}</span>
      {feedback.requestId ? (
        <small>Код обращения: {feedback.requestId}</small>
      ) : null}
    </div>
  );
}
