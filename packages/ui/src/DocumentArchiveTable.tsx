import { DmAction } from "./controls";

import { DmButton as Button } from "./controls";
import { ArrowDownload24Regular } from "@fluentui/react-icons/svg/arrow-download";

import type { DocumentArchiveItemView } from "./document-archive-types";
import {
  kindLabels,
  formatMoney,
  DocumentStatus,
} from "./document-archive-presentation";

type Props = {
  items: DocumentArchiveItemView[];
  organizationId: string;
  openDocument: (documentId: string) => void;
  showDate: (value: string) => string;
  busyDocumentId: string | null;
  onDownload: (document: DocumentArchiveItemView) => void;
};

export function DocumentArchiveTable({
  items,
  organizationId,
  openDocument,
  showDate,
  busyDocumentId,
  onDownload,
}: Props) {
  return (
    <div className="dm-document-table-wrap">
      <table className="dm-document-table">
        <caption className="dm-sr-only">Документы организации</caption>
        <thead>
          <tr>
            <th>Документ</th>
            <th>Контрагент</th>
            <th>Дата</th>
            <th>Сумма</th>
            <th>Статус</th>
            <th>
              <span className="dm-sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((document) => {
            const counterparty = document.participants.find(
              ({ organizationId: participantId }) =>
                participantId !== organizationId,
            )?.organization;
            return (
              <tr
                key={document.id}
                tabIndex={0}
                onDoubleClick={() => openDocument(document.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") openDocument(document.id);
                }}
              >
                <td data-label="Документ">
                  <DmAction
                    variant="text"
                    className="dm-document-link"
                    onClick={() => openDocument(document.id)}
                  >
                    <strong>{document.title}</strong>
                    <span>
                      {kindLabels[document.kind] ?? document.kind} · №{" "}
                      {document.documentNumber} · v{document.version}
                    </span>
                  </DmAction>
                </td>
                <td data-label="Контрагент">
                  {counterparty ? (
                    <>
                      <strong>{counterparty.displayName}</strong>
                      <span className="dm-document-muted">
                        БИН {counterparty.bin}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-label="Дата">{showDate(document.documentDate)}</td>
                <td data-label="Сумма">
                  {formatMoney(document.amountMinor, document.currency)}
                </td>
                <td data-label="Статус">
                  <div className="dm-document-statuses">
                    <DocumentStatus value={document.status} />
                    {document.accountingStatus !== "NOT_APPLICABLE" ? (
                      <DocumentStatus value={document.accountingStatus} />
                    ) : null}
                  </div>
                </td>
                <td>
                  <Button
                    appearance="subtle"
                    icon={<ArrowDownload24Regular />}
                    aria-label={`Скачать ${document.title}`}
                    disabled={busyDocumentId === document.id}
                    onClick={() => onDownload(document)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
