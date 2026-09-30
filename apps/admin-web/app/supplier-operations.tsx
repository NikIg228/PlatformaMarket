"use client";
import { DmButton, DmFeedback, DmSelect, EmptyState, LoadingState } from "@marketplace/ui";
import styles from "./supplier-operations.module.css";
import { useSupplierOperations } from "./supplier-operations/use-supplier-operations";
import { SupplierSetup } from "./supplier-operations/supplier-setup";
import { SupplierImport } from "./supplier-operations/supplier-import";
import { SupplierOffers } from "./supplier-operations/supplier-offers";
import { SupplierInventory } from "./supplier-operations/supplier-inventory";

export function SupplierOperations() {
  const { suppliers, supplierId, selectSupplier, batches, items, products, offers, balances, loading, message, messageTone, busy, load, activeSupplier, createWarehouse, createSource, uploadCsv, confirmMatch, createOffer, activateOffer, createLot, reserve } = useSupplierOperations();
  return (
    <section
      id="supplier-data"
      className={styles.section}
      aria-label="Товары поставщика"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>ITERATION 1B / SUPPLIER DATA</span>
          <h2>От прайса до доступного остатка</h2>
          <p>
            Сквозной путь сохраняет исходную строку и разделяет коммерческие
            состояния.
          </p>
        </div>
        <div className={styles.actions}>
          <DmSelect
            aria-label="Активный поставщик"
            value={supplierId}
            onChange={(_, data) => selectSupplier(data.value)}
            disabled={loading || Boolean(busy)}
          >
            {suppliers.map((supplier) => (
              <option
                key={supplier.organizationId}
                value={supplier.organizationId}
              >
                {supplier.organization.displayName}
              </option>
            ))}
          </DmSelect>
          <DmButton
            appearance="secondary"
            onClick={() => void load()}
            disabled={loading || Boolean(busy)}
          >
            Обновить
          </DmButton>
        </div>
      </div>
      {message ? (
        <DmFeedback
          tone={messageTone}
          title={
            messageTone === "danger"
              ? "Операция не выполнена"
              : messageTone === "success"
                ? "Операция выполнена"
                : "Нужна настройка"
          }
          description={message}
          alert={messageTone === "danger"}
        />
      ) : null}
      {loading ? (
        <LoadingState label="Загружаем данные поставщика" />
      ) : !activeSupplier ? (
        <EmptyState
          title="Поставщик не найден"
          description="Создайте или выберите поставщика, чтобы настроить загрузку, предложения и остатки."
        />
      ) : (
        <div className={styles.grid}>
          <SupplierSetup activeSupplier={activeSupplier} busy={busy} createWarehouse={createWarehouse} createSource={createSource} />

          <SupplierImport activeSupplier={activeSupplier} busy={busy} uploadCsv={uploadCsv} batches={batches} items={items} confirmMatch={confirmMatch} />

          <SupplierOffers activeSupplier={activeSupplier} busy={busy} createOffer={createOffer} activateOffer={activateOffer} products={products} offers={offers} />

          <SupplierInventory busy={busy} createLot={createLot} reserve={reserve} balances={balances} />
        </div>
      )}
    </section>
  );
}
