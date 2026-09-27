import { BuildingShop24Regular } from "@fluentui/react-icons/svg/building-shop";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import {
  DmButton,
  DmField,
  DmInput,
  DmTable,
  EmptyState,
  PageHeader,
  Section,
  StatusTag,
  formatDate,
  formatStatus,
} from "@marketplace/ui";
import { ProductCorrectionsPanel } from "../../product-corrections-panel";
import styles from "../../page.module.css";
import type { Offer } from "./types";
import { statusTone } from "./view-model";
import { offerPackaging } from "./offer-packaging";
import { ManualOffer } from "./manual-offer";
import { useState } from "react";

export function SupplierOffers({
  api,
  supplierId,
  offers,
  priceDrafts,
  busy,
  onPriceChange,
  onSavePrice,
  onChanged,
}: {
  api: MarketplaceApiClient;
  supplierId: string;
  offers: Offer[];
  priceDrafts: Record<string, string>;
  busy: string | null;
  onPriceChange: (offerId: string, value: string) => void;
  onSavePrice: (offer: Offer) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Offer | undefined>();
  const [editorGeneration, setEditorGeneration] = useState(0);
  return (
    <div className="mp-stack">
      <PageHeader
        eyebrow="Каталог поставщика"
        title="Предложения и цены"
        description="У каждой цены видны срок действия, публикация и текущий доступный остаток."
      />
      <DmButton onClick={() => { setEditing(undefined); setEditorGeneration(value => value + 1); }}>Новое предложение</DmButton>
      <ManualOffer key={`${editing?.id ?? "new"}-${editorGeneration}`} api={api} supplierId={supplierId} onChanged={onChanged} initialOffer={editing} />
      <Section>
        {!offers.length ? (
          <EmptyState
            icon={<BuildingShop24Regular />}
            title="Нет предложений"
            description="Добавьте предложение вручную или загрузите прайс."
          />
        ) : (
          <DmTable
            caption="Предложения поставщика и их текущие цены"
            columns={[
              { key: "product", label: "Товар" },
              { key: "package", label: "Упаковка" },
              { key: "publication", label: "Публикация" },
              { key: "inventory", label: "Остаток" },
              { key: "price", label: "Цена, ₸" },
            ]}
          >
            {offers.map((offer) => {
              const packaging = offerPackaging(offer);
              const activePrice = offer.prices.find(
                (price) => price.status === "ACTIVE",
              );
              return (
                <tr key={offer.id}>
                  <td data-label="Товар">
                    <strong>{offer.productVariant.product.canonicalName}</strong>
                    <small>
                      {offer.supplierSku ?? offer.id.slice(0, 8)} · {offer.sourceType}
                    </small>
                  </td>
                  <td data-label="Упаковка">
                    {packaging.name}
                    <br />
                    <small>
                      {packaging.detail}
                    </small>
                  </td>
                  <td data-label="Публикация">
                    <StatusTag tone={statusTone(offer.publication?.status ?? "DRAFT")}>
                      {formatStatus(offer.publication?.status ?? "DRAFT")}
                    </StatusTag>
                    {["MANUAL", "IMPORT"].includes(offer.sourceType)
                      ? <DmButton onClick={() => setEditing(offer)}>Настроить предложение</DmButton>
                      : <small>Условия управляются подключённым источником.</small>}
                    {offer.publication?.blockedReason ? <p>{offer.publication.blockedReason}</p> : null}
                  </td>
                  <td data-label="Остаток">
                    {offer.inventoryBalances.reduce(
                      (sum, item) => sum + Number(item.quantityAvailable),
                      0,
                    )}
                  </td>
                  <td data-label="Цена, ₸">
                    <div className={styles.editCell}>
                      <DmField label={`Цена: ${offer.productVariant.product.canonicalName}`} className={styles.compactField}>
                        <DmInput
                          type="number"
                          min="0"
                          value={priceDrafts[offer.id] ?? ""}
                          onChange={(_, data) => onPriceChange(offer.id, data.value)}
                        />
                      </DmField>
                      <DmButton
                        appearance="primary"
                        onClick={() => void onSavePrice(offer)}
                        disabled={busy === `price:${offer.id}`}
                      >
                        {busy === `price:${offer.id}` ? "Сохраняем…" : "Сохранить"}
                      </DmButton>
                    </div>
                    <small>
                      {activePrice?.freshnessExpiresAt
                        ? `Актуальна до ${formatDate(activePrice.freshnessExpiresAt, true)}`
                        : "Срок актуальности не задан"}
                    </small>
                  </td>
                </tr>
              );
            })}
          </DmTable>
        )}
      </Section>
      <ProductCorrectionsPanel api={api} offers={offers} supplierId={supplierId} />
    </div>
  );
}
