"use client";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea, StatusTag } from "@marketplace/ui";
import { formatAdminStatus } from "../admin-labels";
import styles from "../supplier-operations.module.css";
import type { SupplierOperationsModel } from "./use-supplier-operations";
import type { SupplierProfile } from "./types";
export function SupplierInventory({ busy, createLot, reserve, balances }: Pick<SupplierOperationsModel, "busy" | "createLot" | "reserve" | "balances">) {
  return (
          <article className={styles.panel}>
            <header>
              <span>04</span>
              <div>
                <h3>Партии и резервы</h3>
                <p>Сроки годности, актуальность данных и доступность по складам.</p>
              </div>
            </header>
            <form className={styles.form} onSubmit={createLot}>
              <DmField className={styles.wide} label="Остаток" required>
                <DmSelect name="balanceId" required>
                  <option value="">Выберите</option>
                  {balances.map((balance) => (
                    <option key={balance.id} value={balance.id}>
                      {balance.productVariant.product.canonicalName} · доступно{" "}
                      {balance.quantityAvailable}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Номер партии" required>
                <DmInput name="lotNumber" required placeholder="LOT-2026-001" />
              </DmField>
              <DmField label="Годен до" required>
                <DmInput name="expirationDate" type="date" required />
              </DmField>
              <DmField label="Количество" required>
                <DmInput name="quantityOnHand" type="number" min="0" required />
              </DmField>
              <DmButton type="submit" appearance="secondary" disabled={Boolean(busy)}>
                {busy === "lot" ? "Добавляем…" : "Добавить партию"}
              </DmButton>
            </form>
            <form className={styles.form} onSubmit={reserve}>
              <DmField label="Остаток" required>
                <DmSelect name="balanceId" required>
                  <option value="">Выберите</option>
                  {balances.map((balance) => (
                    <option key={balance.id} value={balance.id}>
                      {balance.warehouse.code} · {balance.quantityAvailable}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Количество" required>
                <DmInput
                  name="quantity"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  required
                />
              </DmField>
              <DmField
                className={styles.wide}
                label="Ключ идемпотентности"
                hint="Повтор запроса с тем же ключом не уменьшит остаток второй раз."
                required
              >
                <DmInput
                  name="idempotencyKey"
                  minLength={8}
                  required
                  placeholder="checkout-demo-001"
                />
              </DmField>
              <DmButton type="submit" appearance="primary" disabled={Boolean(busy)}>
                {busy === "reserve" ? "Резервируем…" : "Зарезервировать"}
              </DmButton>
            </form>
            <div className={styles.records}>
              {balances.slice(0, 5).map((balance) => (
                <div className={styles.record} key={balance.id}>
                  <div>
                    <strong>
                      {balance.productVariant.product.canonicalName}
                    </strong>
                    <small>
                      {balance.warehouse.name}. {formatAdminStatus(balance.freshnessStatus)}.
                      lots {balance.lots.length}
                    </small>
                  </div>
                  <StatusTag tone={balance.freshnessStatus === "FRESH" ? "success" : "warning"}>
                    {balance.quantityAvailable} из {balance.quantityOnHand}
                  </StatusTag>
                </div>
              ))}
            </div>
          </article>
  );
}
