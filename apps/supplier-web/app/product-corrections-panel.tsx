"use client";
import type {
  Product,
  Offer,
  Correction,
} from "./product-corrections-panel-types";
import { ProductCorrectionForm } from "./ProductCorrectionForm";
import { ProductCorrectionsTable } from "./ProductCorrectionsTable";

import type { MarketplaceApiClient } from "@marketplace/api-client";
import {
  DmSearch,
  DmButton,
  DmDropdown,
  ErrorState,
  LoadingState,
  useUnsavedChanges,
  productWorkflowStyles as styles,
  errorMessage,
} from "@marketplace/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { canSubmitProductCorrection } from "./product-corrections-validation";

const fields = [
  ["CANONICAL_NAME", "Название"],
  ["DESCRIPTION", "Описание"],
  ["MANUFACTURER_SKU", "Артикул производителя"],
  ["GTIN", "GTIN"],
  ["PRODUCT_TYPE", "Тип товара"],
  ["REGULATORY_CLASS", "Регуляторный класс"],
] as const;
const fieldLabel = (field: string) =>
  fields.find(([value]) => value === field)?.[1] ?? field;
const statusLabel: Record<Correction["status"], string> = {
  PENDING: "Проверяем",
  APPROVED: "Принято",
  PARTIALLY_APPROVED: "Принято с редактурой",
  REJECTED: "Отклонено",
};
export function ProductCorrectionsPanel({
  api,
  offers,
  supplierId,
  hideHeading = false,
  createMode = false,
  initialOffer,
  selectionControls,
  onModeChange,
}: {
  api: MarketplaceApiClient;
  offers: Offer[];
  supplierId: string;
  hideHeading?: boolean;
  createMode?: boolean;
  initialOffer?: Offer;
  selectionControls?: ReactNode;
  onModeChange?: (create: boolean) => void;
}) {
  const [editing, setEditing] = useState(createMode),
    [step, setStep] = useState(initialOffer ? 1 : 0),
    [sent, setSent] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialOffer?.productVariant.product ?? null,
  );
  const products = useMemo(
    () => [
      ...new Map(
        [
          ...(selectedProduct ? [selectedProduct] : []),
          ...offers.map((offer) => offer.productVariant.product),
        ].map((product) => [product.id, product]),
      ).values(),
    ],
    [offers, selectedProduct],
  );
  const [field, setField] = useState<(typeof fields)[number][0]>("DESCRIPTION"),
    [proposedValue, setProposedValue] = useState(""),
    [reason, setReason] = useState(""),
    [evidenceUrl, setEvidenceUrl] = useState("");
  const [items, setItems] = useState<Correction[]>([]),
    [busy, setBusy] = useState(false),
    [historyLoading, setHistoryLoading] = useState(true),
    [historyError, setHistoryError] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(12),
    [search, setSearch] = useState(""),
    [searchDraft, setSearchDraft] = useState(""),
    [status, setStatus] = useState(""),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const lock = useRef(false),
    sequence = useRef(0),
    form = useRef<HTMLFormElement>(null);
  useUnsavedChanges(
    editing && !sent && Boolean(proposedValue || reason || evidenceUrl),
  );
  const currentValue = selectedProduct
    ? {
        CANONICAL_NAME: selectedProduct.canonicalName,
        DESCRIPTION: selectedProduct.description,
        MANUFACTURER_SKU: selectedProduct.manufacturerSku,
        GTIN: selectedProduct.gtin,
        PRODUCT_TYPE: selectedProduct.productType,
        REGULATORY_CLASS: selectedProduct.regulatoryClass,
      }[field]
    : null;
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await api.get<Correction[]>(
        "/moderation/product-corrections",
      );
      if (request === sequence.current)
        setItems(
          data.filter((item) => item.supplierOrganizationId === supplierId),
        );
    } catch {
      if (request === sequence.current)
        setHistoryError(
          "Не удалось загрузить историю исправлений. Повторите попытку.",
        );
    } finally {
      if (request === sequence.current) setHistoryLoading(false);
    }
  }, [api, supplierId]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  useEffect(() => setEditing(createMode), [createMode]);
  const changeMode = (value: boolean) => {
    setEditing(value);
    onModeChange?.(value);
  };
  const submit = async () => {
    if (
      lock.current ||
      !canSubmitProductCorrection({
        busy,
        productId: selectedProduct?.id ?? "",
        proposedValue,
        reason,
      })
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post("/moderation/product-corrections", {
        productId: selectedProduct!.id,
        field,
        proposedValue: proposedValue.trim(),
        reason: reason.trim(),
        evidenceUrl: evidenceUrl.trim() || undefined,
      });
      setSent(true);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const filtered = items.filter(
    (item) =>
      (!status || item.status === status) &&
      item.product.canonicalName
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const selected = items.find((item) => item.id === selectedId);
  if (!editing)
    return (
      <div className={styles.form}>
        {!hideHeading ? <h2>Исправления карточек</h2> : null}
        <div className={styles.filterToolbar}>
          <DmSearch
            aria-label="Поиск исправления"
            placeholder="Найти исправление"
            value={searchDraft}
            onChange={setSearchDraft}
            onSearch={(value) => {
              setSearch(value);
              setHistoryLimit(12);
            }}
          />
          <DmDropdown
            aria-label="Статус исправления"
            value={status}
            onChange={(_, data) => {
              setStatus(data.value);
              setHistoryLimit(12);
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </DmDropdown>
          <DmButton
            appearance="primary"
            onClick={() => {
              setSent(false);
              setStep(0);
              setSelectedProduct(null);
              setProposedValue("");
              setReason("");
              setEvidenceUrl("");
              changeMode(true);
            }}
          >
            Предложить исправление
          </DmButton>
        </div>
        {historyError ? (
          <ErrorState
            description={historyError}
            action={<DmButton onClick={() => void load()}>Повторить</DmButton>}
          />
        ) : null}
        {historyLoading && !items.length ? (
          <LoadingState label="Загружаем историю исправлений" />
        ) : !filtered.length ? (
          <div className={`${styles.panel} ${styles.empty}`}>
            <h2>
              {items.length ? "Исправления не найдены" : "Исправлений пока нет"}
            </h2>
            <p>
              {items.length
                ? "Попробуйте изменить поиск или статус."
                : "Предложите правку карточки. Решение площадки появится здесь."}
            </p>
          </div>
        ) : (
          <div className={styles.panel}>
            <ProductCorrectionsTable
              filtered={filtered}
              historyLimit={historyLimit}
              selectedId={selectedId}
              fieldLabel={fieldLabel}
              statusLabel={statusLabel}
              setSelectedId={setSelectedId}
            />
            {filtered.length > historyLimit ? (
              <DmButton onClick={() => setHistoryLimit((value) => value + 12)}>
                Показать более ранние исправления
              </DmButton>
            ) : null}
          </div>
        )}
        {selected ? (
          <section
            className={`${styles.panel} ${styles.form}`}
            aria-label="Результат исправления"
          >
            <div className={styles.toolbar}>
              <h2>{selected.product.canonicalName}</h2>
              <DmButton onClick={() => setSelectedId(null)}>
                Закрыть подробности
              </DmButton>
            </div>
            <div className={styles.fields}>
              <div>
                <h3>Было</h3>
                <p>{selected.currentValue || "Не заполнено"}</p>
              </div>
              <div>
                <h3>Предложено</h3>
                <p>{selected.proposedValue}</p>
              </div>
            </div>
            <p>Причина: {selected.reason}</p>
            {selected.appliedValue !== null ? (
              <p className={styles.notice}>Принято: {selected.appliedValue}</p>
            ) : null}
            {selected.moderatorComment ? (
              <p>Комментарий PlatformaMarket: {selected.moderatorComment}</p>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  if (sent)
    return (
      <section className={`${styles.panel} ${styles.empty}`}>
        <h2>Исправление отправлено</h2>
        <p role="status">
          Площадка проверит предложение. До принятия правки карточка останется
          прежней.
        </p>
        <DmButton appearance="primary" onClick={() => changeMode(false)}>
          Мои исправления
        </DmButton>
      </section>
    );
  return (
    <div className={styles.correctionForm}>
      <ProductCorrectionForm
        form={form}
        step={step}
        setStep={setStep}
        submit={submit}
        error={error}
        selectionControls={selectionControls}
        products={products}
        setSelectedProduct={setSelectedProduct}
        selectedProduct={selectedProduct}
        busy={busy}
        field={field}
        setField={setField}
        setProposedValue={setProposedValue}
        fields={fields}
        currentValue={currentValue}
        proposedValue={proposedValue}
        reason={reason}
        setReason={setReason}
        evidenceUrl={evidenceUrl}
        setEvidenceUrl={setEvidenceUrl}
        fieldLabel={fieldLabel}
        changeMode={changeMode}
      />
    </div>
  );
}
