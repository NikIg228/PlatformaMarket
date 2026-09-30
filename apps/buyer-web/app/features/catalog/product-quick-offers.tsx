"use client";
import { useEffect, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, DmDialog } from "@marketplace/ui";
import { useDeliveryContext } from "../marketplace-header/delivery-context";
import { productLoginUrl } from "../../public-links";
import { SupplierOffers, type SupplierOffer } from "./supplier-offers";

export default function ProductQuickOffers({ productId, name, href, onClose }: {
  productId: string; name: string; href: string; onClose: () => void;
}) {
  const { city, ready } = useDeliveryContext();
  const [result, setResult] = useState<{ cityId: string; offers: SupplierOffer[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const cityId = city?.id ?? "";
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setResult(null);
    setFailed(false);
    const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
    api.comparePublicOffers(productId, { quantity: 1, ...(cityId ? { cityId } : {}) }).then(data => {
      if (!active) return;
      setResult({ cityId, offers: data.offers.map(offer => ({
        id: offer.offerId, supplier: offer.supplier, priceMinor: offer.price.amountMinor,
        normalizedPriceMinor: offer.price.normalizedPriceMinor, currency: offer.price.currency,
        packaging: offer.packaging, available: offer.availability.some(row => Number(row.quantityAvailable) > 0),
        delivery: offer.delivery, verifiedDocuments: offer.markers.verifiedDocuments,
        officialDistributor: offer.markers.officialDistributor,
        minimumOrderQuantity: offer.minimumOrderQuantity, orderIncrement: offer.orderIncrement,
      })) });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [productId, cityId, ready, revision]);
  return <DmDialog open onOpenChange={open => { if (!open) onClose(); }} title={name}
    description={`Выберите предложение${city ? ` · ${city.nameRu}` : ""}`}
    actions={<a href={href}>Подробнее о товаре →</a>}>
    {failed ? <div role="alert"><p>Не удалось загрузить предложения.</p><DmButton onClick={() => setRevision(n => n + 1)}>Повторить</DmButton></div>
      : !ready || !result || result.cityId !== cityId ? <p role="status">Загружаем актуальные предложения…</p>
      : <SupplierOffers key={`${productId}-${cityId}`} offers={result.offers} compact loginHref={productLoginUrl(href)} />}
  </DmDialog>;
}
