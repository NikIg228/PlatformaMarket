import { ActionFeedback } from "./action-feedback";

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
  DmSelect as Select,
  DmTextarea as Textarea,
} from "./controls";
import { ArrowDownload24Regular } from "@fluentui/react-icons/svg/arrow-download";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";

import type { DocumentArchiveItemView } from "./document-archive-types";
import {
  kindLabels,
  statusLabels,
  formatMoney,
} from "./document-archive-presentation";
import type { DocumentArchiveParticipantView } from "./document-archive-types";

import type { Dispatch, SetStateAction, RefObject } from "react";

type Props = {
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  documentDialog: RefObject<HTMLDivElement | null>;
  selected: DocumentArchiveItemView | null;
  showDate: (value: string) => string;
  counterparties: DocumentArchiveParticipantView[];
  detailFailed: boolean;
  onAccountingStatus:
    | ((
        document: DocumentArchiveItemView,
        status: "REVIEWED" | "RECONCILED" | "DISPUTED",
        reason: string,
      ) => Promise<void>)
    | undefined;
  accountingStatus: "REVIEWED" | "RECONCILED" | "DISPUTED";
  setAccountingStatus: Dispatch<
    SetStateAction<"REVIEWED" | "RECONCILED" | "DISPUTED">
  >;
  accountingReason: string;
  setAccountingReason: Dispatch<SetStateAction<string>>;
  has: (...required: string[]) => boolean;
  busyDocumentId: string | null;
  openDocument: (documentId: string) => void;
  onDownload: (document: DocumentArchiveItemView) => void;
};

export function DocumentArchiveDetail({
  selectedId,
  setSelectedId,
  documentDialog,
  selected,
  showDate,
  counterparties,
  detailFailed,
  onAccountingStatus,
  accountingStatus,
  setAccountingStatus,
  accountingReason,
  setAccountingReason,
  has,
  busyDocumentId,
  openDocument,
  onDownload,
}: Props) {
  return (
    <Dialog
      open={Boolean(selectedId)}
      onOpenChange={(_, data) => {
        if (!data.open) setSelectedId(null);
      }}
    >
      <DialogSurface ref={documentDialog} className="dm-document-dialog">
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                aria-label="Закрыть"
                onClick={() => setSelectedId(null)}
              />
            }
          >
            {selected?.title ?? "Документ"}
          </DialogTitle>
          {selected ? (
            <DialogContent className="dm-document-detail">
              <dl>
                <div>
                  <dt>Номер</dt>
                  <dd>{selected.documentNumber}</dd>
                </div>
                <div>
                  <dt>Тип</dt>
                  <dd>{kindLabels[selected.kind] ?? selected.kind}</dd>
                </div>
                <div>
                  <dt>Дата</dt>
                  <dd>{showDate(selected.documentDate)}</dd>
                </div>
                <div>
                  <dt>Сумма</dt>
                  <dd>
                    {formatMoney(selected.amountMinor, selected.currency)}
                  </dd>
                </div>
                <div>
                  <dt>Версия</dt>
                  <dd>{selected.version}</dd>
                </div>
                <div>
                  <dt>Заказ</dt>
                  <dd>{selected.supplierOrder?.orderNumber ?? "Не связан"}</dd>
                </div>
              </dl>
              <section>
                <h3>Стороны документа</h3>
                {counterparties.length ? (
                  counterparties.map((party) => (
                    <p key={`${party.organizationId}:${party.role}`}>
                      <strong>{party.organization.displayName}</strong>
                      <span>
                        БИН {party.organization.bin} · {party.role}
                      </span>
                    </p>
                  ))
                ) : (
                  <p>Контрагент не указан.</p>
                )}
              </section>
              <section>
                <h3>Подписи</h3>
                {selected.signatures.length ? (
                  selected.signatures.map((signature) => (
                    <p key={signature.id}>
                      <strong>{signature.signerName ?? "Подписант"}</strong>
                      <span>
                        {signature.method} ·{" "}
                        {statusLabels[signature.status] ?? signature.status}
                        {signature.signedAt
                          ? ` · ${showDate(signature.signedAt)}`
                          : ""}
                      </span>
                    </p>
                  ))
                ) : (
                  <p>Подписи для документа не зарегистрированы.</p>
                )}
              </section>
              <section>
                <h3>История версий</h3>
                {selected.versions.length ? (
                  selected.versions.map((version) => (
                    <p key={version.id}>
                      <strong>Версия {version.version}</strong>
                      <span>
                        {statusLabels[version.status] ?? version.status} ·{" "}
                        {showDate(version.documentDate)}
                      </span>
                    </p>
                  ))
                ) : (
                  <p>
                    {detailFailed
                      ? "Историю версий загрузить не удалось."
                      : "Загружаем цепочку версий…"}
                  </p>
                )}
              </section>
              {onAccountingStatus &&
              selected.accountingStatus !== "NOT_APPLICABLE" ? (
                <section className="dm-document-accounting">
                  <h3>Бухгалтерская обработка</h3>
                  <Select
                    aria-label="Новый бухгалтерский статус"
                    value={accountingStatus}
                    onChange={(_, data) =>
                      setAccountingStatus(data.value as typeof accountingStatus)
                    }
                  >
                    <option value="REVIEWED">Проверен</option>
                    <option value="RECONCILED">Сверен</option>
                    <option value="DISPUTED">Есть расхождение</option>
                  </Select>
                  <Textarea
                    aria-label="Комментарий к бухгалтерской отметке"
                    placeholder="Основание изменения"
                    value={accountingReason}
                    onChange={(_, data) => setAccountingReason(data.value)}
                  />
                  <Button
                    appearance="primary"
                    disabled={
                      !has("document.accounting.review") ||
                      accountingReason.trim().length < 2 ||
                      busyDocumentId === selected.id
                    }
                    onClick={() =>
                      void onAccountingStatus(
                        selected,
                        accountingStatus,
                        accountingReason,
                      ).then(() => setAccountingReason(""))
                    }
                  >
                    Сохранить отметку
                  </Button>
                </section>
              ) : null}
            </DialogContent>
          ) : (
            <DialogContent>
              {detailFailed ? (
                <ActionFeedback
                  tone="error"
                  description="Не удалось открыть документ. Проверьте доступ и повторите попытку."
                  action={
                    <Button
                      onClick={() => selectedId && openDocument(selectedId)}
                    >
                      Повторить загрузку документа
                    </Button>
                  }
                />
              ) : (
                <p role="status">Загружаем документ…</p>
              )}
            </DialogContent>
          )}
          <DialogActions>
            <Button
              appearance="primary"
              icon={<ArrowDownload24Regular />}
              disabled={!selected || busyDocumentId === selected?.id}
              onClick={() => selected && onDownload(selected)}
            >
              Скачать
            </Button>
            <Button onClick={() => setSelectedId(null)}>Закрыть</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
