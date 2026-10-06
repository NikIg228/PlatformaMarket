"use client";
import { useEffect, useState } from "react";
import type { SupplierWarehouseList, WorkspaceOffer } from "@marketplace/schemas";
import { DmButton, ErrorState, errorMessage } from "@marketplace/ui";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";
import { OfferCommercialEditor } from "../../../supplier-web/app/features/supplier-workspace/offer-commercial-editor";
import { OfferDelivery } from "../../../supplier-web/app/features/supplier-workspace/offer-delivery";
import { useWorkspace } from "./workspace";

export function OfferPanelEditor({ offer, mode, onChanged, onSaved }: {
  offer: WorkspaceOffer; mode: "price" | "delivery" | "settings"; onChanged: () => Promise<void>; onSaved: () => void;
}) {
  const { api, organizationId } = useWorkspace();
  const [warehouses, setWarehouses] = useState<SupplierWarehouseList | null>(null);
  const [warehouseId, setWarehouseId] = useState(offer.inventoryBalances[0]?.warehouseId ?? "");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const needsPackaging = mode === "price" && !offer.packaging;
  useEffect(() => {
    if (mode === "settings" || needsPackaging) return;
    let cancelled = false;
    setError("");
    void api.listSupplierWarehouses(organizationId).then(items => {
      if (cancelled) return;
      const active = items.filter(item => item.status === "ACTIVE");
      setWarehouseId(current => active.some(item => item.id === current) ? current : active[0]?.id ?? "");
      setWarehouses(active);
    }).catch(cause => { if (!cancelled) setError(errorMessage(cause)); });
    return () => { cancelled = true; };
  }, [api, organizationId, mode, needsPackaging, attempt]);
  if (mode === "settings" || needsPackaging) return <ManualOffer hideHeading initiallyOpen stockEditable={false} api={api} supplierId={organizationId} initialOffer={offer} onChanged={onChanged} />;
  if (error) return <div><ErrorState description={error} /><DmButton onClick={() => setAttempt(value => value + 1)}>Повторить загрузку редактора</DmButton></div>;
  if (!warehouses) return <p role="status">Загружаем условия предложения…</p>;
  return mode === "price" ? <OfferCommercialEditor api={api} supplierId={organizationId} offerId={offer.id}
    warehouses={warehouses} initialWarehouseId={warehouseId} onWarehouseChange={setWarehouseId} onWarehousesChange={setWarehouses} onChanged={onChanged} stockEditable={false} />
    : <OfferDelivery api={api} supplierId={organizationId} offerId={offer.id} warehouses={warehouses} defaultWarehouseId={warehouseId} initiallyOpen onSaved={onSaved} />;
}
