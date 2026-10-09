"use client";
import { dmLinkButtonProps } from "@marketplace/ui/link-button";

import Link from "next/link";
import { frontendFeatures } from "@marketplace/api-client";
import { AddSquare24Regular } from "@fluentui/react-icons/svg/add-square";
import { ArrowUpload24Regular } from "@fluentui/react-icons/svg/arrow-upload";
import { DocumentAdd24Regular } from "@fluentui/react-icons/svg/document-add";
import { DocumentEdit24Regular } from "@fluentui/react-icons/svg/document-edit";
import { BoxMultiple24Regular } from "@fluentui/react-icons/svg/box-multiple";
import { Tag24Regular } from "@fluentui/react-icons/svg/tag";
import { supplierProductLinks } from "./supplier-product-pages";
import styles from "./products.module.css";

const sectionIcons = {
  "/supplier/products/proposals": DocumentAdd24Regular,
  "/supplier/products/corrections": DocumentEdit24Regular,
  "/supplier/products/inventory": BoxMultiple24Regular,
};

export function ProductActions() {
  return (
    <div role="group" aria-label="Действия с товарами" className={styles.actions} data-promotions={frontendFeatures.promotions}>
      <Link href="/supplier/products/new" {...dmLinkButtonProps({ className: styles.card })}>
        <AddSquare24Regular className={styles.icon} aria-hidden="true" />
        <span>Добавить товар</span>
      </Link>
      <Link href="/supplier/products/import" {...dmLinkButtonProps({ className: styles.card })}>
        <ArrowUpload24Regular className={styles.icon} aria-hidden="true" />
        <span>Загрузить из файла</span>
      </Link>
      {supplierProductLinks.map(([href, label]) => {
        const Icon = sectionIcons[href];
        return (
          <Link key={href} href={href} {...dmLinkButtonProps({ className: styles.card })}>
            <Icon className={styles.icon} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
      {frontendFeatures.promotions ? (
        <Link href="/supplier/products/promotions" {...dmLinkButtonProps({ className: styles.card })}>
          <Tag24Regular className={styles.icon} aria-hidden="true" />
          <span>Акции</span>
        </Link>
      ) : null}
    </div>
  );
}
