import { ActionFeedback } from "./action-feedback";
import { DmFileInput } from "./controls";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "@fluentui/react-components";
import {
  DmButton as Button,
  DmField as Field,
  DmInput as Input,
  DmSelect as Select,
} from "./controls";

import { Document24Regular } from "@fluentui/react-icons/svg/document";

import { useId, useRef, useState } from "react";
import {
  documentDateValid,
  documentUploadError,
  documentUploadFileError,
  parseDocumentAmount,
} from "./document-upload-model";
import { DocumentRelationSelect } from "./document-relation-select";
import type {
  DocumentRelationLoader,
  DocumentRelationOption,
} from "./document-relations";
import { usePermissions } from "./permissions";
import type { DocumentArchiveUploadInput } from "./document-archive-types";
import { kindLabels } from "./document-archive-presentation";

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });

export function DocumentArchiveUpload({
  kinds,
  busy,
  onUpload,
  loadOrderOptions,
  loadAgreementOptions,
}: {
  kinds: string[];
  busy: boolean;
  onUpload: (input: DocumentArchiveUploadInput) => Promise<void>;
  loadOrderOptions: DocumentRelationLoader;
  loadAgreementOptions: DocumentRelationLoader;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState(kinds[0] ?? "OTHER");
  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedOrder, setSelectedOrder] =
    useState<DocumentRelationOption | null>(null);
  const [selectedAgreement, setSelectedAgreement] =
    useState<DocumentRelationOption | null>(null);
  const [referenceId, setReferenceId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("KZT");
  const [requiredSignatureCount, setRequiredSignatureCount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitLock = useRef(false);
  const has = usePermissions();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Dialog unmounts its native input on close. Restore the already user-selected
  // in-memory File so native feedback and the retained draft tell the same story.
  const attachFileInput = (node: HTMLInputElement | null) => {
    fileInputRef.current = node;
    if (node && file && node.files?.[0] !== file) {
      const selection = new DataTransfer();
      selection.items.add(file);
      node.files = selection.files;
    }
  };
  const fileId = useId();
  const pending = busy || submitting;
  const parsedAmount = parseDocumentAmount(amount);
  const fileError = file ? documentUploadFileError(file) : null;
  const close = () => {
    if (submitLock.current || busy) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const submit = async () => {
    if (!has("document.upload")) {
      setError("Загрузка недоступна вашей роли. Ввод сохранён.");
      return;
    }
    if (
      submitLock.current ||
      busy ||
      !file ||
      !title.trim() ||
      !documentNumber.trim()
    )
      return;
    if (
      (kind === "CONTRACT_ADDENDUM" && !selectedAgreement) ||
      (kind === "REFUND_CONFIRMATION" && !referenceId.trim())
    ) {
      setError(
        kind === "CONTRACT_ADDENDUM"
          ? "Выберите основной договор из списка."
          : "Для выбранного типа документа укажите ID связанного основания.",
      );
      return;
    }
    const validationError =
      documentUploadFileError(file) ??
      parsedAmount.error ??
      (!documentDateValid(documentDate)
        ? "Укажите корректную дату документа."
        : null) ??
      (parsedAmount.minor !== undefined && !/^[A-Z]{3}$/.test(currency)
        ? "Укажите трёхбуквенный код валюты, например KZT."
        : null);
    if (validationError) {
      setError(validationError);
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setError("Поддерживаются только PDF и DOCX.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      setError(null);
      await onUpload({
        kind,
        format: extension === "pdf" ? "PDF" : "DOCX",
        title: title.trim(),
        documentNumber: documentNumber.trim(),
        documentDate: new Date(`${documentDate}T00:00:00.000Z`).toISOString(),
        supplierOrderId: selectedOrder?.id,
        paymentIntentId:
          kind === "PAYMENT_CONFIRMATION"
            ? referenceId.trim() || undefined
            : undefined,
        refundId:
          kind === "REFUND_CONFIRMATION"
            ? referenceId.trim() || undefined
            : undefined,
        baseAgreementDocumentId:
          kind === "CONTRACT_ADDENDUM" ? selectedAgreement?.id : undefined,
        amountMinor: parsedAmount.minor,
        currency: parsedAmount.minor !== undefined ? currency : undefined,
        fileName: file.name,
        contentBase64: await fileToBase64(file),
        requiredSignatureCount: Number(requiredSignatureCount),
      });
      setOpen(false);
      setSuccess(true);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTitle("");
      setDocumentNumber("");
      setSelectedOrder(null);
      setSelectedAgreement(null);
      setReferenceId("");
      setAmount("");
      setRequiredSignatureCount("0");
    } catch (uploadError) {
      setError(documentUploadError(uploadError));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        disabled={!has("document.upload")}
        appearance="primary"
        icon={<Document24Regular />}
        onClick={() => {
          setSuccess(false);
          setOpen(true);
        }}
      >
        Загрузить документ
      </Button>
      {success ? (
        <ActionFeedback
          tone="success"
          description="Документ загружен в архив."
        />
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          if (!data.open) close();
        }}
      >
        <DialogSurface className="dm-document-dialog">
          <DialogBody>
            <DialogTitle>Новый документ</DialogTitle>
            <DialogContent className="dm-document-upload-form">
              <p>
                Черновик сохраняется при закрытии окна, пока вы остаётесь на
                этой странице. Во время загрузки дождитесь результата.
              </p>
              <fieldset
                disabled={pending}
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  display: "contents",
                }}
              >
                <Field label="Тип документа" required>
                  <Select
                    value={kind}
                    onChange={(_, data) => setKind(data.value)}
                  >
                    {kinds.map((value) => (
                      <option key={value} value={value}>
                        {kindLabels[value] ?? value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Название" required hint="От 2 до 240 символов">
                  <Input
                    maxLength={240}
                    value={title}
                    onChange={(_, data) => setTitle(data.value)}
                  />
                </Field>
                <div className="dm-document-upload-row">
                  <Field label="Номер" required>
                    <Input
                      maxLength={120}
                      value={documentNumber}
                      onChange={(_, data) => setDocumentNumber(data.value)}
                    />
                  </Field>
                  <Field
                    label="Дата документа"
                    required
                    validationState={
                      documentDateValid(documentDate) ? "none" : "error"
                    }
                    validationMessage={
                      documentDateValid(documentDate)
                        ? undefined
                        : "Укажите корректную дату документа."
                    }
                  >
                    <Input
                      type="date"
                      value={documentDate}
                      onChange={(_, data) => setDocumentDate(data.value)}
                    />
                  </Field>
                </div>
                <DocumentRelationSelect
                  label="Связанный заказ"
                  searchLabel="Поиск заказа"
                  hint="Необязательно. Выбор связывает документ с закупкой, но не подтверждает её оплату."
                  disabled={pending}
                  selected={selectedOrder}
                  onSelect={setSelectedOrder}
                  load={loadOrderOptions}
                />
                {kind === "CONTRACT_ADDENDUM" ? (
                  <DocumentRelationSelect
                    label="Основной договор"
                    searchLabel="Поиск договора"
                    required
                    hint="Для допсоглашения выберите исходный договор. Связь с записью архива не подтверждает действие договора или подпись."
                    disabled={pending}
                    selected={selectedAgreement}
                    onSelect={setSelectedAgreement}
                    load={loadAgreementOptions}
                  />
                ) : null}
                {kind === "PAYMENT_CONFIRMATION" ? (
                  <Field
                    label="ID платежа"
                    hint="Необязательно, если связанный заказ уже имеет подтверждённую оплату."
                  >
                    <Input
                      value={referenceId}
                      onChange={(_, data) => setReferenceId(data.value)}
                    />
                  </Field>
                ) : null}
                {kind === "REFUND_CONFIRMATION" ? (
                  <Field label="ID возврата" required>
                    <Input
                      value={referenceId}
                      onChange={(_, data) => setReferenceId(data.value)}
                    />
                  </Field>
                ) : null}
                <div className="dm-document-upload-row">
                  <Field
                    label={`Сумма (${currency || "валюта"})`}
                    hint="В основных единицах: для KZT — тенге. Например, 1 250,50. Не более двух знаков после запятой."
                    validationState={parsedAmount.error ? "error" : "none"}
                    validationMessage={parsedAmount.error}
                  >
                    <Input
                      inputMode="decimal"
                      value={amount}
                      onChange={(_, data) => setAmount(data.value)}
                    />
                  </Field>
                  <Field label="Валюта">
                    <Input
                      maxLength={3}
                      value={currency}
                      onChange={(_, data) =>
                        setCurrency(data.value.toUpperCase())
                      }
                    />
                  </Field>
                </div>
                <Field label="Требуемые подписи">
                  <Select
                    value={requiredSignatureCount}
                    onChange={(_, data) =>
                      setRequiredSignatureCount(data.value)
                    }
                  >
                    <option value="0">Не требуются</option>
                    <option value="1">Одна</option>
                    <option value="2">Две</option>
                  </Select>
                </Field>
                <Field
                  label={{ children: "Файл PDF или DOCX", htmlFor: fileId }}
                  required
                  hint="PDF или DOCX, непустой файл до 10 МБ (10 000 000 байт). Сервер дополнительно проверит содержимое."
                  validationState={fileError ? "error" : "none"}
                  validationMessage={fileError}
                >
                  <DmFileInput
                    ref={attachFileInput}
                    id={fileId}
                    aria-label="Файл PDF или DOCX"
                    className="dm-document-file-input"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                  {file ? <span>Выбран: {file.name}</span> : null}
                </Field>
              </fieldset>
              {!has("document.upload") ? (
                <p role="status">
                  Загрузка недоступна вашей роли. Ввод сохранён.
                </p>
              ) : null}
              {error ? (
                <ActionFeedback
                  tone="error"
                  title="Документ не загружен"
                  description={error}
                />
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                disabled={
                  !has("document.upload") ||
                  pending ||
                  !!fileError ||
                  !!parsedAmount.error ||
                  !file ||
                  title.trim().length < 2 ||
                  !documentNumber.trim() ||
                  !documentDateValid(documentDate) ||
                  (kind === "CONTRACT_ADDENDUM" && !selectedAgreement)
                }
                onClick={() => void submit()}
              >
                {pending ? "Загружаем…" : "Загрузить"}
              </Button>
              <Button disabled={pending} onClick={close}>
                Закрыть, сохранив черновик
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
