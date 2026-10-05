"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductActions } from "./product-actions";
import {
  DmButton,
  DmField,
  DmInput,
  EmptyState,
  ErrorState,
  LoadingState,
  formatStatus,
  usePermissions,
} from "@marketplace/ui";
import { ManualOffer } from "../../../supplier-web/app/features/supplier-workspace/manual-offer";

import type { Offer } from "../../../supplier-web/app/features/supplier-workspace/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { PageNavigation, usePageNavigation } from "./page-navigation";
import { OfferPrice, OfferSaleUnit, OfferStock } from "./offer-information";

import styles from "./workspace.module.css";
import productStyles from "./products.module.css";

export default function Products() {
  const { api, organizationId } = useWorkspace();
  const has = usePermissions();
  const navigation = usePageNavigation();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const load = useCallback(
    (signal: AbortSignal) => api.workspaceOffers({ q: appliedQuery, cursor: navigation.cursor }, { signal }),
    [api, organizationId, appliedQuery, navigation.cursor],
  );
  const resource = useResource(load);
  const [editor, setEditor] = useState<Offer | null>(null);
  const searchParams = useSearchParams();
  const selectedOfferId = searchParams.get("offer");

  const loadSelected = useCallback((signal: AbortSignal) => selectedOfferId ? api.workspaceOffer(selectedOfferId, { signal }) : Promise.resolve(null), [api, organizationId, selectedOfferId]);
  const selected = useResource(loadSelected, { automatic: false });
  const appliedSelection = useRef<string | null>(null);
  useEffect(() => {
    const selection = selectedOfferId ?? "";
    if (appliedSelection.current === selection) return;
    if (selectedOfferId && selected.data?.id !== selectedOfferId) return;
    appliedSelection.current = selection;
    if (selectedOfferId && selected.data) setEditor(selected.data);
  }, [selectedOfferId, selected.data]);
  const items = resource.data?.items ?? [];
  const refresh = () => { if (navigation.cursor) navigation.reset(); else void resource.refresh(); };
  const changed = async () => {
    await resource.refreshAfterWrite();
  };
  return (
    <div className={productStyles.page}>
      <ProductActions />
      {!has("catalog.offer.edit", "import.manage") ? <p>Некоторые действия недоступны вашей роли. Обратитесь к администратору организации.</p> : null}
      {editor ? (
        <section className={styles.panel}>
          <div className={styles.heading}>
            <h2>Редактирование предложения</h2>
            <DmButton onClick={() => setEditor(null)}>Закрыть</DmButton>
          </div>
          <ManualOffer
            initiallyOpen
            key={editor.id}
            api={api}
            supplierId={organizationId}
            initialOffer={editor}
            onChanged={changed}
          />
        </section>
      ) : null}
      {selectedOfferId && selected.error ? <ErrorState description={selected.error} action={<DmButton onClick={() => void selected.refresh()}>Повторить загрузку предложения</DmButton>} /> : null}
      <section className={styles.panel}>
        <form className={styles.toolbar} onSubmit={event => { event.preventDefault(); navigation.reset(); setAppliedQuery(query.trim()); }}>
          <DmField label="Поиск по товарам">
            <DmInput
              value={query}
              onChange={(_, data) => setQuery(data.value)}
              placeholder="Название или артикул"
            />
          </DmField>
          <DmButton
            disabled={resource.loading}
            onClick={refresh}
          >
            Обновить
          </DmButton>
          <DmButton type="submit">Найти</DmButton>
        </form>
        <ResourceStatus resource={resource} />
        {resource.error && !resource.data ? (
          <ErrorState
            description={resource.error}
            action={
              <DmButton onClick={() => void resource.refresh()}>
                Повторить
              </DmButton>
            }
          />
        ) : resource.initialLoading ? (
          <LoadingState label="Загружаем товары" />
        ) : !items.length ? (
          <EmptyState
            title={
              appliedQuery || navigation.cursor
                ? "Товары не найдены"
                : "Добавьте первое предложение"
            }
            description="Создайте предложение вручную или загрузите товары из файла."
          />
        ) : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Цена</th>
                  <th>Остаток по складам</th>
                  <th>Публикация</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      {offer.productVariant.product.canonicalName}
                      <small>{offer.supplierSku ?? "Без артикула"}</small>
                      <OfferSaleUnit offer={offer} />
                    </td>
                    <td>
                      <OfferPrice offer={offer} />
                    </td>
                    <td>
                      <OfferStock offer={offer} />
                    </td>
                    <td>
                      {offer.publication?.marketplaceVisible
                        ? "В каталоге"
                        : formatStatus(
                            offer.publication?.status ?? offer.status,
                          )}
                      {offer.publication?.blockedReason ? (
                        <small>{offer.publication.blockedReason}</small>
                      ) : null}
                    </td>
                    <td>
                      <DmButton disabled={!has("catalog.product.view", "inventory.view")} onClick={() => setEditor(offer)}>
                        Изменить
                      </DmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PageNavigation navigation={navigation} nextCursor={resource.data?.nextCursor} loading={resource.loading} onRefresh={refresh} />
      </section>
    </div>
  );
}
