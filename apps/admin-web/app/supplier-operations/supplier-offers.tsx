"use client";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea, StatusTag } from "@marketplace/ui";
import { formatAdminStatus } from "../admin-labels";
import styles from "../supplier-operations.module.css";
import type { SupplierOperationsModel } from "./use-supplier-operations";
import type { SupplierProfile } from "./types";
export function SupplierOffers({ activeSupplier, busy, createOffer, activateOffer, products, offers }: Pick<SupplierOperationsModel, "busy" | "createOffer" | "activateOffer" | "products" | "offers"> & { activeSupplier: SupplierProfile }) {
  return (
          <article className={styles.panel}>
            <header>
              <span>03</span>
              <div>
                <h3>Предложение, цена и публикация</h3>
                <p>Укажите товар, цену и условия продажи.</p>
              </div>
            </header>
            <form className={styles.form} onSubmit={createOffer}>
              <DmField className={styles.wide} label="Вариант товара" required>
                <DmSelect name="productVariantId" required>
                  <option value="">Выберите</option>
                  {products.flatMap((product) =>
                    product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {product.canonicalName} · {variant.sku ?? "без SKU"}
                      </option>
                    )),
                  )}
                </DmSelect>
              </DmField>
              <DmField label="Способ загрузки">
                <DmSelect name="sourceId">
                  <option value="">Ручной</option>
                  {activeSupplier.dataSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="SKU поставщика">
                <DmInput name="supplierSku" />
              </DmField>
              <DmButton type="submit" appearance="primary" disabled={Boolean(busy)}>
                {busy === "offer" ? "Создаём…" : "Создать предложение"}
              </DmButton>
            </form>
            <form className={styles.form} onSubmit={activateOffer}>
              <DmField className={styles.wide} label="Предложение" required>
                <DmSelect name="offerId" required>
                  <option value="">Выберите</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.productVariant.product.canonicalName}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Цена, тиын" required>
                <DmInput
                  name="amountMinor"
                  type="number"
                  min="0"
                  defaultValue="129000"
                  required
                />
              </DmField>
              <DmField label="Фактический остаток" required>
                <DmInput
                  name="quantityOnHand"
                  type="number"
                  min="0"
                  defaultValue="24"
                  required
                />
              </DmField>
              <DmField label="Страховой запас">
                <DmInput
                  name="safetyStock"
                  type="number"
                  min="0"
                  defaultValue="2"
                />
              </DmField>
              <DmField label="Склад" required>
                <DmSelect name="warehouseId" required>
                  <option value="">Выберите</option>
                  {activeSupplier.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmButton type="submit" appearance="primary" disabled={Boolean(busy)}>
                {busy === "publish" ? "Публикуем…" : "Обновить и опубликовать"}
              </DmButton>
            </form>
            <div className={styles.records}>
              {offers.slice(0, 5).map((offer) => (
                <div className={styles.record} key={offer.id}>
                  <div>
                    <strong>
                      {offer.productVariant.product.canonicalName}
                    </strong>
                    <small>
                      {formatAdminStatus(offer.status)}. {formatAdminStatus(offer.publication?.status ?? "DRAFT")}.
                      v{offer.version}
                    </small>
                  </div>
                  <StatusTag tone={offer.publication?.marketplaceVisible ? "success" : "neutral"}>
                    {offer.prices.find(({ status }) => status === "ACTIVE")
                      ?.amountMinor ?? "Нет цены"}{" "}
                    тиын
                  </StatusTag>
                </div>
              ))}
            </div>
          </article>
  );
}
