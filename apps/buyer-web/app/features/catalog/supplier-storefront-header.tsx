"use client";
import { useRef, useState } from "react";
import { Avatar } from "@fluentui/react-components";
import { ChevronRight20Regular } from "@fluentui/react-icons/svg/chevron-right";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmHeading } from "@marketplace/ui";
import { DmDialog } from "@marketplace/ui/primitives";
import type { SupplierStorefront } from "@marketplace/schemas";
import { supplierLogoSource } from "./supplier-identity";
import styles from "./supplier-storefront.module.css";

export function SupplierStorefrontHeader({ profile, locale }: { profile: SupplierStorefront; locale: "ru" | "kk" }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const t = locale === "kk"
    ? { about: "Жеткізуші туралы", location: "Орналасқан жері", hours: "Жұмыс кестесі", delivery: "Жеткізу", empty: "Жеткізуші қосымша ақпаратты әлі қоспаған." }
    : { about: "О поставщике", location: "Расположение", hours: "График работы", delivery: "Доставка", empty: "Поставщик пока не добавил дополнительную информацию." };
  const text = (key: "description" | "location" | "hours" | "delivery") => profile.content[locale][key] || profile.content.ru[key] || profile.content.kk[key];
  const details = (["location", "hours", "delivery"] as const).filter(key => text(key));
  return <>
    <DmSurface className={styles.surface}>
      <div className={styles.title}>
        <Avatar name={profile.name} size={48} image={{ src: supplierLogoSource(profile.supplierId, Boolean(profile.logoUrl)) }} aria-hidden="true" />
        <DmHeading level={1} size="page" inline title={profile.name} />
      </div>
      <DmButton ref={trigger} onClick={() => setOpen(true)} aria-haspopup="dialog" icon={<ChevronRight20Regular />} iconPosition="after">{t.about}</DmButton>
    </DmSurface>
    <DmDialog open={open} onOpenChange={setOpen} onClosed={() => trigger.current?.focus({ preventScroll: true })} title={t.about} description={profile.name}>
      <div className={styles.about}>
        {text("description") ? <p className={styles.description}>{text("description")}</p> : null}
        {details.length ? <dl className={styles.details}>{details.map(key => <div key={key}><dt>{t[key]}</dt><dd>{text(key)}</dd></div>)}</dl> : null}
        {profile.contact ? <div className={styles.contact}>
          <span>{profile.contact.contactName}</span>
          <DmButton as="a" appearance="subtle" href={`tel:${profile.contact.phone.replace(/[^+\d]/g, "")}`}>{profile.contact.phone}</DmButton>
          <DmButton as="a" appearance="subtle" href={`mailto:${profile.contact.email}`}>{profile.contact.email}</DmButton>
        </div> : null}
        {!text("description") && !details.length && !profile.contact ? <p className={styles.description}>{t.empty}</p> : null}
      </div>
    </DmDialog>
  </>;
}
