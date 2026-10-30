import { DmFileInput } from "./controls";

import type { OrderWorkflowResponse } from "@marketplace/schemas";

import { DmButton } from "./actions";
import { DmField, DmInput } from "./controls";
import { Section } from "./primitives";

import { type WorkflowAction as Action } from "./order-workflow-command";
import { moneyInputValue, parseMoneyInput } from "./money";

import type { Dispatch, SetStateAction, RefObject } from "react";

type Props = {
  mayInvoice: boolean;
  fileInputId: string;
  busy: boolean;
  setFile: Dispatch<SetStateAction<File | null>>;
  uploaded: RefObject<{
    file: File;
    id: string;
    amountMinor: string;
    currency: string;
  } | null>;
  uploadNumber: RefObject<string>;
  mayReport: boolean;
  data: OrderWorkflowResponse;
  transferAmount: string | null;
  setTransferAmount: Dispatch<SetStateAction<string | null>>;
  paidAt: string;
  setPaidAt: Dispatch<SetStateAction<string>>;
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  file: File | null;
  has: (...required: string[]) => boolean;
  canAct: (action: Action["action"]) => boolean;
  sendFile: () => Promise<void>;
};

export function OrderTransferUpload({
  mayInvoice,
  fileInputId,
  busy,
  setFile,
  uploaded,
  uploadNumber,
  mayReport,
  data,
  transferAmount,
  setTransferAmount,
  paidAt,
  setPaidAt,
  comment,
  setComment,
  file,
  has,
  canAct,
  sendFile,
}: Props) {
  return (
    <Section
      title={mayInvoice ? "Загрузить готовый счёт" : "Сообщить о переводе"}
    >
      <p>
        {mayInvoice
          ? "Загрузите счёт с реквизитами и суммой заказа. После заявления перевода замена счёта недоступна."
          : "Укажите сумму этого перевода и приложите отдельную квитанцию. Доплаты учитываются после проверки поставщиком."}
      </p>
      <DmField
        label={{
          htmlFor: fileInputId,
          children: mayInvoice
            ? "Счёт, PDF до 10 МБ (10 000 000 байт)"
            : "Квитанция, PDF до 10 МБ (10 000 000 байт)",
        }}
      >
        <DmFileInput
          id={fileInputId}
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            uploaded.current = null;
            uploadNumber.current = "";
          }}
        />
      </DmField>
      {mayReport ? (
        <>
          <DmField
            label={`Сумма этого перевода, ${data.order.currency}`}
            validationState={
              transferAmount !== null && !parseMoneyInput(transferAmount)
                ? "error"
                : "none"
            }
            validationMessage={
              transferAmount !== null && !parseMoneyInput(transferAmount)
                ? "Укажите положительную сумму с точностью до двух знаков"
                : undefined
            }
          >
            <DmInput
              inputMode="decimal"
              disabled={busy}
              value={
                transferAmount ??
                moneyInputValue(
                  data.paymentSummary?.remainingAmountMinor ??
                    data.order.subtotalAmountMinor,
                )
              }
              onChange={(_, d) => setTransferAmount(d.value)}
            />
          </DmField>
          <DmField label="Дата и время перевода">
            <DmInput
              type="datetime-local"
              value={paidAt}
              onChange={(_, d) => setPaidAt(d.value)}
            />
          </DmField>
          <DmField label="Комментарий к переводу">
            <DmInput value={comment} onChange={(_, d) => setComment(d.value)} />
          </DmField>
        </>
      ) : null}
      <DmButton
        disabled={
          busy ||
          !file ||
          !has("document.upload") ||
          !canAct(mayInvoice ? "ISSUE_INVOICE" : "REPORT_TRANSFER")
        }
        onClick={() => void sendFile()}
      >
        {busy
          ? "Сохраняем…"
          : mayInvoice
            ? "Выставить счёт"
            : "Отправить квитанцию"}
      </DmButton>
    </Section>
  );
}
