"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  DmButton,
  DmFeedback,
  DmField,
  DmInput,
  DmSelect,
  LoadingState,
  StatusTag,
} from "@marketplace/ui";
import { formatAdminStatus } from "./admin-labels";
import styles from "./supplier-controls.module.css";
import { adminAuthHeaders } from "./admin-auth";

type Supplier = {
  organizationId: string;
  organization: { displayName: string };
};
type Organization = {
  id: string;
  displayName: string;
  capabilities: Array<{ capability: string }>;
};
type Offer = {
  id: string;
  productVariant: { product: { canonicalName: string } };
  publication?: { status: string } | null;
};
type PriceTier = {
  id: string;
  minimumQuantity: string;
  maximumQuantity?: string | null;
  unitPriceMinor: string;
  currency: string;
};
type ContractPrice = {
  id: string;
  amountMinor: string;
  currency: string;
  status: string;
  buyer: { displayName: string };
};
type Balance = {
  id: string;
  freshnessStatus: string;
  quantityAvailable: string;
  productVariant: { product: { canonicalName: string } };
  lots: Array<{
    id: string;
    lotNumber: string;
    status: string;
    quantityAvailable: string;
  }>;
};
type Recall = {
  id: string;
  reason: string;
  severity: string;
  status: string;
  inventoryLot: {
    lotNumber: string;
    productVariant: { product: { canonicalName: string } };
  };
};
type PriceDecision = {
  source: string;
  amountMinor: string | null;
  currency: string | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";

export function SupplierControls() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState("");
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [contracts, setContracts] = useState<ContractPrice[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [decision, setDecision] = useState<PriceDecision | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [loading, setLoading] = useState(true);

  const report = useCallback(
    (description: string, tone: "success" | "danger" = "success") => {
      setMessage(description);
      setMessageTone(tone);
    },
    [],
  );

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        cache: "no-store",
        headers: { ...adminAuthHeaders(), ...init?.headers },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          payload?.message ?? `API вернул статус ${response.status}`,
        );
      }
      return response.json() as Promise<T>;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        supplierData,
        organizationData,
      ] = await Promise.all([
        request<Supplier[]>("/suppliers"),
        request<Organization[]>("/organizations"),
      ]);
      const activeSupplierId = supplierId || supplierData[0]?.organizationId;
      setSuppliers(supplierData);
      setOrganizations(organizationData);
      if (!activeSupplierId) return;
      if (!supplierId) setSupplierId(activeSupplierId);
      const [offerData, balanceData, recallData] = await Promise.all([
        request<Offer[]>(`/suppliers/${activeSupplierId}/offers`),
        request<Balance[]>(`/suppliers/${activeSupplierId}/inventory/balances`),
        request<Recall[]>(`/suppliers/${activeSupplierId}/inventory/recalls`),
      ]);
      const activeOfferId = offerId || offerData[0]?.id;
      setOffers(offerData);
      setBalances(balanceData);
      setRecalls(recallData);
      if (activeOfferId && !offerId) setOfferId(activeOfferId);
      if (activeOfferId) {
        const [tierData, contractData] = await Promise.all([
          request<PriceTier[]>(
            `/suppliers/${activeSupplierId}/offers/${activeOfferId}/price-tiers`,
          ),
          request<ContractPrice[]>(
            `/suppliers/${activeSupplierId}/offers/${activeOfferId}/contract-prices`,
          ),
        ]);
        setTiers(tierData);
        setContracts(contractData);
      } else {
        setTiers([]);
        setContracts([]);
      }
      setMessage("");
    } catch (error) {
      report(
        error instanceof Error
          ? error.message
          : "Контрольные операции недоступны.",
        "danger",
      );
    } finally {
      setLoading(false);
    }
  }, [offerId, report, request, supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await request(`/suppliers/${supplierId}/offers/${offerId}/price-tiers`, {
        method: "POST",
        body: JSON.stringify({
          minimumQuantity: Number(data.get("minimumQuantity")),
          maximumQuantity: String(data.get("maximumQuantity") ?? "")
            ? Number(data.get("maximumQuantity"))
            : null,
          unitPriceMinor: Number(data.get("unitPriceMinor")),
          currency: "KZT",
        }),
      });
      await load();
      report("Ценовая ступень создана без пересечения диапазонов.");
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Ступень не создана.",
        "danger",
      );
    }
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await request(
        `/suppliers/${supplierId}/offers/${offerId}/contract-prices`,
        {
          method: "POST",
          body: JSON.stringify({
            buyerOrganizationId: data.get("buyerOrganizationId"),
            contractReference: data.get("contractReference"),
            amountMinor: Number(data.get("amountMinor")),
            currency: "KZT",
            minimumQuantity: Number(data.get("minimumQuantity") || 1),
            priority: 10,
          }),
        },
      );
      await load();
      report(
        "Договорная цена активирована, предыдущая сохранена как INACTIVE.",
      );
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Договорная цена не создана.",
        "danger",
      );
    }
  }

  async function resolvePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await request<PriceDecision>(
        `/suppliers/${supplierId}/offers/${offerId}/resolve-price`,
        {
          method: "POST",
          body: JSON.stringify({
            buyerOrganizationId:
              String(data.get("buyerOrganizationId") ?? "") || undefined,
            quantity: Number(data.get("quantity")),
          }),
        },
      );
      setDecision(result);
      report("Цена вычислена детерминированным resolver.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Цена не вычислена.", "danger");
    }
  }

  async function recomputeFreshness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await request(`/suppliers/${supplierId}/inventory/freshness/recompute`, {
        method: "POST",
        body: JSON.stringify({
          staleAfterMinutes: Number(data.get("staleAfterMinutes")),
        }),
      });
      await load();
      report(
        "Остатки проверены. Предложения с устаревшими данными приостановлены.",
      );
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Не удалось проверить остатки.",
        "danger",
      );
    }
  }

  async function recallLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await request(`/suppliers/${supplierId}/inventory/recalls`, {
        method: "POST",
        body: JSON.stringify({
          inventoryLotId: data.get("inventoryLotId"),
          reason: data.get("reason"),
          source: data.get("source"),
          severity: data.get("severity"),
          comment: "Создано командой PlatformaMarket",
        }),
      });
      await load();
      report(
        "Партия отозвана, доступность обнулена, затронутые резервы зафиксированы.",
      );
    } catch (error) {
      report(error instanceof Error ? error.message : "Отзыв не создан.", "danger");
    }
  }

  async function resolveRecall(recall: Recall) {
    try {
      await request(
        `/suppliers/${supplierId}/inventory/recalls/${recall.id}/resolve`,
        {
          method: "POST",
          body: JSON.stringify({
            comment: "Инцидент закрыт; партия остаётся на ручной проверке",
          }),
        },
      );
      await load();
      report(
        "Recall закрыт, партия переведена в UNDER_REVIEW без автоматического возврата остатка.",
      );
    } catch (error) {
      report(error instanceof Error ? error.message : "Recall не закрыт.", "danger");
    }
  }

  const buyers = organizations.filter(({ capabilities }) =>
    capabilities.some(({ capability }) => capability === "BUYER"),
  );
  const lots = balances.flatMap((balance) => balance.lots);

  return (
    <section
      id="supplier-controls"
      className={styles.section}
      aria-label="Контроль поставщика"
    >
      <div className={styles.heading}>
        <div>
          <span>ITERATION 1B / DECISION PLANE</span>
          <h2>Модерация, цены и контроль партий</h2>
          <p>У каждого решения сохраняются причина и история изменений.</p>
        </div>
        <div className={styles.actions}>
          <DmSelect
            aria-label="Поставщик"
            value={supplierId}
            onChange={(_, data) => {
              setOfferId("");
              setSupplierId(data.value);
            }}
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
          <DmButton appearance="secondary" onClick={() => void load()}>Обновить</DmButton>
        </div>
      </div>
      {message ? (
        <DmFeedback
          tone={messageTone}
          title={messageTone === "danger" ? "Операция не выполнена" : "Операция выполнена"}
          description={message}
          alert={messageTone === "danger"}
        />
      ) : null}
      {loading ? (
        <LoadingState label="Загружаем контроль поставщика" />
      ) : (
        <div className={styles.grid}>
          <article className={styles.panel}>
            <header>
              <b>02</b>
              <div>
                <h3>Расчёт цены</h3>
                <p>Contract → tier → base</p>
              </div>
            </header>
            <DmField className={styles.offerSelect} label="Предложение">
              <DmSelect
                value={offerId}
                onChange={(_, data) => setOfferId(data.value)}
              >
                <option value="">Выберите</option>
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.productVariant.product.canonicalName}
                  </option>
                ))}
              </DmSelect>
            </DmField>
            <form className={styles.form} onSubmit={createTier}>
              <DmField label="От количества" required>
                <DmInput
                  name="minimumQuantity"
                  type="number"
                  min="0.000001"
                  required
                />
              </DmField>
              <DmField label="До количества">
                <DmInput name="maximumQuantity" type="number" min="0.000001" />
              </DmField>
              <DmField label="Цена, тиын" required>
                <DmInput name="unitPriceMinor" type="number" min="0" required />
              </DmField>
              <DmButton type="submit" appearance="secondary">Добавить ступень</DmButton>
            </form>
            <form className={styles.form} onSubmit={createContract}>
              <DmField className={styles.wide} label="Покупатель" required>
                <DmSelect name="buyerOrganizationId" required>
                  <option value="">Выберите</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.displayName}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Договор">
                <DmInput name="contractReference" placeholder="KZ-2026-001" />
              </DmField>
              <DmField label="Цена, тиын" required>
                <DmInput name="amountMinor" type="number" min="0" required />
              </DmField>
              <DmField label="Минимальное количество">
                <DmInput
                  name="minimumQuantity"
                  type="number"
                  min="0.000001"
                  defaultValue="1"
                />
              </DmField>
              <DmButton type="submit" appearance="primary">Активировать договорную цену</DmButton>
            </form>
            <form className={styles.resolve} onSubmit={resolvePrice}>
              <DmField label="Покупатель для расчёта">
                <DmSelect name="buyerOrganizationId">
                  <option value="">Публичная цена</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.displayName}
                    </option>
                  ))}
                </DmSelect>
              </DmField>
              <DmField label="Количество" required>
                <DmInput
                  name="quantity"
                  type="number"
                  min="0.000001"
                  defaultValue="20"
                  required
                />
              </DmField>
              <DmButton type="submit" appearance="secondary">Рассчитать</DmButton>
              {decision && (
                <output>
                  {decision.source}: {decision.amountMinor ?? "Нет данных"}{" "}
                  {decision.currency ?? ""}
                </output>
              )}
            </form>
            <div className={styles.chips}>
              {tiers.map((tier) => (
                <span key={tier.id}>
                  от {tier.minimumQuantity}: {tier.unitPriceMinor}
                </span>
              ))}
              {contracts.map((contract) => (
                <span key={contract.id}>
                  {contract.buyer.displayName}: {contract.amountMinor}
                </span>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <header>
              <b>03</b>
              <div>
                <h3>Актуальность остатков</h3>
                <p>Автопауза устаревших публикаций</p>
              </div>
            </header>
            <form className={styles.form} onSubmit={recomputeFreshness}>
              <DmField label="Порог, минут" required>
                <DmInput
                  name="staleAfterMinutes"
                  type="number"
                  min="1"
                  defaultValue="60"
                  required
                />
              </DmField>
              <DmButton type="submit" appearance="primary">Пересчитать сейчас</DmButton>
            </form>
            <div className={styles.records}>
              {balances.map((balance) => (
                <div className={styles.record} key={balance.id}>
                  <div>
                    <strong>
                      {balance.productVariant.product.canonicalName}
                    </strong>
                    <small>Доступно {balance.quantityAvailable}</small>
                  </div>
                  <StatusTag tone={balance.freshnessStatus === "STALE" ? "danger" : "success"}>
                    {formatAdminStatus(balance.freshnessStatus)}
                  </StatusTag>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <header>
              <b>04</b>
              <div>
                <h3>Отзыв партий</h3>
                <p>Блокировка партии и impacted reservations</p>
              </div>
            </header>
            <form className={styles.form} onSubmit={recallLot}>
              <DmField className={styles.wide} label="Партия" required>
                <DmSelect name="inventoryLotId" required>
                  <option value="">Выберите</option>
                  {lots
                    .filter(
                      ({ status }) =>
                        !["RECALLED", "EXPIRED", "DEPLETED"].includes(status),
                    )
                    .map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber}. {formatAdminStatus(lot.status)}. {lot.quantityAvailable}
                      </option>
                    ))}
                </DmSelect>
              </DmField>
              <DmField label="Источник" required>
                <DmInput
                  name="source"
                  defaultValue="manufacturer_notice"
                  required
                />
              </DmField>
              <DmField label="Критичность" required>
                <DmSelect name="severity" defaultValue="HIGH">
                  <option value="LOW">Низкая</option>
                  <option value="MEDIUM">Средняя</option>
                  <option value="HIGH">Высокая</option>
                  <option value="CRITICAL">Критическая</option>
                </DmSelect>
              </DmField>
              <DmField className={styles.wide} label="Причина" required>
                <DmInput name="reason" required />
              </DmField>
              <DmButton type="submit" appearance="primary" className={styles.dangerAction}>Отозвать партию</DmButton>
            </form>
            <div className={styles.records}>
              {recalls.map((recall) => (
                <div className={styles.record} key={recall.id}>
                  <div>
                    <strong>
                      {recall.inventoryLot.lotNumber}. {formatAdminStatus(recall.severity)}
                    </strong>
                    <small>
                      {recall.reason}. {formatAdminStatus(recall.status)}
                    </small>
                  </div>
                  {recall.status === "ACTIVE" ? (
                    <DmButton appearance="secondary" onClick={() => void resolveRecall(recall)}>
                      Закрыть
                    </DmButton>
                  ) : (
                    <b>Закрыт</b>
                  )}
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
