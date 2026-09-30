"use client";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea, StatusTag } from "@marketplace/ui";
import { formatAdminStatus } from "../admin-labels";
import styles from "../supplier-operations.module.css";
import type { SupplierOperationsModel } from "./use-supplier-operations";
import type { SupplierProfile } from "./types";
const demoCsv = `id,name,sku,gtin,price,currency,stock,lot,expires
WEB-001,Демонстрационный стоматологический композит,DEMO-COMP-A2,1234567890123,129000,KZT,24,WEB-LOT-01,2028-06-30`;

export function SupplierImport({ activeSupplier, busy, uploadCsv, batches, items, confirmMatch }: Pick<SupplierOperationsModel, "busy" | "uploadCsv" | "batches" | "items" | "confirmMatch"> & { activeSupplier: SupplierProfile }) {
  return (
          <article className={styles.panel}>
            <header>
              <span>02</span>
              <div>
                <h3>Загрузка и проверка товаров</h3>
                <p>Загрузите файл и свяжите товары с карточками каталога.</p>
              </div>
            </header>
            <form className={styles.form} onSubmit={uploadCsv}>
              <DmField label="Способ загрузки" required>
                <DmSelect name="sourceId" required>
                  <option value="">Выберите</option>
                  {activeSupplier.dataSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Имя файла" required>
                <DmInput name="fileName" defaultValue="web-price.csv" required />
              </DmField>
              <DmField
                className={styles.wide}
                label="Данные CSV"
                hint="Первая строка должна содержать названия колонок. Исходный файл сохраняется для аудита."
                required
              >
                <DmTextarea name="csv" rows={5} defaultValue={demoCsv} required />
              </DmField>
              <DmButton type="submit" appearance="primary" disabled={Boolean(busy)}>
                {busy === "upload" ? "Обрабатываем…" : "Загрузить и обработать"}
              </DmButton>
            </form>
            <div className={styles.records}>
              {batches.slice(0, 3).map((batch) => (
                <div className={styles.record} key={batch.id}>
                  <div>
                    <strong>{batch.fileName}</strong>
                    <small>
                      {formatAdminStatus(batch.status)}. {batch.processedRows}/{batch.totalRows}.
                      ошибок {batch.errorRows}
                    </small>
                  </div>
                  <time>
                    {new Date(batch.createdAt).toLocaleDateString("ru-KZ")}
                  </time>
                </div>
              ))}
            </div>
            <div className={styles.matches}>
              {items.slice(0, 4).map((item) => {
                const candidate = item.matchCandidates[0];
                return (
                  <div className={styles.match} key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.externalId} ·{" "}
                        {item.matchedVariantId
                          ? "Найден в каталоге"
                          : candidate
                            ? `Похож на ${candidate.productVariant.product.canonicalName}`
                            : "Совпадений нет"}
                      </small>
                    </div>
                    {!item.matchedVariantId && candidate && (
                      <DmButton
                        appearance="secondary"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void confirmMatch(item, candidate.productVariant.id)
                        }
                      >
                        {busy === `match:${item.id}` ? "Подтверждаем…" : "Подтвердить"}
                      </DmButton>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
  );
}
