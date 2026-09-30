"use client";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea, StatusTag } from "@marketplace/ui";
import { formatAdminStatus } from "../admin-labels";
import styles from "../supplier-operations.module.css";
import type { SupplierOperationsModel } from "./use-supplier-operations";
import type { SupplierProfile } from "./types";
export function SupplierSetup({ activeSupplier, busy, createWarehouse, createSource }: Pick<SupplierOperationsModel, "busy" | "createWarehouse" | "createSource"> & { activeSupplier: SupplierProfile }) {
  return (
          <article className={styles.panel}>
            <header>
              <span>01</span>
              <div>
                <h3>Поставщик и загрузка товаров</h3>
                <p>
                  {activeSupplier.organization.displayName} · БИН{" "}
                  {activeSupplier.organization.bin}
                </p>
              </div>
            </header>
            <div className={styles.stats}>
              <b>
                {activeSupplier.warehouses.length}
                <small>складов</small>
              </b>
              <b>
                {activeSupplier.dataSources.length}
                <small>способов загрузки</small>
              </b>
              <b>
                {activeSupplier._count.importBatches}
                <small>загрузок</small>
              </b>
            </div>
            <form className={styles.form} onSubmit={createWarehouse}>
              <DmField label="Код склада" required>
                <DmInput name="code" required placeholder="AST-02" />
              </DmField>
              <DmField label="Название" required>
                <DmInput name="name" required placeholder="Склад Астана" />
              </DmField>
              <DmField className={styles.wide} label="Адрес">
                <DmInput name="addressLine" placeholder="ул. ..." />
              </DmField>
              <DmButton type="submit" appearance="secondary" disabled={Boolean(busy)}>
                {busy === "warehouse" ? "Добавляем…" : "Добавить склад"}
              </DmButton>
            </form>
            <form className={styles.form} onSubmit={createSource}>
              <DmField label="Название" required>
                <DmInput name="name" required placeholder="Прайс отдела продаж" />
              </DmField>
              <DmField label="Тип" required>
                <DmSelect name="type" defaultValue="CSV" required>
                  <option value="CSV">CSV</option>
                  <option value="EXCEL">Excel</option>
                  <option value="MANUAL">Ручной ввод</option>
                  <option value="API">Прямое подключение</option>
                  <option value="ERP">1С</option>
                </DmSelect>
              </DmField>
              <DmButton type="submit" appearance="secondary" disabled={Boolean(busy)}>
                {busy === "source" ? "Добавляем…" : "Добавить способ"}
              </DmButton>
            </form>
          </article>
  );
}
