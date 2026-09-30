"use client";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { adminAuthHeaders } from "../admin-auth";
import type { SupplierProfile, ImportBatch, ExternalItem, Product, Offer, Balance } from "./types";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function useSupplierOperations() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const selectedSupplier = useRef("");
  const pendingRead = useRef<AbortController | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [items, setItems] = useState<ExternalItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "danger" | "info">("info");
  const [busy, setBusy] = useState<string | null>(null);

  const report = useCallback(
    (description: string, tone: "success" | "danger" | "info" = "success") => {
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
          payload?.message ?? `Не удалось выполнить запрос (${response.status})`,
        );
      }
      return response.json() as Promise<T>;
    },
    [],
  );

  const load = useCallback(async () => {
    pendingRead.current?.abort();
    const controller = new AbortController();
    pendingRead.current = controller;
    const options = { signal: controller.signal };
    setLoading(true);
    try {
      const supplierData = await request<SupplierProfile[]>("/suppliers", options);
      if (controller.signal.aborted) return;
      setSuppliers(supplierData);
      const activeSupplierId = selectedSupplier.current || supplierData[0]?.organizationId;
      if (!activeSupplierId) {
        report("Сначала создайте карточку поставщика.", "info");
        return;
      }
      selectedSupplier.current = activeSupplierId;
      setSupplierId(activeSupplierId);
      const [batchData, itemData, productData, offerData, balanceData] =
        await Promise.all([
          request<ImportBatch[]>(
            `/suppliers/${activeSupplierId}/import-batches`, options,
          ),
          request<ExternalItem[]>(
            `/suppliers/${activeSupplierId}/external-items`, options,
          ),
          request<Product[]>("/catalog/products", options),
          request<Offer[]>(`/suppliers/${activeSupplierId}/offers`, options),
          request<Balance[]>(
            `/suppliers/${activeSupplierId}/inventory/balances`, options,
          ),
        ]);
      if (controller.signal.aborted) return;
      setBatches(batchData);
      setItems(itemData);
      setProducts(productData);
      setOffers(offerData);
      setBalances(balanceData);
      setMessage("");
    } catch (error) {
      if (controller.signal.aborted) return;
      report(
        error instanceof Error
          ? error.message
          : "Раздел поставщика недоступен.",
        "danger",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [report, request]);

  const selectSupplier = useCallback((id: string) => {
    selectedSupplier.current = id;
    setSupplierId(id);
    void load();
  }, [load]);

  useEffect(() => {
    void load();
    return () => pendingRead.current?.abort();
  }, [load]);

  const activeSupplier = suppliers.find(
    ({ organizationId }) => organizationId === supplierId,
  );

  async function createWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("warehouse");
    setMessage("");
    try {
      await request(`/suppliers/${supplierId}/warehouses`, {
        method: "POST",
        body: JSON.stringify({
          code: String(data.get("code")).toUpperCase(),
          name: data.get("name"),
          addressLine: String(data.get("addressLine") ?? "") || null,
        }),
      });
      form.reset();
      await load();
      report("Склад поставщика создан.");
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Не удалось создать склад.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("source");
    setMessage("");
    try {
      await request(`/suppliers/${supplierId}/data-sources`, {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          type: data.get("type"),
        }),
      });
      form.reset();
      await load();
      report("Способ загрузки добавлен.");
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Не удалось добавить способ загрузки.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("upload");
    setMessage("");
    try {
      const batch = await request<ImportBatch>(
        `/suppliers/${supplierId}/import-batches`,
        {
          method: "POST",
          body: JSON.stringify({
            sourceId: data.get("sourceId"),
            fileName: data.get("fileName"),
            fileType: "CSV",
            contentBase64: base64Utf8(String(data.get("csv"))),
            columnMapping: {
              externalId: "id",
              name: "name",
              supplierSku: "sku",
              gtin: "gtin",
              priceMinor: "price",
              currency: "currency",
              quantityOnHand: "stock",
              lotNumber: "lot",
              expirationDate: "expires",
            },
          }),
        },
      );
      await request(
        `/suppliers/${supplierId}/import-batches/${batch.id}/process`,
        { method: "POST" },
      );
      await load();
      report("Файл загружен. Товары проверены по каталогу.");
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Не удалось загрузить файл.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmMatch(item: ExternalItem, variantId: string) {
    setBusy(`match:${item.id}`);
    setMessage("");
    try {
      await request(
        `/suppliers/${supplierId}/external-items/${item.id}/match`,
        {
          method: "POST",
          body: JSON.stringify({ productVariantId: variantId }),
        },
      );
      await load();
      report(
        `Товар ${item.externalId} связан с карточкой каталога.`,
      );
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Не удалось подтвердить товар.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("offer");
    setMessage("");
    try {
      await request(`/suppliers/${supplierId}/offers`, {
        method: "POST",
        body: JSON.stringify({
          productVariantId: data.get("productVariantId"),
          sourceId: String(data.get("sourceId") ?? "") || null,
          supplierSku: String(data.get("supplierSku") ?? "") || null,
          sourceType: "IMPORT",
        }),
      });
      form.reset();
      await load();
      report("Черновик предложения создан.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Предложение не создано.", "danger");
    } finally {
      setBusy(null);
    }
  }

  async function activateOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const offer = offers.find(({ id }) => id === data.get("offerId"));
    if (!offer) return;
    setBusy("publish");
    setMessage("");
    try {
      await request(`/suppliers/${supplierId}/offers/${offer.id}/price`, {
        method: "PUT",
        body: JSON.stringify({
          amountMinor: Number(data.get("amountMinor")),
          currency: "KZT",
          includesVat: true,
          vatRate: 12,
          source: "MANUAL",
          reason: "Обновление из admin-web",
        }),
      });
      await request(`/suppliers/${supplierId}/inventory/balances`, {
        method: "PUT",
        body: JSON.stringify({
          warehouseId: data.get("warehouseId"),
          productVariantId: offer.productVariant.id,
          offerId: offer.id,
          quantityOnHand: Number(data.get("quantityOnHand")),
          safetyStock: Number(data.get("safetyStock") || 0),
          source: "MANUAL",
        }),
      });
      await request(`/suppliers/${supplierId}/offers/${offer.id}/publication`, {
        method: "PUT",
        body: JSON.stringify({ status: "PUBLISHED", marketplaceVisible: true }),
      });
      await load();
      report(
        "Цена и остаток обновлены. Предложение опубликовано.",
      );
    } catch (error) {
      report(
        error instanceof Error ? error.message : "Предложение не опубликовано.",
        "danger",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("lot");
    setMessage("");
    try {
      await request(`/suppliers/${supplierId}/inventory/lots`, {
        method: "POST",
        body: JSON.stringify({
          inventoryBalanceId: data.get("balanceId"),
          lotNumber: data.get("lotNumber"),
          expirationDate: data.get("expirationDate"),
          quantityOnHand: Number(data.get("quantityOnHand")),
          status: "ACTIVE",
        }),
      });
      form.reset();
      await load();
      report("Партия добавлена. Товары с ближайшим сроком годности будут отгружаться первыми.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Партия не создана.", "danger");
    } finally {
      setBusy(null);
    }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("reserve");
    setMessage("");
    try {
      await request(
        `/suppliers/${supplierId}/inventory/balances/${data.get("balanceId")}/reservations`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity: Number(data.get("quantity")),
            idempotencyKey: data.get("idempotencyKey"),
            ttlMinutes: 30,
            referenceType: "ADMIN_SMOKE",
          }),
        },
      );
      await load();
      report("Резерв создан. Повторный запрос не изменит количество дважды.");
    } catch (error) {
      report(error instanceof Error ? error.message : "Резерв не создан.", "danger");
    } finally {
      setBusy(null);
    }
  }

  return { suppliers, supplierId, selectSupplier, batches, items, products, offers, balances, loading, message, messageTone, busy, load, activeSupplier, createWarehouse, createSource, uploadCsv, confirmMatch, createOffer, activateOffer, createLot, reserve };
}
export type SupplierOperationsModel = ReturnType<typeof useSupplierOperations>;
