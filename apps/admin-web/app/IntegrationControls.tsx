"use client";

import { Play20Regular } from "@fluentui/react-icons/svg/play";
import { DmButton, DmField, DmInput, DmSelect } from "@marketplace/ui";
import { FormEvent } from "react";

import styles from "./integration-operations.module.css";

import {
  dataTypes,
  jobTypes,
  dataTypeLabels,
  jobTypeLabels,
} from "./integration-operations-format";

import type { Warehouse, Offer } from "./integration-operations-types";

type Props = {
  working: boolean;
  detailsLoading: boolean;
  mappingType: "WAREHOUSE" | "VARIANT";
  setMappingType: (value: "WAREHOUSE" | "VARIANT") => void;
  warehouses: Warehouse[];
  offers: Offer[];
  createBinding: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  enqueueJob: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  upsertMapping: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function IntegrationControls({
  working,
  detailsLoading,
  mappingType,
  setMappingType,
  warehouses,
  offers,
  createBinding,
  enqueueJob,
  upsertMapping,
}: Props) {
  return (
    <div className={styles.controls}>
      <form onSubmit={(event) => void createBinding(event)}>
        <h4>Выбрать данные</h4>
        <DmField label="Тип данных">
          <DmSelect name="dataType">
            {dataTypes.map((type) => (
              <option key={type} value={type}>
                {dataTypeLabels[type] ?? type}
              </option>
            ))}
          </DmSelect>
        </DmField>
        <DmField label="Область">
          <DmSelect name="scope">
            <option value="global">Весь поставщик</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={`warehouse:${warehouse.id}`}>
                Склад: {warehouse.name}
              </option>
            ))}
            {offers.map((offer) => (
              <option key={offer.id} value={`offer:${offer.id}`}>
                Предложение:{" "}
                {offer.supplierSku ??
                  offer.productVariant.product.canonicalName}
              </option>
            ))}
          </DmSelect>
        </DmField>
        <DmField label="Приоритет">
          <DmInput name="priority" type="number" min="0" defaultValue="100" />
        </DmField>
        <DmButton
          type="submit"
          appearance="secondary"
          disabled={working || detailsLoading}
        >
          Добавить
        </DmButton>
      </form>
      <form onSubmit={(event) => void enqueueJob(event)}>
        <h4>Обновить данные</h4>
        <DmField label="Операция">
          <DmSelect name="jobType">
            {jobTypes.map((type) => (
              <option key={type} value={type}>
                {jobTypeLabels[type] ?? type}
              </option>
            ))}
          </DmSelect>
        </DmField>
        <DmButton
          type="submit"
          appearance="primary"
          icon={<Play20Regular />}
          disabled={working || detailsLoading}
        >
          {working ? "Запускаем…" : "Запустить"}
        </DmButton>
      </form>
      <form onSubmit={(event) => void upsertMapping(event)}>
        <h4>Связать записи</h4>
        <DmField label="Что связать">
          <DmSelect
            value={mappingType}
            onChange={(_, data) =>
              setMappingType(data.value as "WAREHOUSE" | "VARIANT")
            }
          >
            <option value="WAREHOUSE">Склад</option>
            <option value="VARIANT">Вариант товара</option>
          </DmSelect>
        </DmField>
        <DmField label="Код в учётной системе" required>
          <DmInput
            name="externalId"
            required
            placeholder={
              mappingType === "WAREHOUSE" ? "store UUID" : "product UUID"
            }
          />
        </DmField>
        <DmField label="Карточка в PlatformaMarket" required>
          <DmSelect name="internalId" required>
            {mappingType === "WAREHOUSE"
              ? warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} / {warehouse.code}
                  </option>
                ))
              : offers.map((offer) => (
                  <option
                    key={offer.productVariantId}
                    value={offer.productVariantId}
                  >
                    {offer.productVariant.product.canonicalName} /{" "}
                    {offer.supplierSku ?? "без SKU"}
                  </option>
                ))}
          </DmSelect>
        </DmField>
        <DmButton
          type="submit"
          appearance="secondary"
          disabled={working || detailsLoading}
        >
          Сохранить
        </DmButton>
      </form>
    </div>
  );
}
