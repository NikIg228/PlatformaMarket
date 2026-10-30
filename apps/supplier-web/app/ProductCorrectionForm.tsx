import {
  DmButton,
  DmField,
  DmInput,
  DmDropdown,
  DmTextarea,
  ErrorState,
  ProductThumbnail,
  productWorkflowStyles as styles,
} from "@marketplace/ui";
import { type ReactNode } from "react";
import { canSubmitProductCorrection } from "./product-corrections-validation";
import type { Product } from "./product-corrections-panel-types";

import type { Dispatch, SetStateAction, RefObject } from "react";

type Props = {
  form: RefObject<HTMLFormElement | null>;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  submit: () => Promise<void>;
  error: string | null;
  selectionControls: ReactNode;
  products: Product[];
  setSelectedProduct: Dispatch<SetStateAction<Product | null>>;
  selectedProduct: Product | null;
  busy: boolean;
  field:
    | "CANONICAL_NAME"
    | "DESCRIPTION"
    | "MANUFACTURER_SKU"
    | "GTIN"
    | "PRODUCT_TYPE"
    | "REGULATORY_CLASS";
  setField: Dispatch<
    SetStateAction<
      | "CANONICAL_NAME"
      | "DESCRIPTION"
      | "MANUFACTURER_SKU"
      | "GTIN"
      | "PRODUCT_TYPE"
      | "REGULATORY_CLASS"
    >
  >;
  setProposedValue: Dispatch<SetStateAction<string>>;
  fields: readonly [
    readonly ["CANONICAL_NAME", "Название"],
    readonly ["DESCRIPTION", "Описание"],
    readonly ["MANUFACTURER_SKU", "Артикул производителя"],
    readonly ["GTIN", "GTIN"],
    readonly ["PRODUCT_TYPE", "Тип товара"],
    readonly ["REGULATORY_CLASS", "Регуляторный класс"],
  ];
  currentValue: string | null;
  proposedValue: string;
  reason: string;
  setReason: Dispatch<SetStateAction<string>>;
  evidenceUrl: string;
  setEvidenceUrl: Dispatch<SetStateAction<string>>;
  fieldLabel: (field: string) => string;
  changeMode: (value: boolean) => void;
};

export function ProductCorrectionForm({
  form,
  step,
  setStep,
  submit,
  error,
  selectionControls,
  products,
  setSelectedProduct,
  selectedProduct,
  busy,
  field,
  setField,
  setProposedValue,
  fields,
  currentValue,
  proposedValue,
  reason,
  setReason,
  evidenceUrl,
  setEvidenceUrl,
  fieldLabel,
  changeMode,
}: Props) {
  return (
    <form
      ref={form}
      className={`${styles.panel} ${styles.form}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 1) {
          if (form.current?.reportValidity()) setStep(2);
        } else if (step === 2) void submit();
      }}
    >
      {error ? <ErrorState description={error} /> : null}
      {step === 0 ? (
        <>
          <h2>Выберите карточку товара</h2>
          {selectionControls}
          {!products.length ? (
            <p className={styles.hint}>
              Нет доступных карточек. Измените поиск или сначала добавьте
              предложение.
            </p>
          ) : (
            <div className={styles.results}>
              {products.map((product) => (
                <div key={product.id} className={styles.result}>
                  <div className={styles.identity}>
                    <ProductThumbnail
                      src={product.media?.[0]?.sourceUrl}
                      name={product.canonicalName}
                    />
                    <div>
                      <strong>{product.canonicalName}</strong>
                      <small>
                        {product.manufacturerSku || "Артикул не указан"}
                      </small>
                    </div>
                  </div>
                  <DmButton
                    onClick={() => {
                      setSelectedProduct(product);
                      setStep(1);
                    }}
                  >
                    Выбрать
                  </DmButton>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`${styles.identity} ${styles.selectionSummary}`}>
            <ProductThumbnail
              src={selectedProduct?.media?.[0]?.sourceUrl}
              name={selectedProduct?.canonicalName ?? "Товар"}
            />
            <div>
              <strong>{selectedProduct?.canonicalName}</strong>
              <small>
                {selectedProduct?.manufacturerSku || "Артикул не указан"}
              </small>
            </div>
            <DmButton
              appearance="subtle"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Изменить товар
            </DmButton>
          </div>
          {step === 1 ? (
            <>
              <h2>Что нужно исправить?</h2>
              <div className={styles.halfField}>
                <DmField label="Что исправить" required>
                  <DmDropdown
                    value={field}
                    disabled={busy}
                    onChange={(_, data) => {
                      setField(data.value as typeof field);
                      setProposedValue("");
                    }}
                  >
                    {fields.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </DmDropdown>
                </DmField>
              </div>
              <div className={styles.fields}>
                <DmField label="Сейчас в карточке">
                  <div className={styles.currentValue}>
                    {currentValue || "Не заполнено"}
                  </div>
                </DmField>
                <DmField label="Предлагаемая редакция" required>
                  <DmTextarea
                    required
                    minLength={2}
                    maxLength={5000}
                    rows={5}
                    value={proposedValue}
                    onChange={(_, data) => setProposedValue(data.value)}
                  />
                </DmField>
              </div>
              <div className={styles.fields}>
                <DmField
                  label="Почему нужна правка"
                  required
                  hint="Не менее 10 символов. Объясните расхождение с документом или каталогом производителя."
                >
                  <DmTextarea
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={2}
                    value={reason}
                    onChange={(_, data) => setReason(data.value)}
                  />
                </DmField>
                <DmField
                  label="Ссылка на подтверждение"
                  hint="Необязательно: сайт производителя или регистрационный документ."
                >
                  <DmInput
                    type="url"
                    maxLength={2000}
                    value={evidenceUrl}
                    onChange={(_, data) => setEvidenceUrl(data.value)}
                  />
                </DmField>
              </div>
              <p className={styles.hint}>
                Изменение появится в карточке после проверки площадкой.
              </p>
            </>
          ) : (
            <>
              <h2>Проверьте исправление</h2>
              <dl className={styles.metadata}>
                <dt>Поле</dt>
                <dd>{fieldLabel(field)}</dd>
                <dt>Сейчас</dt>
                <dd>{currentValue || "Не заполнено"}</dd>
                <dt>Предложено</dt>
                <dd>{proposedValue}</dd>
                <dt>Причина</dt>
                <dd>{reason}</dd>
                {evidenceUrl ? (
                  <>
                    <dt>Подтверждение</dt>
                    <dd>{evidenceUrl}</dd>
                  </>
                ) : null}
              </dl>
              <p className={styles.notice}>
                Изменение появится в общей карточке только после проверки
                площадкой.
              </p>
            </>
          )}
        </>
      )}
      <div className={styles.footer}>
        <DmButton
          disabled={busy}
          onClick={() => {
            if (step > 0) setStep(step - 1);
            else if (
              !(proposedValue || reason || evidenceUrl) ||
              window.confirm("Закрыть форму без отправки?")
            )
              changeMode(false);
          }}
        >
          {step > 0 ? "Назад" : "Отмена"}
        </DmButton>
        {step > 0 ? (
          <DmButton
            type="submit"
            appearance="primary"
            disabled={
              busy ||
              (step === 2 &&
                !canSubmitProductCorrection({
                  busy,
                  productId: selectedProduct?.id ?? "",
                  proposedValue,
                  reason,
                }))
            }
          >
            {busy
              ? "Отправляем…"
              : step === 1
                ? "Далее: подтверждение"
                : "Отправить исправление"}
          </DmButton>
        ) : null}
      </div>
    </form>
  );
}
